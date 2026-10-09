/**
 * Drives the visit-message verbs without the dashboard, for dev checks. Sends are real: outside production
 * every text goes to VOIP_DEV_OVERRIDE_NUMBER and every email to EMAIL_DEV_OVERRIDE.
 *
 * Runs without the react-server condition (it renders React email, which that condition forbids); the preload stubs `server-only`.
 *
 *   pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/visit-messages.ts summary --meeting <id> [--note "..."]
 *   pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/visit-messages.ts run --kind day_before_reminder [--at 2026-10-09T01:00:00Z]
 */
/* eslint-disable perfectionist/sort-imports -- load-env must run before any module that reads process.env */
import './lib/load-env'
import process from 'node:process'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { pausableVisitMessageKinds } from '@/shared/modules/meetings/messages/constants/kinds'
import { meetingService } from '@/shared/modules/meetings/service'
/* eslint-enable perfectionist/sort-imports */

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function requireFlag(name: string): string {
  const value = flagValue(name)
  if (!value) {
    console.error(`Missing ${name}`)
    process.exit(1)
  }
  return value
}

async function main() {
  const command = process.argv[2]
  switch (command) {
    case 'summary': {
      const meetingId = requireFlag('--meeting')
      const result = dalVerifySuccess(await meetingService.business.sendVisitSummary(SYSTEM_CONTEXT, { meetingId, note: flagValue('--note') }))
      console.log(`sms:   ${result.sms.status}${result.sms.reason ? ` (${result.sms.reason})` : ''}`)
      console.log(`email: ${result.email.status}${result.email.reason ? ` (${result.email.reason})` : ''}`)
      return
    }
    case 'run': {
      const kind = requireFlag('--kind')
      if (!(pausableVisitMessageKinds as readonly string[]).includes(kind)) {
        console.error(`--kind must be one of ${pausableVisitMessageKinds.join(', ')}`)
        process.exit(1)
      }
      // --at is the delivery instant to pretend, e.g. 2026-10-09T01:00:00Z for 6 PM Pacific on Oct 8.
      const at = flagValue('--at')
      const now = at ? new Date(at) : new Date()
      const report = dalVerifySuccess(kind === 'day_before_reminder'
        ? await meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT, { now })
        : await meetingService.business.sendRepConfirmations(SYSTEM_CONTEXT, { now }))
      console.log(JSON.stringify(report, null, 2))
      return
    }
    default:
      console.error('Usage: visit-messages.ts summary --meeting <id> [--note "..."] | run --kind day_before_reminder|rep_confirmation [--at <iso instant>]')
      process.exit(1)
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
