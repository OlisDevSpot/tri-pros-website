import type { DB } from '@/shared/db'

import { sql } from 'drizzle-orm'

import { trades } from '@/shared/db/schema'

import { tradesData } from './data/trades'

export default async function seed(db: DB) {
  await db
    .insert(trades)
    .values(tradesData)
    .onConflictDoUpdate({
      target: trades.accessor,
      set: {
        label: sql`EXCLUDED.label`,
        description: sql`EXCLUDED.description`,
        outcomeStatement: sql`EXCLUDED.outcome_statement`,
        imageUrl: sql`EXCLUDED.image_url`,
        location: sql`EXCLUDED.location`,
        slug: sql`EXCLUDED.slug`,
      },
    })
}
