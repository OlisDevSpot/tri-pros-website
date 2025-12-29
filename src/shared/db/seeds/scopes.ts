import type { DB } from '@/shared/db'

import type { InsertScope } from '@/shared/db/schema'
import type { TradeAccessor } from '@/shared/db/types/trades'
import { sql } from 'drizzle-orm'

import { scopes, trades } from '@/shared/db/schema'

import { scopesData } from './data/scopes'

export default async function seed(db: DB) {
  const tradeAccessors = Object.keys(scopesData) as TradeAccessor[]
  const mappedScopes: InsertScope[] = []
  const allTrades = await db.select().from(trades)

  for (const tradeAccessor of tradeAccessors) {
    const tradeScopes = scopesData[tradeAccessor]
    const tradeEntry = allTrades.find(trade => trade.accessor === tradeAccessor)

    if (!tradeEntry || tradeScopes.length === 0)
      continue

    for (const scope of tradeScopes) {
      mappedScopes.push({ ...scope, tradeId: tradeEntry.id })
    }
  }

  await db
    .insert(scopes)
    .values(mappedScopes)
    .onConflictDoUpdate({
      target: scopes.accessor,
      set: {
        tradeId: sql`EXCLUDED.trade_id`,
        label: sql`EXCLUDED.label`,
        description: sql`EXCLUDED.description`,
        outcomeStatement: sql`EXCLUDED.outcome_statement`,
        imageUrl: sql`EXCLUDED.image_url`,
        constructionType: sql`EXCLUDED.construction_type`,
        scopeOfWorkBase: sql`EXCLUDED.scope_of_work_base`,
        homeArea: sql`EXCLUDED.home_areas`,
      },
    })
}
