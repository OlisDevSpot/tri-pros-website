/**
 * One-time migration script: generate optimized image variants for all existing media files.
 *
 * For each pending image in the database:
 * 1. Fetches the original from R2
 * 2. Generates 3 WebP size variants (sm/md/lg) + blur placeholder via sharp
 * 3. Uploads variants to R2
 * 4. Updates the DB record with optimizationStatus + blurDataUrl
 *
 * Usage: npx tsx scripts/migrate-optimize-images.ts
 * Requires: DATABASE_URL and R2 credentials in .env
 */

import 'dotenv/config'
import { Buffer } from 'node:buffer'

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import sharp from 'sharp'

// eslint-disable-next-line node/prefer-global/process
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_DEV_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL or DATABASE_DEV_URL is required')
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

// R2 client — duplicated here to avoid importing from app code (path alias issues in scripts)
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

const BUCKET = 'tpr-portfolio-projects'
const CONCURRENCY = 5

const VARIANTS = [
  { suffix: 'sm', width: 640 },
  { suffix: 'md', width: 1280 },
  { suffix: 'lg', width: 1920 },
] as const

async function fetchFromR2(pathKey: string): Promise<Buffer> {
  const response = await r2Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: pathKey }))
  if (!response.Body) {
    throw new Error(`Empty response for ${pathKey}`)
  }
  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}

async function uploadToR2(pathKey: string, buffer: Buffer): Promise<void> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: pathKey,
    Body: buffer,
    ContentType: 'image/webp',
  }))
}

async function processImage(id: number, pathKey: string): Promise<{ blurDataUrl: string }> {
  const original = await fetchFromR2(pathKey)

  const [sm, md, lg, blur] = await Promise.all([
    sharp(original).resize(640).webp({ quality: 80 }).toBuffer(),
    sharp(original).resize(1280).webp({ quality: 80 }).toBuffer(),
    sharp(original).resize(1920).webp({ quality: 80 }).toBuffer(),
    sharp(original).resize(20).webp({ quality: 20 }).toBuffer(),
  ])

  const basePath = pathKey.replace(/\.[^.]+$/, '')
  const variants = [
    { suffix: 'sm', buffer: sm },
    { suffix: 'md', buffer: md },
    { suffix: 'lg', buffer: lg },
  ]

  await Promise.all(variants.map(v => uploadToR2(`${basePath}-${v.suffix}.webp`, v.buffer)))

  return { blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}` }
}

async function migrate() {
  // Query pending image media files using raw SQL (no schema import needed)
  const pending = await db.execute<{ id: number, path_key: string }>(
    sql`SELECT id, path_key FROM media_files WHERE optimization_status = 'pending' AND mime_type LIKE 'image/%' ORDER BY id`,
  )

  const rows = pending.rows ?? pending
  console.log(`Found ${rows.length} images to process\n`)

  let processed = 0
  let failed = 0

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (file) => {
      try {
        // Mark as processing
        await db.execute(sql`UPDATE media_files SET optimization_status = 'processing' WHERE id = ${file.id}`)

        const { blurDataUrl } = await processImage(file.id, file.path_key)

        // Mark as optimized
        await db.execute(sql`UPDATE media_files SET optimization_status = 'optimized', blur_data_url = ${blurDataUrl} WHERE id = ${file.id}`)

        processed++
        console.log(`[${processed + failed}/${rows.length}] ✓ ${file.path_key}`)
      }
      catch (error) {
        failed++
        console.error(`[${processed + failed}/${rows.length}] ✗ ${file.path_key}:`, (error as Error).message)
        await db.execute(sql`UPDATE media_files SET optimization_status = 'failed' WHERE id = ${file.id}`).catch(() => {})
      }
    }))
  }

  console.log(`\nDone! Processed: ${processed}, Failed: ${failed}`)
  await pool.end()
}

migrate().catch(console.error)
