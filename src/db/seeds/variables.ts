import type { DB } from '@/db'

import type { InsertVariable } from '@/db/schema'
import type { TradeAccessor } from '@/db/types/trades'
import { sql } from 'drizzle-orm'

import { variables } from '@/db/schema'

import { variablesData } from './data/variables'

export default async function seed(db: DB) {
  const trades = Object.keys(variablesData) as TradeAccessor[]

  const mappedVariables: InsertVariable[] = []
  for (const trade of trades) {
    const tradeVariables = variablesData[trade]
    for (const variable of tradeVariables) {
      mappedVariables.push({ ...variable })
    }
  }

  await db
    .insert(variables)
    .values(mappedVariables)
    .onConflictDoUpdate({
      target: variables.key,
      set: {
        label: sql`EXCLUDED.label`,
        description: sql`EXCLUDED.description`,
        dataType: sql`EXCLUDED.data_type`,
        options: sql`EXCLUDED.options`,
      },
    })
}
