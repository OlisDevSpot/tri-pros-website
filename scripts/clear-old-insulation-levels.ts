/**
 * Clears the insulation levels recorded before they were renamed to R-values ('low', 'medium', 'high'), so those
 * customers read as "not sure" and the era guess fills in.
 *
 * Usage:
 *   DRIZZLE_TARGET=dev pnpm tsx scripts/clear-old-insulation-levels.ts
 *   DRIZZLE_TARGET=dev pnpm tsx scripts/clear-old-insulation-levels.ts --apply
 *   DRIZZLE_TARGET=prod … (same flags)
 *
 * Dry run unless --apply.
 */
/* eslint-disable perfectionist/sort-imports -- load-env must run before any module that reads process.env */
import './lib/load-env'
import process from 'node:process'
import { and, count, isNotNull, notInArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { insulationLevels } from '@/shared/modules/construction/core/constants/enums'
import { describeTargetDb } from './lib/describe-target-db'
/* eslint-enable perfectionist/sort-imports */

// A one-time migration: no DAL query finds rows by a value the enum no longer allows.
const OLD_LEVEL = and(isNotNull(customerProfiles.insulationLevel), notInArray(customerProfiles.insulationLevel, [...insulationLevels]))

async function main() {
  const apply = process.argv.includes('--apply')
  const { env, host } = describeTargetDb()
  console.log(`Target: ${env} (${host})`)

  const [{ total }] = await db.select({ total: count() }).from(customerProfiles).where(OLD_LEVEL)
  console.log(`${total} profile(s) hold an insulation level that is no longer valid.`)

  if (!apply) {
    console.log('Dry run. Re-run with --apply to clear them.')
    return
  }
  await db.update(customerProfiles).set({ insulationLevel: null }).where(OLD_LEVEL)
  console.log('Cleared.')
}

main().then(() => process.exit(0), (error) => {
  console.error(error)
  process.exit(1)
})
