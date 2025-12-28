import { db } from '@/db'
import { trades } from '@/db/schema'

export async function getAllTrades() {
  const allTrades = await db.select().from(trades)

  return allTrades
}
