/**
 * One-time migration script: generate optimized image variants for all existing media files.
 *
 * For each pending image in the database:
 * 1. Fetches the original from R2
 * 2. Generates 3 WebP size variants (sm/md/lg) + blur placeholder via sharp
 * 3. Uploads variants to R2
 * 4. Updates the DB record with optimizationStatus + blurDataUrl
 *
 * Usage:
 *   npx tsx scripts/migrate-optimize-images.ts              # process all pending
 *   npx tsx scripts/migrate-optimize-images.ts --dry-run     # preview only, no changes
 *   npx tsx scripts/migrate-optimize-images.ts --limit 10    # process first 10 only
 *
 * Requires: DATABASE_URL (or DATABASE_DEV_URL) and R2 credentials in .env
 *
 * Safe to re-run: only processes images with optimization_status = 'pending'.
 * Images that failed will be marked 'failed' and can be retried by resetting
 * their status to 'pending' in the DB.
 */

import 'dotenv/config'
import { Buffer } from 'node:buffer'

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import sharp from 'sharp'

// ── Config ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line node/prefer-global/process
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? Number.parseInt(args[limitIdx + 1], 10) : undefined
const CONCURRENCY = 3
const WEBP_QUALITY = 72

// eslint-disable-next-line node/prefer-global/process
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_DEV_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL or DATABASE_DEV_URL is required')
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

const r2Client = new S3Client({
  region: 'auto',
  // eslint-disable-next-line node/prefer-global/process
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: false,
  credentials: {
    // eslint-disable-next-line node/prefer-global/process
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    // eslint-disable-next-line node/prefer-global/process
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchFromR2(bucket: string, pathKey: string): Promise<Buffer> {
  const response = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: pathKey }))
  if (!response.Body) {
    throw new Error(`Empty response for ${bucket}/${pathKey}`)
  }
  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}

async function uploadToR2(bucket: string, pathKey: string, buffer: Buffer): Promise<void> {
  await r2Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: pathKey,
    Body: buffer,
    ContentType: 'image/webp',
  }))
}

async function processImage(bucket: string, pathKey: string): Promise<{ blurDataUrl: string }> {
  const original = await fetchFromR2(bucket, pathKey)
  const resizeOpts = { withoutEnlargement: true }

  const [sm, md, lg, blur] = await Promise.all([
    sharp(original).resize(640, undefined, resizeOpts).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(original).resize(1280, undefined, resizeOpts).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(original).resize(1920, undefined, resizeOpts).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(original).resize(20).webp({ quality: 20 }).toBuffer(),
  ])

  const basePath = pathKey.replace(/\.[^.]+$/, '')
  await Promise.all([
    uploadToR2(bucket, `${basePath}-sm.webp`, sm),
    uploadToR2(bucket, `${basePath}-md.webp`, md),
    uploadToR2(bucket, `${basePath}-lg.webp`, lg),
  ])

  return { blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}` }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function migrate() {
  const limitClause = LIMIT ? sql`LIMIT ${LIMIT}` : sql``
  const pending = await db.execute<{ id: number, path_key: string, bucket: string, mime_type: string }>(
    sql`SELECT id, path_key, bucket, mime_type FROM media_files WHERE optimization_status = 'pending' AND mime_type LIKE 'image/%' ORDER BY id ${limitClause}`,
  )

  const rows = pending.rows ?? pending
  console.log(`Found ${rows.length} pending images`)
  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would process:')
    for (const row of rows) {
      console.log(`  ${row.bucket}/${row.path_key} (id: ${row.id})`)
    }
    console.log(`\n[DRY RUN] Total: ${rows.length} images. No changes made.`)
    await pool.end()
    return
  }

  console.log(`Processing with concurrency=${CONCURRENCY}, quality=${WEBP_QUALITY}, withoutEnlargement=true\n`)

  let processed = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (file) => {
      // Skip non-image MIME types that slipped through
      if (!file.mime_type.startsWith('image/')) {
        skipped++
        return
      }

      try {
        await db.execute(sql`UPDATE media_files SET optimization_status = 'processing' WHERE id = ${file.id}`)

        const { blurDataUrl } = await processImage(file.bucket, file.path_key)

        await db.execute(sql`UPDATE media_files SET optimization_status = 'optimized', blur_data_url = ${blurDataUrl} WHERE id = ${file.id}`)

        processed++
        console.log(`[${processed + failed + skipped}/${rows.length}] ✓ ${file.path_key}`)
      }
      catch (error) {
        failed++
        console.error(`[${processed + failed + skipped}/${rows.length}] ✗ ${file.path_key}: ${(error as Error).message}`)
        await db.execute(sql`UPDATE media_files SET optimization_status = 'failed' WHERE id = ${file.id}`).catch(() => {})
      }
    }))
  }

  console.log(`\nDone! Processed: ${processed}, Failed: ${failed}, Skipped: ${skipped}`)
  await pool.end()
}

migrate().catch(console.error)
