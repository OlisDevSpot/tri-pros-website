import type { Lead } from '@/shared/db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { leads } from '@/shared/db/schema'

export async function getLeadById(id: string): Promise<Lead | null> {
  const [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1)
  return row ?? null
}
