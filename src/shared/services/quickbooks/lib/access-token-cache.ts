import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { qbAuthTokens } from '@/shared/db/schema/qb-auth-tokens'

export async function getStoredTokens() {
  const [row] = await db.select().from(qbAuthTokens).limit(1)
  return row ?? null
}

export async function upsertTokens(params: {
  accessToken: string
  refreshToken: string
  realmId: string
  expiresAt: string
}) {
  const existing = await getStoredTokens()

  if (existing) {
    await db.update(qbAuthTokens)
      .set({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        realmId: params.realmId,
        expiresAt: params.expiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(qbAuthTokens.id, existing.id))
  }
  else {
    await db.insert(qbAuthTokens).values(params)
  }
}
