import type { DB } from '@/shared/db'

import { sql } from 'drizzle-orm'

import { materials } from '@/shared/db/schema'

import { materialsData } from './data/materials'

export default async function seed(db: DB) {
  await db
    .insert(materials)
    .values(materialsData)
    .onConflictDoUpdate({
      target: [materials.accessor],
      set: {
        label: sql`EXCLUDED.label`,
        description: sql`EXCLUDED.description`,
        outcomeStatement: sql`EXCLUDED.outcome_statement`,
        imageUrl: sql`EXCLUDED.image_url`,
        lifespan: sql`EXCLUDED.lifespan`,
        warranty: sql`EXCLUDED.warranty`,
      },
    })
}
