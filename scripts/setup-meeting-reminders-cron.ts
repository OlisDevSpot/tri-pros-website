/**
 * One-time setup for the day-before appointment reminder batch.
 *
 * Schedules a recurring QStash POST against `/api/qstash-jobs?job=send-meeting-reminders`
 * at 6 pm Pacific every day. QStash evaluates the cron in the CRON_TZ zone, so DST is
 * handled for us (a Vercel Cron equivalent would drift an hour twice a year).
 *
 * Usage:
 *   pnpm reminders:cron:setup:dev               # dry-run, dev (uses ngrok tunnel)
 *   pnpm reminders:cron:setup:dev -- --apply    # create dev schedule
 *   pnpm reminders:cron:setup                   # dry-run, prod
 *   pnpm reminders:cron:setup -- --apply        # create prod schedule
 *   ... -- --apply --force                      # bypass dupe guard
 */
import process from 'node:process'

import { setupQstashSchedule } from './lib/setup-qstash-schedule'

setupQstashSchedule({
  jobKey: 'send-meeting-reminders',
  cron: 'CRON_TZ=America/Los_Angeles 0 18 * * *',
  cronLabel: 'daily at 6 pm Pacific',
  title: 'SETUP MEETING REMINDERS CRON',
  verifyHints: [
    'Watching the QStash dashboard "Last delivery" timestamp tick over after 6 pm',
    'Checking tomorrow\'s unconfirmed meetings gain a reminder_sent_at, and voip_messages gains outbound rows',
  ],
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
