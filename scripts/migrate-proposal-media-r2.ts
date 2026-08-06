/**
 * One-time R2 migration: copy every `proposals/*` object from the private
 * `tpr-homeowner-files` bucket into the canonical public `tpr-media` bucket,
 * preserving keys (originals + -xs/-sm/-md/-lg.webp variants). Server-side
 * CopyObject — bytes never transit this process. Idempotent — re-copying
 * overwrites, so it is safe to run repeatedly as a delta sync.
 *
 * Scoped to the `proposals/` prefix ONLY: `recordings/*` (call recordings) stay
 * private in tpr-homeowner-files and must never be copied.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-proposal-media-r2.ts --dry-run   # list source objects, copy nothing
 *   pnpm tsx scripts/migrate-proposal-media-r2.ts             # copy all proposals/* objects
 */

import './lib/load-env'

import { r2Client } from '../src/shared/services/providers/r2/client'
import { R2_BUCKETS } from '../src/shared/services/providers/r2/types'

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

const SOURCE = R2_BUCKETS.homeownerFiles
const DEST = R2_BUCKETS.media
const PREFIX = 'proposals/'
const CONCURRENCY = 20

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

async function main(): Promise<void> {
  console.warn(`[migrate-proposal-media] ${SOURCE}/${PREFIX} → ${DEST}${DRY_RUN ? ' (dry-run)' : ''}`)

  const keys = await r2Client.listAllKeys(SOURCE, PREFIX)
  console.warn(`[migrate-proposal-media] source has ${keys.length} objects under ${PREFIX}`)

  // Safety: never touch anything outside the proposals/ prefix.
  const stray = keys.filter(k => !k.startsWith(PREFIX))
  if (stray.length > 0) {
    console.error(`[migrate-proposal-media] ABORT — ${stray.length} keys outside ${PREFIX} (e.g. ${stray[0]})`)
    // eslint-disable-next-line node/prefer-global/process
    process.exit(1)
  }

  if (DRY_RUN) {
    for (const key of keys.slice(0, 5)) {
      console.warn(`  sample: ${key}`)
    }
    console.warn('[migrate-proposal-media] dry-run — no objects copied')
    return
  }

  let copied = 0
  await mapLimit(keys, CONCURRENCY, async (key) => {
    await r2Client.copyObject({ sourceBucket: SOURCE, sourceKey: key, destBucket: DEST, destKey: key })
    copied++
    if (copied % 100 === 0) {
      console.warn(`[migrate-proposal-media] copied ${copied}/${keys.length}`)
    }
  })

  const destKeys = await r2Client.listAllKeys(DEST, PREFIX)
  console.warn(`[migrate-proposal-media] done — copied ${copied}; dest now has ${destKeys.length} objects under ${PREFIX} (source had ${keys.length})`)
}

main().catch((err) => {
  console.error(err)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
})
