import type { DB } from '@/db'

import { eq, sql } from 'drizzle-orm'

import { addons, trades } from '@/db/schema'
import { addonsData } from './data/addons'

export default async function seed(db: DB) {
  const newAddons = await Promise.all(
    addonsData.map(async (addon) => {
      const tradeEntry = await db.query.trades.findFirst({
        where: eq(trades.accessor, addon.tradeAccessor),
      })
      const tradeId = tradeEntry?.id || -1
      return {
        ...addon,
        tradeId,
      }
    }),

  )
  await db
    .insert(addons)
    .values(newAddons)
    .onConflictDoUpdate({
      target: addons.accessor,
      set: {
        label: sql`EXCLUDED.label`,
        description: sql`EXCLUDED.description`,
        outcomeStatement: sql`EXCLUDED.outcome_statement`,
        imageUrl: sql`EXCLUDED.image_url`,
        tradeId: sql`EXCLUDED.trade_id`,
      },
    })
}
