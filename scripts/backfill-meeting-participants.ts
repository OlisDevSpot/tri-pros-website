/**
 * One-time backfill: populate `meeting_participants` from existing `meetings.owner_id`.
 *
 * Run AFTER the schema push that creates the `meeting_participants` table and
 * BEFORE deploying the new participant-aware code. Without this, the new
 * visibility filter (`userParticipatesInMeeting`) returns false for existing
 * meetings and agents lose visibility of their past meetings.
 *
 * Idempotent — safe to re-run. The partial unique index
 * `meeting_one_owner_idx` rejects duplicates atomically.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-meeting-participants.ts
 */
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'

async function main() {
  console.log('--- BEFORE ---')
  const before = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM meetings WHERE owner_id IS NOT NULL) AS meetings_with_owner,
      (SELECT count(*) FROM meeting_participants WHERE role = 'owner') AS owner_participant_rows
  `)
  console.log(JSON.stringify(before.rows, null, 2))

  console.log('\n--- BACKFILLING ---')
  const result = await db.execute(sql`
    INSERT INTO meeting_participants (id, meeting_id, user_id, role, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      m.id,
      m.owner_id,
      'owner',
      NOW(),
      NOW()
    FROM meetings m
    WHERE m.owner_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING meeting_id
  `)
  console.log(`Inserted ${result.rows.length} owner participant rows.`)

  console.log('\n--- AFTER ---')
  const after = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM meetings WHERE owner_id IS NOT NULL) AS meetings_with_owner,
      (SELECT count(*) FROM meeting_participants WHERE role = 'owner') AS owner_participant_rows
  `)
  console.log(JSON.stringify(after.rows, null, 2))

  const a = after.rows[0] as { meetings_with_owner: string, owner_participant_rows: string }
  if (a.meetings_with_owner !== a.owner_participant_rows) {
    console.error('\nFAIL: counts do not match. Some meetings still lack an owner participant row.')
    process.exit(1)
  }

  console.log('\n--- DUPLICATE CHECK ---')
  const dupes = await db.execute(sql`
    SELECT meeting_id, role, count(*) AS n
    FROM meeting_participants
    GROUP BY meeting_id, role
    HAVING count(*) > 1
  `)
  if (dupes.rows.length > 0) {
    console.error('FAIL: duplicate (meeting_id, role) rows exist:')
    console.error(JSON.stringify(dupes.rows, null, 2))
    process.exit(1)
  }
  console.log('No duplicates.')

  console.log('\nBackfill complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
