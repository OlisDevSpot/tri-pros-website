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
 * silently stop firing.
 *
 * Cadence: every 12 hours. The renewal-eligibility window is 24h pre-expiry, so
 * any cadence ≤24h keeps channels evergreen; 12h leaves headroom for a missed tick.
 *
 * Usage:
 *   pnpm gcal:cron:setup:dev               # dry-run, dev (uses ngrok tunnel)
 *   pnpm gcal:cron:setup:dev -- --apply    # create dev schedule
 *   pnpm gcal:cron:setup                   # dry-run, prod
 *   pnpm gcal:cron:setup -- --apply        # create prod schedule
 *   ... -- --apply --force                 # bypass dupe guard
 *
 * The `--conditions=react-server` Node flag (set by the pnpm script) makes
 * `server-only` resolve to its no-op export, which lets this CLI import the
 * `qstashClient` provider outside the Next.js webpack alias.
 */
import process from 'node:process'

import { setupQstashSchedule } from './lib/setup-qstash-schedule'

setupQstashSchedule({
  jobKey: 'sync-calendars',
  cron: '0 */12 * * *',
  cronLabel: 'every 12h',
  title: 'SETUP GCAL RENEWAL CRON',
  verifyHints: [
    'Watching the QStash dashboard "Last delivery" timestamp tick over',
    'Calling scheduleRouter.sync.systemOwnerHealth and confirming channelExpiresAt advances ~7d every 12h',
  ],
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
