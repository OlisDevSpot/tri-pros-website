/**
 * One-time R2 migration: copy every object from the legacy
 * `tpr-portfolio-projects` bucket into the canonical `tpr-media` bucket,
 * preserving keys (originals + -sm/-md/-lg.webp variants). Server-side
 * CopyObject, so bytes never transit this process. Idempotent — re-copying
 * overwrites, so it is safe to run repeatedly as a delta sync.
 *
 * Talks to R2 only (no DB), using the same R2_* env creds the app uses.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-r2-bucket.ts --dry-run   # list source objects, copy nothing
 *   pnpm tsx scripts/migrate-r2-bucket.ts             # copy all objects
 */

import './lib/load-env'

import type { R2BucketName } from '../src/shared/services/providers/r2/types'

import { r2Client } from '../src/shared/services/providers/r2/client'
import { R2_BUCKETS } from '../src/shared/services/providers/r2/types'

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

// The legacy bucket is no longer in the R2BucketName union (Task 1 renamed the
// constant). This is a one-time migration off a soon-decommissioned bucket, so
// the S3 API just needs the literal string — the double cast is intentional
// (a direct `as R2BucketName` fails tsc: the literal doesn't overlap the union).
const SOURCE = 'tpr-portfolio-projects' as unknown as R2BucketName
const DEST = R2_BUCKETS.media
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
  console.warn(`[migrate-r2-bucket] ${SOURCE} → ${DEST}${DRY_RUN ? ' (dry-run)' : ''}`)

  const keys = await r2Client.listAllKeys(SOURCE)
  console.warn(`[migrate-r2-bucket] source has ${keys.length} objects`)

  if (DRY_RUN) {
    for (const key of keys.slice(0, 5)) {
      console.warn(`  sample: ${key}`)
    }
    console.warn('[migrate-r2-bucket] dry-run — no objects copied')
    return
  }

  let copied = 0
  await mapLimit(keys, CONCURRENCY, async (key) => {
    await r2Client.copyObject({ sourceBucket: SOURCE, sourceKey: key, destBucket: DEST, destKey: key })
    copied++
    if (copied % 100 === 0) {
      console.warn(`[migrate-r2-bucket] copied ${copied}/${keys.length}`)
    }
  })

  const destKeys = await r2Client.listAllKeys(DEST)
  console.warn(`[migrate-r2-bucket] done — copied ${copied}; dest now has ${destKeys.length} objects (source had ${keys.length})`)
}

main().catch((err) => {
  console.error(err)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
})
