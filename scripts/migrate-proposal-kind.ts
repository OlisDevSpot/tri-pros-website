/* eslint-disable no-console */
/**
 * One-time migration for issue #92: proposal.kind classification.
 *
 *   1. CREATE TYPE proposal_kind
 *   2. ALTER TABLE proposals ADD COLUMN kind ... DEFAULT 'initial-sale'
 *   3. Backfill: per project, the earliest meeting (by scheduled_for, tie-break
 *      created_at) with its earliest-created proposal is initial-sale; every
 *      other proposal is additional-work.
 *   4. CREATE UNIQUE INDEX (meeting_id) WHERE kind = 'initial-sale'
 *
 * Why this exists separately from `db:push:dev` / `db:push`:
 * the schema declares the partial unique index alongside the column, but a
 * straight push would set every existing row to the default 'initial-sale'
 * and then fail the index on any meeting that has 2+ proposals. Running this
 * migration first orders the steps correctly inside a single transaction.
 *
 * Idempotent — safe to re-run. After this completes, drizzle-kit push should
 * report "no changes detected" for the proposals table.
 *
 * Usage:
 *   pnpm migrate:proposal-kind:dev    # dev DB (default NODE_ENV)
 *   pnpm migrate:proposal-kind        # prod DB (sets NODE_ENV=production)
 */
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'

async function main() {
  console.log(`NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} → ${process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'} DB`)

  await db.transaction(async (tx) => {
    console.log('\n[1/4] Creating proposal_kind enum...')
    await tx.execute(sql`
      DO $$ BEGIN
        CREATE TYPE proposal_kind AS ENUM ('initial-sale', 'additional-work');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)

    console.log('[2/4] Adding kind column...')
    await tx.execute(sql`
      ALTER TABLE proposals
        ADD COLUMN IF NOT EXISTS kind proposal_kind NOT NULL DEFAULT 'initial-sale'
    `)

    console.log('[3/4] Backfilling kind...')
    await tx.execute(sql`
      WITH ranked AS (
        SELECT
          p.id,
          DENSE_RANK() OVER (
            PARTITION BY m.project_id
            ORDER BY m.scheduled_for ASC NULLS LAST, m.created_at ASC
          ) AS meeting_rank,
          ROW_NUMBER() OVER (
            PARTITION BY p.meeting_id
            ORDER BY p.created_at ASC
          ) AS proposal_rank
        FROM proposals p
        LEFT JOIN meetings m ON m.id = p.meeting_id
      )
      UPDATE proposals p
      SET kind = CASE
        WHEN r.meeting_rank = 1 AND r.proposal_rank = 1 THEN 'initial-sale'::proposal_kind
        ELSE 'additional-work'::proposal_kind
      END
      FROM ranked r
      WHERE r.id = p.id
    `)

    const counts = await tx.execute(sql`
      SELECT kind, COUNT(*)::int AS count
      FROM proposals
      GROUP BY kind
      ORDER BY kind
    `)
    console.log('       Counts by kind:', counts.rows)

    // Pre-flight check before adding the partial unique index — guarantees
    // we abort the transaction before a CREATE INDEX failure rolls everything
    // back with a less-helpful error message.
    const dupes = await tx.execute(sql`
      SELECT meeting_id, COUNT(*)::int AS c
      FROM proposals
      WHERE kind = 'initial-sale'
      GROUP BY meeting_id
      HAVING COUNT(*) > 1
    `)
    if (dupes.rows.length > 0) {
      console.error('       Backfill anomaly: meetings with >1 initial-sale:', dupes.rows)
      throw new Error('Backfill produced duplicate initial-sale per meeting — aborting before index creation. Investigate the data and re-run.')
    }

    console.log('[4/4] Creating partial unique index proposals_one_initial_sale_per_meeting_idx...')
    await tx.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_initial_sale_per_meeting_idx
      ON proposals (meeting_id)
      WHERE kind = 'initial-sale'
    `)

    console.log('\n[done] Migration committed.')
  })

  process.exit(0)
}

main().catch((err) => {
  console.error('\n[migrate] FAILED:', err)
  process.exit(1)
})
