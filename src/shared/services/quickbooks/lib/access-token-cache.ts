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
  await db.delete(qbAuthTokens)
  await db.insert(qbAuthTokens).values(params)
}
