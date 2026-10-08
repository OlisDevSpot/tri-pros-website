/**
 * Lists the DIDs the app knows, optionally after pulling them from Twilio, and flags one as the main line.
 * `voip_dids` fills only through a resync; nothing in the app calls it.
 *
 * Usage:
 *   DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --resync
 *   DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --e164 +16265550123
 *   DRIZZLE_TARGET=dev NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/set-main-line.ts --e164 +16265550123 --apply
 *   DRIZZLE_TARGET=prod … (same flags)
 *
 * Dry run unless --apply. The `--conditions=react-server` flag lets the CLI import server-only modules.
 */
import process from 'node:process'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema/voip-dids'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'
import './lib/load-env'

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main() {
  const apply = process.argv.includes('--apply')
  const resync = process.argv.includes('--resync')
  const e164 = flagValue('--e164')

  console.log(`--- MAIN LINE (${process.env.DRIZZLE_TARGET ?? 'dev'}) ---`)
  if (resync) {
    const result = dalVerifySuccess(await voipDidsService.resyncFromTwilio(SYSTEM_CONTEXT))
    console.log(`Resynced from Twilio: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated`)
  }

  const rows = await db.select().from(voipDids).orderBy(voipDids.e164)
  if (rows.length === 0) {
    console.log('No DIDs in the table. Run with --resync first.')
  }
  for (const row of rows) {
    console.log(`${row.isMainLine ? '*' : ' '} ${row.e164}  ${row.label ?? row.cnamDisplayName ?? ''}  active=${row.isActive}  assigned=${row.assignedUserId ?? '-'}`)
  }

  if (!e164) {
    return
  }
  if (!rows.some(row => row.e164 === e164)) {
    console.error(`${e164} is not in the table. Check the number, or run with --resync.`)
    process.exit(1)
  }
  if (!apply) {
    console.log(`Dry run: ${e164} would become the main line. Re-run with --apply.`)
    return
  }
  const row = dalVerifySuccess(await voipDidsService.setMainLine(SYSTEM_CONTEXT, { e164 }))
  console.log(`* ${row.e164} is the main line.`)
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
