/**
 * Drives the visit-message verbs without the dashboard, for dev checks. Sends are real: outside production
 * every text goes to VOIP_DEV_OVERRIDE_NUMBER and every email to EMAIL_DEV_OVERRIDE.
 *
 * Runs without the react-server condition (it renders React email, which that condition forbids); the preload stubs `server-only`.
 *
 *   pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/visit-messages.ts summary --meeting <id> [--note "..."]
 */
/* eslint-disable perfectionist/sort-imports -- load-env must run before any module that reads process.env */
import './lib/load-env'
import process from 'node:process'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
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
    default:
      console.error('Usage: visit-messages.ts summary --meeting <id> [--note "..."]')
      process.exit(1)
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
