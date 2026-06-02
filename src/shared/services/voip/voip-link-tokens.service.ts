import type { VoipLinkTokenType } from '@/shared/constants/enums'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { voipLinkTokens as voipLinkTokensTable } from '@/shared/db/schema/voip-link-tokens'
import type { Row } from '@/shared/db/types'

import { randomBytes } from 'node:crypto'

import { lt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipLinkTokens } from '@/shared/db/schema/voip-link-tokens'
import { voipLinkTokenCrud } from '@/shared/entities/voip-link-tokens/dal/server/crud'
import { getTokenByValue, markTokenUsed } from '@/shared/entities/voip-link-tokens/dal/server/queries'

// ---------------------------------------------------------------------------
// voipLinkTokensService — short-lived signed URLs for customer-side actions
// delivered via SMS. Orthogonal to Twilio — this service mints + consumes
// rows; the actual SMS send (with the URL embedded) goes through
// `voipMessagesService.sendSms`. The two compose at the route handler /
// service-caller boundary.
//
// see src/shared/entities/voip-link-tokens/DOCS.md (invariants)
// ---------------------------------------------------------------------------

// 48-hour hard expiry per EPIC. Cleanup cron purges past-expiry rows.
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000

// 24 random bytes → 32-character base64url. Plenty of entropy for the
// short window + non-guessability requirements.
const TOKEN_BYTES = 24

// Per-type payload schemas. Each `voipLinkTokenTypes` value gets its own
// Zod that's parsed at BOTH mint and consume — never trust the JSONB blob.
// Phase 1: only `l_doc`. New types add a new entry here and a discriminated
// branch in `consumeToken`.
const lDocPayloadSchema = z.object({
  slotId: z.uuid(),
  instructions: z.string().optional(),
})

const payloadSchemasByType: Record<VoipLinkTokenType, z.ZodType> = {
  l_doc: lDocPayloadSchema,
}

// Discriminated payload — what `consumeToken` returns. Per-type widening as
// future types land.
export type ParsedLinkPayload
  = | { type: 'l_doc', payload: z.infer<typeof lDocPayloadSchema> }

interface MintTokenInput {
  // Type tag — drives the per-type payload schema lookup.
  type: VoipLinkTokenType
  customerId: string
  // Captured at mint; immune to subsequent customer.phone edits.
  phoneE164: string
  // Type-specific payload. Validated against `payloadSchemasByType[type]`.
  payload: unknown
  // The agent minting the link. Persisted for visibility scoping (agents
  // see only links they minted).
  createdByUserId: string
}

interface MintTokenResult {
  // Internal row id.
  tokenId: string
  // The random token value — what callers embed in the customer-facing URL.
  token: string
  // Absolute expiry timestamp for UI display ("Link expires Mar 5, 2026").
  expiresAt: string
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function createVoipLinkTokensService() {
  return {
    /**
     * Mint a fresh token row. Validates the payload against the per-type
     * Zod first; rejects with `precondition-failed` if mismatched. Returns
     * the random token value so the caller can compose the customer URL
     * (`${getPublicBaseUrl()}/api/voip/links/${token}`).
     */
    mintToken: async (
      ctx: ScopedContext,
      input: MintTokenInput,
    ): Promise<DalReturn<MintTokenResult>> => {
      const schema = payloadSchemasByType[input.type]
      const parsed = schema.safeParse(input.payload)
      if (!parsed.success) {
        return dalError({
          type: 'precondition-failed',
          reason: `voip-link-tokens.mintToken: payload failed validation for type ${input.type}`,
        })
      }

      const token = generateToken()
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

      const insertResult = await voipLinkTokenCrud.create(ctx, {
        token,
        type: input.type,
        customerId: input.customerId,
        phoneE164: input.phoneE164,
        expiresAt,
        createdByUserId: input.createdByUserId,
        payloadJson: parsed.data,
      })

      if (!insertResult.success) {
        return insertResult
      }

      return dalSuccess({
        tokenId: insertResult.data.id,
        token,
        expiresAt,
      })
    },

    /**
     * Resolve a token value to its row + typed payload. Used by the customer
     * consume route at `/api/voip/links/[token]/route.ts` (Slug D). Returns
     * `precondition-failed` for expired / already-used / unknown tokens —
     * the route handler converts those to 410 Gone.
     *
     * Does NOT mark used — caller calls `markUsed` AFTER successfully
     * rendering the consume page (one-shot semantics with explicit commit).
     */
    resolveToken: async (
      tokenValue: string,
    ): Promise<DalReturn<{ row: Row<typeof voipLinkTokensTable>, parsed: ParsedLinkPayload }>> => {
      const tokenResult = await getTokenByValue(tokenValue)
      if (!tokenResult.success) {
        return tokenResult
      }
      const row = tokenResult.data
      if (!row) {
        return dalError({ type: 'precondition-failed', reason: 'token not found or expired' })
      }
      if (row.usedAt) {
        return dalError({ type: 'precondition-failed', reason: 'token already used' })
      }

      const schema = payloadSchemasByType[row.type]
      const parsed = schema.safeParse(row.payloadJson)
      if (!parsed.success) {
        // Schema drift between mint and consume — shouldn't happen, but
        // surface as precondition rather than crash the consume route.
        return dalError({
          type: 'precondition-failed',
          reason: `voip-link-tokens.resolveToken: payload schema mismatch for type ${row.type}`,
        })
      }

      return dalSuccess({
        row,
        parsed: { type: row.type, payload: parsed.data } as ParsedLinkPayload,
      })
    },

    /**
     * Mark a token used. Idempotent — re-call is a no-op (the underlying
     * query uses `usedAt IS NULL` in the WHERE). Returns whether the row
     * was actually flipped (`true`) or already used (`false`).
     */
    markUsed: async (tokenValue: string): Promise<DalReturn<{ flipped: boolean }>> => {
      const result = await markTokenUsed(tokenValue)
      if (!result.success) {
        return result
      }
      return dalSuccess({ flipped: result.data.rowsAffected > 0 })
    },

    /**
     * Purge expired+unused tokens. Called by a Phase 1 cleanup cron (Slug G).
     * Returns the number of rows deleted. Used tokens are KEPT for audit
     * (the agent can see "yes, I sent this link, the customer used it").
     */
    purgeExpired: async (): Promise<DalReturn<{ deleted: number }>> => {
      return dalDbOperation(async () => {
        const result = await db
          .delete(voipLinkTokens)
          .where(lt(voipLinkTokens.expiresAt, sql`NOW()`))
          .returning({ id: voipLinkTokens.id })

        return { deleted: result.length }
      })
    },
  }
}

/**
 * Single-instance voipLinkTokensService. Used by agent-side mint flows
 * (UI → tRPC → service) and the customer-side consume route (Slug D).
 */
export const voipLinkTokensService = createVoipLinkTokensService()
