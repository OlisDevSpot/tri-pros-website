/**
 * One-time backfill: repoint project media rows from the legacy bucket name to
 * the canonical `tpr-media`. Stored `media_files.url` values already use the
 * media.triprosremodeling.com CDN domain (unchanged by the bucket rename), so
 * only the `bucket` column moves. Render derivation (get-optimized-urls) reads
 * `bucket` to pick the CDN domain — this keeps it accurate.
 *
 * Only touches project media (`media_files`). Proposal media
 * (`proposal_media_files`) is migrated in Sub-plan 2.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-media-bucket.ts                     # dev DB (default)
 *   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-media-bucket.ts # prod DB
 *   … --dry-run   # report affected rows, change nothing
 *
 * DB target follows the environment-axes convention (unset never means prod):
 * see docs/codebase-conventions/environment.md#environment-axes
 * Safe to re-run: the WHERE clause only matches rows still on the old bucket.
 */

import './lib/load-env'

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { R2_BUCKETS } from '../src/shared/services/providers/r2/types'

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

const OLD_BUCKET = 'tpr-portfolio-projects'
const NEW_BUCKET = R2_BUCKETS.media // 'tpr-media'

// eslint-disable-next-line node/prefer-global/process
const IS_PROD_TARGET = process.env.DRIZZLE_TARGET === 'prod'
// eslint-disable-next-line node/prefer-global/process
const DATABASE_URL = IS_PROD_TARGET ? process.env.DATABASE_URL : process.env.DATABASE_DEV_URL
if (!DATABASE_URL) {
  console.error(`No database URL for target "${IS_PROD_TARGET ? 'prod' : 'dev'}" — check .env`)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}
console.warn(`[backfill-media-bucket] target=${IS_PROD_TARGET ? 'prod' : 'dev'} host=${new URL(DATABASE_URL).host}`)
console.warn(`[backfill-media-bucket] ${OLD_BUCKET} → ${NEW_BUCKET}${DRY_RUN ? ' (dry-run)' : ''}`)

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function main(): Promise<void> {
  const [counts] = (await db.execute(sql`
    SELECT count(*) AS n FROM media_files WHERE bucket = ${OLD_BUCKET}
  `)).rows
  console.warn(`[backfill-media-bucket] rows on old bucket: ${counts.n}`)

  if (DRY_RUN) {
    console.warn('[backfill-media-bucket] dry-run — no changes made')
    return
  }

  const result = await db.execute(sql`
    UPDATE media_files SET bucket = ${NEW_BUCKET} WHERE bucket = ${OLD_BUCKET}
  `)
  console.warn(`[backfill-media-bucket] updated ${result.rowCount} rows`)

  const [remaining] = (await db.execute(sql`
    SELECT count(*) AS n FROM media_files WHERE bucket = ${OLD_BUCKET}
  `)).rows
  console.warn(`[backfill-media-bucket] rows still on old bucket: ${remaining.n}`)
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err)
    return pool.end().then(() => {
      // eslint-disable-next-line node/prefer-global/process
      process.exit(1)
    })
  })
