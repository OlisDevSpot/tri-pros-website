import type { DB } from '@/shared/db'

import { sql } from 'drizzle-orm'
import { benefitCategories } from '@/shared/db/schema'
import { benefitCategoriesData } from './data/benefit-categories'

export default async function seed(db: DB) {
  await db
    .insert(benefitCategories)
    .values(benefitCategoriesData)
    .onConflictDoUpdate({
      target: benefitCategories.accessor,
      set: {
        label: sql`EXCLUDED.label`,
      },
    })
}
