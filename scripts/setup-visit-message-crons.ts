/**
 * Creates the two QStash schedules that run the automatic visit texts. The cron expressions come from
 * VISIT_MESSAGE_SCHEDULE, so what the dashboard shows is what runs. Dry run unless --apply; refuses a
 * duplicate unless --force.
 *
 *   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/setup-visit-message-crons.ts            # dev, via the tunnel
 *   DRIZZLE_TARGET=prod NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/setup-visit-message-crons.ts --apply
 */
/* eslint-disable perfectionist/sort-imports -- load-env must run before any module that reads process.env */
import './lib/load-env'
import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'
import process from 'node:process'
import { publicUrl } from '@/shared/config/public-url'
import { APP_HOSTS } from '@/shared/config/roots'
import { BUSINESS_TIMEZONE } from '@/shared/lib/business-time'
import { pausableVisitMessageKinds } from '@/shared/modules/meetings/messages/constants/kinds'
import { VISIT_MESSAGE_SCHEDULE } from '@/shared/modules/meetings/messages/constants/schedule'
import { sendDayBeforeRemindersJob } from '@/shared/services/providers/upstash/jobs/send-day-before-reminders'
import { sendRepConfirmationsJob } from '@/shared/services/providers/upstash/jobs/send-rep-confirmations'
import { qstashClient } from '@/shared/services/providers/upstash/qstash-client'
/* eslint-enable perfectionist/sort-imports */

const JOB_KEYS: Record<PausableVisitMessageKind, string> = {
  day_before_reminder: sendDayBeforeRemindersJob.key,
  rep_confirmation: sendRepConfirmationsJob.key,
}

const PROD_BASE_URL = `https://${APP_HOSTS.prod[0]}`

function cronFor(kind: PausableVisitMessageKind): string {
  const { hour, minute } = VISIT_MESSAGE_SCHEDULE[kind]
  return `CRON_TZ=${BUSINESS_TIMEZONE} ${minute} ${hour} * * *`
}

function assertReachableDestination(url: string, isProd: boolean): void {
  const looksDev = /ngrok|localhost|127\.0\.0\.1/i.test(url)
  if (isProd && looksDev) {
    console.error(`Refusing: DRIZZLE_TARGET=prod but the resolved URL looks dev-ish: ${url}`)
    process.exit(1)
  }
  if (!isProd && url.startsWith('http://')) {
    console.error(`Refusing: QStash cannot deliver to plain HTTP (${url}). Start the tunnel (pnpm tunnel) first.`)
    process.exit(1)
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')
  const isProd = process.env.DRIZZLE_TARGET === 'prod'
  const baseUrl = isProd ? PROD_BASE_URL : publicUrl()

  console.log('--- VISIT MESSAGE SCHEDULES ---')
  console.log(`Mode:     ${apply ? 'APPLY' : 'dry run (pass --apply to create)'}`)
  console.log(`Base URL: ${baseUrl}`)
  assertReachableDestination(baseUrl, isProd)

  const existing = await qstashClient.schedules.list()
  for (const kind of pausableVisitMessageKinds) {
    const destination = `${baseUrl}/api/qstash-jobs?job=${JOB_KEYS[kind]}`
    const cron = cronFor(kind)
    console.log('')
    console.log(`${kind}: "${cron}" -> ${destination}`)

    const dupes = existing.filter(schedule => schedule.destination === destination)
    if (dupes.length > 0 && !force) {
      for (const schedule of dupes) {
        console.warn(`  exists: scheduleId=${schedule.scheduleId} cron="${schedule.cron}" paused=${schedule.isPaused}`)
      }
      console.warn('  skipped (delete it in the QStash console, or pass --force)')
      continue
    }
    if (!apply) {
      console.log('  dry run')
      continue
    }
    const result = await qstashClient.schedules.create({
      destination,
      cron,
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    console.log(`  created: scheduleId=${result.scheduleId}`)
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
