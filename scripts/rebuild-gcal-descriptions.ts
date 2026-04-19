/**
 * One-time re-push: update every synced meeting's GCal event so its
 * description picks up the new `/schedule?highlightMeeting=...&highlightDate=...`
 * deep link (replacing the legacy `/dashboard/meetings/:id` link).
 *
 * Run ONCE after deploying the meeting polish batch (PR #84). The
 * centralized `pushToGCal` path for meetings always calls updateEvent when
 * `gcalEventId` is already set, so re-pushing rewrites the description
 * (plus every other field) from the current DB state.
 *
 * Idempotent — safe to re-run. Every run re-sends the same payload.
 *
 * Throttled to 10 req/sec (well under Google Calendar's 100/sec hard quota)
 * so it won't trigger rate limiting even on large datasets.
 *
 * Usage:
 *   pnpm tsx scripts/rebuild-gcal-descriptions.ts
 *   pnpm tsx scripts/rebuild-gcal-descriptions.ts --dry-run
 */
import 'dotenv/config'
import { isNotNull } from 'drizzle-orm'
import { getSystemOwnerId } from '@/shared/dal/server/users/system'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { schedulingService } from '@/shared/services/scheduling.service'

const THROTTLE_MS = 100

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`--- REBUILD GCAL DESCRIPTIONS${dryRun ? ' (dry run)' : ''} ---`)

  const systemOwnerId = await getSystemOwnerId()

  const rows = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(isNotNull(meetings.gcalEventId))

  console.log(`Found ${rows.length} synced meetings to re-push.`)

  if (dryRun) {
    console.log('Dry run — no GCal updates will be made. Exiting.')
    process.exit(0)
  }

  if (rows.length === 0) {
    console.log('Nothing to do.')
    process.exit(0)
  }

  let success = 0
  let failed = 0

  for (const [index, m] of rows.entries()) {
    try {
      await schedulingService.pushToGCal(systemOwnerId, 'meeting', m.id)
      success += 1
    }
    catch (err) {
      failed += 1
      console.error(`[${index + 1}/${rows.length}] FAILED meeting ${m.id}:`, err instanceof Error ? err.message : err)
    }

    if ((index + 1) % 10 === 0 || index + 1 === rows.length) {
      console.log(`Progress: ${index + 1}/${rows.length}  (ok: ${success}, failed: ${failed})`)
    }

    await new Promise(resolve => setTimeout(resolve, THROTTLE_MS))
  }

  console.log('')
  console.log('--- RESULT ---')
  console.log(`Success: ${success}`)
  console.log(`Failed:  ${failed}`)

  if (failed > 0) {
    console.log('')
    console.log('Failed meetings were logged above. Re-run the script to retry — the updateEvent call is idempotent.')
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
