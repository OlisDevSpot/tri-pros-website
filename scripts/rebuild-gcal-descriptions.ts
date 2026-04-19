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
 * Usage (pnpm scripts set the required NODE_OPTIONS flag):
 *   pnpm rebuild:gcal:dev -- --dry-run   # dev DB, count only
 *   pnpm rebuild:gcal:dev                # dev DB, real run
 *   pnpm rebuild:gcal -- --dry-run       # prod DB, count only
 *   pnpm rebuild:gcal                    # prod DB, real run
 *
 * The `--conditions=react-server` Node flag (set by the pnpm scripts) makes
 * `server-only` resolve to its no-op `empty.js` export, which lets this CLI
 * import `schedulingService` — and its transitive `server-only` imports —
 * without needing the Next.js webpack alias that normally provides that
 * behavior inside the running app.
 */
import 'dotenv/config'
import { isNotNull } from 'drizzle-orm'
import { getSystemOwnerId } from '@/shared/dal/server/users/system'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { schedulingService } from '@/shared/services/scheduling.service'

const THROTTLE_MS = 100

/**
 * The runtime DB client at src/shared/db/index.ts picks between DATABASE_URL
 * (prod) and DATABASE_DEV_URL based on NODE_ENV, NOT DRIZZLE_TARGET. That
 * makes it easy to accidentally run this against the wrong DB. Surface the
 * exact host + NODE_ENV at the start of every run so the operator can abort
 * if it's not what they expected.
 */
function describeTargetDb(): { env: string, host: string } {
  const nodeEnv = process.env.NODE_ENV ?? '(unset)'
  const isProd = process.env.NODE_ENV === 'production'
  const raw = isProd
    ? process.env.DATABASE_URL
    : (process.env.DATABASE_DEV_URL ?? process.env.DATABASE_URL)
  let host = '(unknown)'
  if (raw) {
    try {
      host = new URL(raw).host
    }
    catch {
      host = '(unparseable)'
    }
  }
  return { env: nodeEnv, host }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const { env, host } = describeTargetDb()

  console.log(`--- REBUILD GCAL DESCRIPTIONS${dryRun ? ' (dry run)' : ''} ---`)
  console.log(`NODE_ENV: ${env}`)
  console.log(`DB host:  ${host}`)
  console.log('')

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
