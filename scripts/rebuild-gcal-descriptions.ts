/**
 * Rebuild every synced meeting's GCal event description from the current DB
 * state, and self-heal any meetings whose gcal_event_id points at a deleted
 * GCal event.
 *
 * Originally written to migrate the GCal description deep link from
 * `/dashboard/meetings/:id` to `/schedule?highlightMeeting=...&highlightDate=...`
 * (PR #84 meeting polish batch). Also useful any time a meeting field that
 * feeds buildMeetingDescription changes and every existing event needs to
 * pick up the new payload.
 *
 * Idempotent — safe to re-run. Every run re-sends the same payload.
 *
 * Self-heal behavior on per-meeting errors:
 *   - 404/410 → GCal event is gone (deleted manually or lost in a prior
 *     sync). Clears gcal_event_id/etag/synced_at so the meeting is treated
 *     as unsynced on next push (will create a fresh event).
 *   - 412 → If-Match precondition failed (DB etag stale vs live event).
 *     Clears only the etag so the next push sends an unconditional PUT.
 *     The event linkage is preserved; re-run the script to finish.
 *   - Anything else (network, auth, permission) → logged and counted as
 *     `failed`. Re-run to retry.
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
import { clearMeetingGCalFields, updateMeetingGCalFields } from '@/shared/dal/server/meetings/google-calendar'
import { getSystemOwnerId } from '@/shared/dal/server/users/system'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { schedulingService } from '@/shared/services/scheduling.service'

const THROTTLE_MS = 100

/**
 * Extract the HTTP status code from a Google Calendar client error message.
 * The client wraps all non-2xx responses as:
 *   `Google Calendar ${op} failed (${status}): ${body}`
 * So a simple regex recovers the code. Returns null if the error isn't one
 * we can classify (e.g. network failure, auth error, unknown shape).
 */
function extractGcalStatus(err: unknown): number | null {
  if (!(err instanceof Error)) {
    return null
  }
  const match = err.message.match(/failed \((\d{3})\)/)
  return match ? Number.parseInt(match[1]!, 10) : null
}

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
  let orphanCleaned = 0
  let etagCleared = 0
  let failed = 0

  for (const [index, m] of rows.entries()) {
    try {
      await schedulingService.pushToGCal(systemOwnerId, 'meeting', m.id)
      success += 1
    }
    catch (err) {
      const status = extractGcalStatus(err)
      if (status === 404 || status === 410) {
        // Event no longer exists on Google — either deleted manually in the
        // GCal UI or a previous sync cycle dropped it. DB's gcalEventId is
        // pointing at a ghost. Clear the fields so future pushes treat this
        // meeting as unsynced (create instead of update).
        await clearMeetingGCalFields(m.id)
        orphanCleaned += 1
        console.warn(`[${index + 1}/${rows.length}] ORPHAN ${status} for meeting ${m.id} — cleared gcal_event_id/etag/synced_at`)
      }
      else if (status === 412) {
        // If-Match precondition failed — DB etag is stale against the live
        // event. Clearing just the etag lets the next push send an
        // unconditional PUT that succeeds, without losing the event linkage.
        await updateMeetingGCalFields(m.id, { gcalEtag: null })
        etagCleared += 1
        console.warn(`[${index + 1}/${rows.length}] STALE ETAG 412 for meeting ${m.id} — cleared etag; will succeed on next run`)
      }
      else {
        failed += 1
        console.error(`[${index + 1}/${rows.length}] FAILED meeting ${m.id}${status ? ` (HTTP ${status})` : ''}:`, err instanceof Error ? err.message : err)
      }
    }

    if ((index + 1) % 10 === 0 || index + 1 === rows.length) {
      console.log(`Progress: ${index + 1}/${rows.length}  (ok: ${success}, orphan: ${orphanCleaned}, etag: ${etagCleared}, failed: ${failed})`)
    }

    await new Promise(resolve => setTimeout(resolve, THROTTLE_MS))
  }

  console.log('')
  console.log('--- RESULT ---')
  console.log(`Success:        ${success}`)
  console.log(`Orphans cleaned: ${orphanCleaned}  (DB gcal_event_id pointed at a deleted GCal event — now NULL)`)
  console.log(`Stale etags:     ${etagCleared}  (etag cleared — re-run to finish the update)`)
  console.log(`Other failures:  ${failed}  (network/auth/permission — investigate logs above)`)

  if (etagCleared > 0) {
    console.log('')
    console.log(`Re-run the script to finish ${etagCleared} stale-etag meeting(s). Their events still exist; they just need an unconditional PUT.`)
  }

  if (failed > 0) {
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
