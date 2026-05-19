import { eq } from 'drizzle-orm'

import { SYSTEM_OWNER_EMAIL } from '@/shared/constants/system-users'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'

let cachedSystemOwnerId: string | null = null

export async function getSystemOwnerId(): Promise<string> {
  if (cachedSystemOwnerId) {
    return cachedSystemOwnerId
  }

  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, SYSTEM_OWNER_EMAIL))
    .limit(1)

  if (!row) {
    throw new Error(`System owner user not found: ${SYSTEM_OWNER_EMAIL}`)
  }

  cachedSystemOwnerId = row.id
  return row.id
}
