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

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000

const TOKEN_BYTES = 24

// Parsed at both mint and consume — never trust the JSONB blob.
const lDocPayloadSchema = z.object({
  slotId: z.uuid(),
  instructions: z.string().optional(),
})

const payloadSchemasByType: Record<VoipLinkTokenType, z.ZodType> = {
  l_doc: lDocPayloadSchema,
}

export type ParsedLinkPayload
  = | { type: 'l_doc', payload: z.infer<typeof lDocPayloadSchema> }

interface MintTokenInput {
  type: VoipLinkTokenType
  customerId: string
  // Captured at mint; immune to subsequent customer.phone edits.
  phoneE164: string
  payload: unknown
  // Visibility scoping — agents see only links they minted.
  createdByUserId: string
}

interface MintTokenResult {
  tokenId: string
  token: string
  expiresAt: string
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function createVoipLinkTokensService() {
  return {
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

    /** Does not mark the token used — the caller calls `markUsed` only after the consume page renders. */
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
        // Schema drift between mint and consume — surfaced as a precondition rather than crashing the consume route.
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

    markUsed: async (tokenValue: string): Promise<DalReturn<{ flipped: boolean }>> => {
      const result = await markTokenUsed(tokenValue)
      if (!result.success) {
        return result
      }
      return dalSuccess({ flipped: result.data.rowsAffected > 0 })
    },

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

export const voipLinkTokensService = createVoipLinkTokensService()
