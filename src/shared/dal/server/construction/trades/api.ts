import { db } from '@/shared/db'
import { trades } from '@/shared/db/schema'

export async function getAllTrades() {
  const allTrades = await db.select().from(trades)

  return allTrades
}
