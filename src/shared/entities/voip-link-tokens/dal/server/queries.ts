// Custom DAL queries for voip-link-tokens — token-keyed lookup + safe consume.
// see ../../DOCS.md (48h hard expiry, immutable-except-usedAt invariant)

import type { DalReturn } from '@/shared/dal/server/types'
import type { Row } from '@/shared/db/types'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { voipLinkTokens } from '@/shared/db/schema/voip-link-tokens'

/**
 * Fetch a token row by its random `token` value. Returns null when the row
 * doesn't exist OR when it has expired. Does NOT mark it used — caller
 * (consume route) calls `markTokenUsed` separately after rendering.
 */
export async function getTokenByValue(tokenValue: string): Promise<DalReturn<Row<typeof voipLinkTokens> | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select()
      .from(voipLinkTokens)
      .where(eq(voipLinkTokens.token, tokenValue))
      .limit(1)

    if (!row) {
      return null
    }
    // Hard expiry check — even if usedAt is set, expired rows aren't useful.
    if (new Date(row.expiresAt) < new Date()) {
      return null
    }
    return row
  })
}

/**
 * Mark a token used. Idempotent — the WHERE clause guards against double-
 * setting `usedAt`. Returns rowsAffected so callers can detect re-consume
 * attempts (`rowsAffected === 0` = already used or expired).
 */
export async function markTokenUsed(tokenValue: string): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const result = await db
      .update(voipLinkTokens)
      .set({ usedAt: sql`NOW()` })
      .where(and(
        eq(voipLinkTokens.token, tokenValue),
        isNull(voipLinkTokens.usedAt),
      ))
      .returning({ id: voipLinkTokens.id })

    return { rowsAffected: result.length }
  })
}
