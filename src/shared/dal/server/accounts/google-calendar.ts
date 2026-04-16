import type { account } from '@/shared/db/schema/auth'

import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { account as accountTable } from '@/shared/db/schema/auth'

export type AccountRow = typeof account.$inferSelect

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getGoogleAccountForUser(userId: string): Promise<AccountRow | undefined> {
  return db.query.account.findFirst({
    where: and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'google')),
  })
}

export async function getAccountByChannelId(channelId: string): Promise<AccountRow | undefined> {
  return db.query.account.findFirst({
    where: eq(accountTable.gcalChannelId, channelId),
  })
}

export async function getAccountsWithGCalEnabled(): Promise<{ userId: string }[]> {
  return db
    .select({ userId: accountTable.userId })
    .from(accountTable)
    .where(isNotNull(accountTable.gcalCalendarId))
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function updateAccountGCalFields(
  accountId: string,
  fields: Partial<Pick<AccountRow, 'accessToken' | 'accessTokenExpiresAt' | 'gcalCalendarId' | 'gcalChannelExpiry' | 'gcalChannelId' | 'gcalSyncToken'>>,
): Promise<void> {
  await db.update(accountTable)
    .set(fields)
    .where(eq(accountTable.id, accountId))
}

export async function clearAccountGCalFields(accountId: string): Promise<void> {
  await db.update(accountTable)
    .set({
      gcalCalendarId: null,
      gcalSyncToken: null,
      gcalChannelId: null,
      gcalChannelExpiry: null,
    })
    .where(eq(accountTable.id, accountId))
}
