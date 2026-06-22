/**
 * One-time setup for the Google Calendar renewal cron.
 *
 * Schedules a recurring QStash POST against `/api/qstash-jobs?job=sync-calendars`
 * so that `syncCalendarsJob` fires automatically. The job loops every account
 * with a linked GCal calendar and:
 *   1. Pulls inbound changes (catches edits made directly in the GCal UI),
 *   2. Renews each account's webhook channel if it's within 24h of expiry.
 *
 * Without this schedule, channels expire on a 7-day max and inbound webhooks
 * silently stop firing — which is the failure mode behind the "two-way
 * datetime sync used to work, now broken" report.
 *
 * Cadence: every 12 hours (see CRON below). The renewal-eligibility window
 * is 24h pre-expiry, so any cadence ≤24h keeps channels evergreen; 12h
 * leaves headroom for a missed tick.
 *
 * Run once per environment. Idempotent in the sense that the script lists
 * existing schedules pointing at the same destination URL before creating;
 * if one already exists the script bails (delete the old one in the QStash
 * dashboard, or run with `--force` to create a duplicate).
 *
 * Usage:
 *   pnpm gcal:cron:setup:dev               # dry-run, dev (uses ngrok tunnel)
 *   pnpm gcal:cron:setup:dev -- --apply    # create dev schedule
 *   pnpm gcal:cron:setup                   # dry-run, prod
 *   pnpm gcal:cron:setup -- --apply        # create prod schedule
 *   ... -- --apply --force                 # bypass dupe guard
 *
 * URL resolution:
 *   - NODE_ENV=production → uses `PROD_BASE_URL` from roots.ts (the
 *     canonical constant derived from `APP_HOSTS.prod[0]`). Bypasses
 *     publicUrl() entirely so this script can be run from a dev
 *     box (where NGROK_URL or a dev NEXT_PUBLIC_BASE_URL would otherwise
 *     leak in) and still target the real prod endpoint.
 *   - NODE_ENV=development → uses `publicUrl()`, which returns
 *     `NGROK_URL ?? NEXT_PUBLIC_BASE_URL`. The dev script runs through
 *     ngrok so QStash can deliver to the local app.
 *
 * Safety guards:
 *   - QSTASH_TOKEN unset → server-env.ts crashes the import, before any call.
 *   - NODE_ENV=production AND resolved URL contains "ngrok"|"localhost"|
 *     "127.0.0.1" → refuse. Defends against future changes to APP_HOSTS.prod
 *     that would put a non-public host into PROD_BASE_URL.
 *   - dev mode AND resolved URL is plain http://localhost → refuse with a
 *     hint to start ngrok. QStash cannot deliver to localhost.
 *
 * The `--conditions=react-server` Node flag (set by the pnpm script) makes
 * `server-only` resolve to its no-op `empty.js` export, which lets this CLI
 * import the `qstashClient` provider without the Next.js webpack alias that
 * normally provides that behavior inside the running app.
 */
import './lib/load-env'

import { publicUrl } from '@/shared/config/public-url'
import { PROD_BASE_URL } from '@/shared/config/roots'
import { qstashClient } from '@/shared/services/providers/upstash/qstash-client'

const CRON = '0 */12 * * *'
const JOB_KEY = 'sync-calendars'

function assertReachableDestination(url: string, isProd: boolean): void {
  const looksDev = /ngrok|localhost|127\.0\.0\.1/i.test(url)
  if (isProd && looksDev) {
    console.error('')
    console.error(`✗ Refusing: NODE_ENV=production but resolved URL looks dev-ish: ${url}`)
    console.error('  This usually means .env.local has NGROK_URL set and is leaking into a prod')
    console.error('  invocation. Run from an environment where only NEXT_PUBLIC_BASE_URL (the prod')
    console.error('  origin) is exported, or unset NGROK_URL for this invocation.')
    process.exit(1)
  }
  if (!isProd && url.startsWith('http://')) {
    console.error('')
    console.error(`✗ Refusing: resolved URL is plain HTTP: ${url}`)
    console.error('  QStash only delivers to HTTPS endpoints and cannot reach localhost. Start')
    console.error('  the ngrok tunnel (`pnpm tunnel`) so NGROK_URL is populated, then re-run.')
    process.exit(1)
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')

  const isProd = process.env.NODE_ENV === 'production'
  // Prod path skips publicUrl() so dev-box invocations don't pick up
  // NGROK_URL or a dev-shaped NEXT_PUBLIC_BASE_URL from .env.local.
  const baseUrl = isProd ? PROD_BASE_URL : publicUrl()
  const destination = `${baseUrl}/api/qstash-jobs?job=${JOB_KEY}`

  console.log('--- SETUP GCAL RENEWAL CRON ---')
  console.log(`Mode:        ${apply ? 'APPLY' : 'dry-run (pass --apply to create)'}`)
  console.log(`NODE_ENV:    ${process.env.NODE_ENV ?? '(unset)'}`)
  console.log(`Base URL:    ${baseUrl}`)
  console.log(`Destination: ${destination}`)
  console.log(`Cron:        ${CRON} (every 12h)`)
  console.log('')

  assertReachableDestination(baseUrl, isProd)

  // List existing schedules and warn on duplicates before mutating.
  const existing = await qstashClient.schedules.list()
  const dupes = existing.filter(s => s.destination === destination)

  if (dupes.length > 0) {
    console.warn(`⚠️  Found ${dupes.length} existing schedule(s) pointing at this destination:`)
    for (const s of dupes) {
      console.warn(`   - scheduleId=${s.scheduleId}  cron="${s.cron}"  paused=${s.isPaused}`)
    }
    if (!force) {
      console.warn('')
      console.warn('Refusing to create a duplicate. Delete the existing schedule in the')
      console.warn('QStash dashboard (https://console.upstash.com/qstash) or re-run with')
      console.warn('--force to create another. Aborting.')
      process.exit(1)
    }
    console.warn('--force set — proceeding to create another anyway.')
    console.warn('')
  }

  if (!apply) {
    console.log('Dry run — no schedule created. Re-run with --apply to commit.')
    process.exit(0)
  }

  const result = await qstashClient.schedules.create({
    destination,
    cron: CRON,
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  })

  console.log('')
  console.log('--- CREATED ---')
  console.log(`scheduleId: ${result.scheduleId}`)
  console.log('')
  console.log('Verify the next tick fires by either:')
  console.log('  - Watching the QStash dashboard "Last delivery" timestamp tick over')
  console.log('  - Calling scheduleRouter.sync.systemOwnerHealth and confirming')
  console.log('    channelExpiresAt advances ~7d every 12h')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
