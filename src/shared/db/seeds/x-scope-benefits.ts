import type { DB } from '@/shared/db'

import type { InsertXScopeBenefit } from '@/shared/db/schema'
import type { ScopeAccessor } from '@/shared/db/types'
import { sql } from 'drizzle-orm'

import { benefits, scopes, x_scopeBenefits } from '@/shared/db/schema'

import { scopeBenefitsData } from './data/x-scope-benefits'

export default async function seed(db: DB) {
  const tradeAccessors = Object.keys(scopeBenefitsData) as (keyof typeof scopeBenefitsData)[]

  const [allScopes, allBenefits] = await Promise.all([
    db.select().from(scopes),
    db.select().from(benefits),
  ])

  const mappedXScopeBenefits: InsertXScopeBenefit[] = []

  for (const tradeAccessor of tradeAccessors) {
    const tradeScopes = scopeBenefitsData[tradeAccessor as keyof typeof scopeBenefitsData]

    for (const [scopeAccessor, benefitsByCategory] of Object.entries(tradeScopes)) {
      const scopeEntry = allScopes.find(dbScope => dbScope.accessor === scopeAccessor as ScopeAccessor)

      if (!scopeEntry)
        continue

      for (const benefits of Object.values(benefitsByCategory) as string[]) {
        for (const benefit of benefits) {
          const benefitEntry = allBenefits.find(dbBenefit => dbBenefit.accessor === benefit)

          if (!benefitEntry)
            continue

          mappedXScopeBenefits.push({
            scopeId: scopeEntry.id,
            benefitId: benefitEntry.id,
          })
        }
      }
    }
  }

  await db
    .insert(x_scopeBenefits)
    .values(mappedXScopeBenefits)
    .onConflictDoUpdate({
      target: [x_scopeBenefits.scopeId, x_scopeBenefits.benefitId],
      set: {
        scopeId: sql`EXCLUDED.scope_id`,
        benefitId: sql`EXCLUDED.benefit_id`,
      },
    })
}
