/**
 * One-time backfill: rewrite stored media_files URLs from the Cloudflare
 * r2.dev dev endpoint to the production CDN domain (#160).
 *
 * `media_files.url` (and `thumbnail_url`) persist the absolute public URL at
 * upload time. After swapping `R2_PUBLIC_DOMAINS['tpr-portfolio-projects']`
 * to https://media.triprosremodeling.com, variant URLs (-sm/-md/-lg.webp)
 * auto-follow because they're computed at render time — but the persisted
 * original URLs still point at the rate-limited pub-*.r2.dev host and are
 * used as the render fallback for unoptimized/no-lg records.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-media-url-domain.ts                     # dev DB (default)
 *   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-media-url-domain.ts # prod DB
 *   … --dry-run   # report affected rows, change nothing
 *
 * DB target follows the environment-axes convention (unset never means prod):
 * see docs/codebase-conventions/environment.md#environment-axes
 *
 * Safe to re-run: the WHERE clause only matches rows still on the old domain.
 */

import './lib/load-env'

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '../src/shared/services/providers/r2/types'

// ── Config ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

// The retired dev endpoint this backfill migrates away from. Hardcoded on
// purpose: it no longer exists anywhere in live code after #160.
const OLD_DOMAIN = 'https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev'
const NEW_DOMAIN = R2_PUBLIC_DOMAINS[R2_BUCKETS.portfolioProjects]

if (!NEW_DOMAIN || NEW_DOMAIN.includes('r2.dev')) {
  console.error(`Refusing to run: R2_PUBLIC_DOMAINS['${R2_BUCKETS.portfolioProjects}'] is "${NEW_DOMAIN}" — expected the production CDN domain.`)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}

// Unset never silently means prod: only explicit DRIZZLE_TARGET=prod reaches
// DATABASE_URL. see docs/codebase-conventions/environment.md#environment-axes
// eslint-disable-next-line node/prefer-global/process
const IS_PROD_TARGET = process.env.DRIZZLE_TARGET === 'prod'
// eslint-disable-next-line node/prefer-global/process
const DATABASE_URL = IS_PROD_TARGET ? process.env.DATABASE_URL : process.env.DATABASE_DEV_URL
if (!DATABASE_URL) {
  console.error(`No database URL for target "${IS_PROD_TARGET ? 'prod' : 'dev'}" — check .env`)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}
console.warn(`[backfill-media-url-domain] target=${IS_PROD_TARGET ? 'prod' : 'dev'} host=${new URL(DATABASE_URL).host}`)
console.warn(`[backfill-media-url-domain] ${OLD_DOMAIN} → ${NEW_DOMAIN}${DRY_RUN ? ' (dry-run)' : ''}`)

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

// ── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  const oldPrefix = `${OLD_DOMAIN}/%`

  const [counts] = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE url LIKE ${oldPrefix}) AS url_rows,
      count(*) FILTER (WHERE thumbnail_url LIKE ${oldPrefix}) AS thumbnail_rows
    FROM media_files
  `)).rows

  console.warn(`[backfill-media-url-domain] rows on old domain — url: ${counts.url_rows}, thumbnail_url: ${counts.thumbnail_rows}`)

  if (DRY_RUN) {
    const { rows: samples } = await db.execute(sql`
      SELECT id, bucket, url FROM media_files WHERE url LIKE ${oldPrefix} LIMIT 5
    `)
    for (const row of samples) {
      console.warn(`  sample: [${row.bucket}] ${row.url}`)
    }
    console.warn('[backfill-media-url-domain] dry-run — no changes made')
    return
  }

  // replace() keyed on the trailing slash so only the domain prefix can match
  const urlResult = await db.execute(sql`
    UPDATE media_files
    SET url = replace(url, ${`${OLD_DOMAIN}/`}, ${`${NEW_DOMAIN}/`})
    WHERE url LIKE ${oldPrefix}
  `)
  const thumbResult = await db.execute(sql`
    UPDATE media_files
    SET thumbnail_url = replace(thumbnail_url, ${`${OLD_DOMAIN}/`}, ${`${NEW_DOMAIN}/`})
    WHERE thumbnail_url LIKE ${oldPrefix}
  `)

  console.warn(`[backfill-media-url-domain] updated — url: ${urlResult.rowCount} rows, thumbnail_url: ${thumbResult.rowCount} rows`)

  const [remaining] = (await db.execute(sql`
    SELECT count(*) AS n FROM media_files
    WHERE url LIKE ${oldPrefix} OR thumbnail_url LIKE ${oldPrefix}
  `)).rows
  console.warn(`[backfill-media-url-domain] rows still on old domain: ${remaining.n}`)
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
