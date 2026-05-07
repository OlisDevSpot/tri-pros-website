/* eslint-disable no-console */
/**
 * Re-runnable schema-plus-data migration for proposal.kind (issue #92, hotfix
 * to #168).
 *
 * What it does, in a single transaction:
 *   1. Ensure `proposal_kind` enum + `proposals.kind` column exist (idempotent —
 *      no-op on already-migrated DBs, required for prod first-run).
 *   2. Drop the old partial unique index `proposals_one_initial_sale_per_meeting_idx`
 *      if present. Its invariant ("one initial-sale per meeting") was wrong —
 *      a meeting can legitimately have multiple sent/draft initial-sale
 *      attempts (the agent iterating on an offer).
 *   3. Recompute `kind` for every proposal using the corrected rule:
 *        - meeting has no project       → initial-sale
 *        - meeting is the earliest meeting (by created_at) linked to its
 *          project ("birthing meeting") → initial-sale (all proposals on it,
 *          regardless of status)
 *        - otherwise                    → additional-work
 *   4. Pre-flight: assert no meeting has 2+ approved initial-sale proposals
 *      (would block the new index and indicates dirty data).
 *   5. Add the new partial unique index
 *      `proposals_one_approved_initial_sale_per_meeting_idx` —
 *      `(meeting_id) WHERE kind = 'initial-sale' AND status = 'approved'`.
 *      Because all initial-sale proposals for a project live on one (birthing)
 *      meeting, "per meeting" transitively means "per project".
 *
 * Idempotent — safe to re-run. After this completes, `pnpm db:push:dev` should
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
  const isProd = process.env.NODE_ENV === 'production'
  console.log(`NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} → ${isProd ? 'PROD' : 'DEV'} DB`)

  await db.transaction(async (tx) => {
    console.log('\n[1/5] Ensuring proposal_kind enum + kind column exist...')
    await tx.execute(sql`
      DO $$ BEGIN
        CREATE TYPE proposal_kind AS ENUM ('initial-sale', 'additional-work');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await tx.execute(sql`
      ALTER TABLE proposals
        ADD COLUMN IF NOT EXISTS kind proposal_kind NOT NULL DEFAULT 'initial-sale'
    `)

    console.log('[2/5] Dropping old index proposals_one_initial_sale_per_meeting_idx (if present)...')
    await tx.execute(sql`
      DROP INDEX IF EXISTS proposals_one_initial_sale_per_meeting_idx
    `)

    console.log('[3/5] Recomputing kind for all existing proposals...')
    await tx.execute(sql`
      WITH birthing_meetings AS (
        SELECT DISTINCT ON (m.project_id) m.project_id, m.id AS meeting_id
        FROM meetings m
        WHERE m.project_id IS NOT NULL
        ORDER BY m.project_id, m.created_at ASC
      )
      UPDATE proposals p
      SET kind = CASE
        WHEN m.project_id IS NULL          THEN 'initial-sale'::proposal_kind
        WHEN m.id = bm.meeting_id          THEN 'initial-sale'::proposal_kind
        ELSE                                    'additional-work'::proposal_kind
      END
      FROM meetings m
      LEFT JOIN birthing_meetings bm ON bm.project_id = m.project_id
      WHERE p.meeting_id = m.id
    `)

    const totals = await tx.execute(sql`
      SELECT kind, COUNT(*)::int AS count
      FROM proposals
      GROUP BY kind
      ORDER BY kind
    `)
    console.log('       Totals by kind:', totals.rows)

    const cross = await tx.execute(sql`
      SELECT kind, status, COUNT(*)::int AS count
      FROM proposals
      GROUP BY kind, status
      ORDER BY kind, status
    `)
    console.log('       Cross-tab kind × status:', cross.rows)

    console.log('[4/5] Pre-flight: checking for meetings with 2+ approved initial-sale proposals...')
    const dupes = await tx.execute(sql`
      SELECT meeting_id, COUNT(*)::int AS c
      FROM proposals
      WHERE kind = 'initial-sale' AND status = 'approved'
      GROUP BY meeting_id
      HAVING COUNT(*) > 1
    `)
    if (dupes.rows.length > 0) {
      console.error('       Anomaly: meetings with 2+ approved initial-sales:', dupes.rows)
      throw new Error(
        'Found meetings with multiple approved initial-sale proposals. '
        + 'Resolve manually (un-approve the duplicates) before adding the unique index.',
      )
    }

    console.log('[5/5] Creating proposals_one_approved_initial_sale_per_meeting_idx...')
    await tx.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_approved_initial_sale_per_meeting_idx
      ON proposals (meeting_id)
      WHERE kind = 'initial-sale' AND status = 'approved'
    `)

    console.log('\n[done] Migration committed.')
  })

  process.exit(0)
}

main().catch((err) => {
  console.error('\n[migrate] FAILED:', err)
  process.exit(1)
})
