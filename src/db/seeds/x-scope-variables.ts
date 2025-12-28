import type { DB } from '@/db'
import type { InsertXScopeVariable } from '@/db/schema'

import type { TradeAccessor } from '@/db/types/trades'
import { sql } from 'drizzle-orm'
import { scopes, variables, x_scopeVariables } from '@/db/schema'

import { xScopeVariablesData } from './data/x-scope-variables'

export default async function seed(db: DB) {
  const trades = Object.keys(xScopeVariablesData) as TradeAccessor[]

  const mappedXScopeVariables: InsertXScopeVariable[] = []

  const [allScopes, allVariables] = await Promise.all([
    db.select().from(scopes),
    db.select().from(variables),
  ])

  for (const trade of trades) {
    const tradeVariables = xScopeVariablesData[trade as keyof typeof xScopeVariablesData]
    for (const scopeVariable of tradeVariables) {
      const scopeEntry = allScopes.find(dbScope => dbScope.accessor === scopeVariable.scopeAccessor)
      const variableEntry = allVariables.find(dbVariable => dbVariable.key === scopeVariable.variableKey)

      if (!scopeEntry || !variableEntry)
        continue

      mappedXScopeVariables.push({
        scopeId: scopeEntry.id,
        variableId: variableEntry.id,
      })
    }
  }

  await db
    .insert(x_scopeVariables)
    .values(mappedXScopeVariables)
    .onConflictDoUpdate({
      target: [x_scopeVariables.scopeId, x_scopeVariables.variableId],
      set: {
        scopeId: sql`EXCLUDED.scope_id`,
        variableId: sql`EXCLUDED.variable_id`,
      },
    })
}
