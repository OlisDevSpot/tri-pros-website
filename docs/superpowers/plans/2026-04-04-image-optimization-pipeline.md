# Image Optimization Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 3 WebP size variants + blur placeholder at upload time via QStash, serve via `<OptimizedImage>` with browser-native srcSet.

**Architecture:** Images upload to R2 as before. A QStash job processes each image with `sharp` to produce sm/md/lg WebP variants + a base64 blur placeholder. The `<OptimizedImage>` component renders srcSet for optimized images and falls back to the original for unprocessed ones.

**Tech Stack:** sharp, QStash (Upstash), R2 (Cloudflare), Drizzle ORM, React

**Spec:** `docs/superpowers/specs/2026-04-04-image-optimization-pipeline-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/db/schema/media-files.ts` | Modify | Add `optimizationStatus` + `blurDataUrl` columns |
| `src/shared/services/r2/lib/get-object.ts` | Create | Fetch object buffer from R2 |
| `src/shared/services/r2/lib/process-image-variants.ts` | Create | Sharp resize + WebP conversion |
| `src/shared/services/upstash/jobs/optimize-image.ts` | Create | QStash job: fetch → process → upload variants → update DB |
| `src/app/api/qstash-jobs/route.ts` | Modify | Register the optimize-image job |
| `src/shared/components/optimized-image.tsx` | Create | `<OptimizedImage>` with srcSet + blur-up |
| `src/shared/lib/get-optimized-urls.ts` | Create | Derive variant URLs from pathKey |
| `next.config.ts` | Modify | Remove custom loader, set `unoptimized: true` |
| `src/shared/lib/cloudflare-image-loader.ts` | Delete | No longer needed |
| `src/trpc/routers/projects.router.ts` | Modify | Dispatch QStash job after createMediaFile + uploadFromDriveFile |
| `scripts/migrate-optimize-images.ts` | Create | One-time migration for existing images |
| ~15 showroom/portfolio components | Modify | Swap `<Image>` to `<OptimizedImage>` for media files |

---

### Task 1: Schema — Add optimization columns to mediaFiles

**Files:**
- Modify: `src/shared/db/schema/media-files.ts`

- [ ] **Step 1: Add columns**

Add after line 27 (`thumbnailUrl`):

```typescript
  optimizationStatus: text('optimization_status').notNull().default('pending'),
  blurDataUrl: text('blur_data_url'),
```

- [ ] **Step 2: Update insertSchema to include new columns as optional**

The `insertMediaFilesSchema` partial list (line 46-52) already uses `.partial()` for optional fields. Add the new columns:

```typescript
}).partial({
  tags: true,
  isHeroImage: true,
  sortOrder: true,
  duration: true,
  thumbnailUrl: true,
  bucket: true,
  optimizationStatus: true,
  blurDataUrl: true,
})
```

- [ ] **Step 3: Verify types**

Run: `pnpm tsc`

- [ ] **Step 4: Push schema to dev**

User runs: `pnpm db:push:dev`

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema/media-files.ts
git commit -m "feat(schema): add optimizationStatus + blurDataUrl to mediaFiles"
```

---

### Task 2: R2 getObject helper

**Files:**
- Create: `src/shared/services/r2/lib/get-object.ts`

- [ ] **Step 1: Create the helper**

```typescript
import type { R2BucketName } from '../buckets'

import { GetObjectCommand } from '@aws-sdk/client-s3'

import { r2Client } from '../client'

export async function getObject(bucket: R2BucketName, pathKey: string): Promise<Buffer> {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: pathKey,
    }),
  )

  if (!response.Body) {
    throw new Error(`Empty response for ${bucket}/${pathKey}`)
  }

  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/r2/lib/get-object.ts
git commit -m "feat(r2): add getObject helper for fetching buffers"
```

---

### Task 3: Sharp processing function

**Files:**
- Create: `src/shared/services/r2/lib/process-image-variants.ts`

- [ ] **Step 1: Create the processing function**

```typescript
import sharp from 'sharp'

const VARIANTS = [
  { suffix: 'sm', width: 640 },
  { suffix: 'md', width: 1280 },
  { suffix: 'lg', width: 1920 },
] as const

export interface ImageVariant {
  suffix: string
  buffer: Buffer
  width: number
}

export interface ProcessImageResult {
  variants: ImageVariant[]
  blurDataUrl: string
}

export async function processImageVariants(originalBuffer: Buffer): Promise<ProcessImageResult> {
  const [sm, md, lg, blur] = await Promise.all([
    sharp(originalBuffer).resize(640).webp({ quality: 80 }).toBuffer(),
    sharp(originalBuffer).resize(1280).webp({ quality: 80 }).toBuffer(),
    sharp(originalBuffer).resize(1920).webp({ quality: 80 }).toBuffer(),
    sharp(originalBuffer).resize(20).webp({ quality: 20 }).toBuffer(),
  ])

  return {
    variants: [
      { suffix: 'sm', buffer: sm, width: 640 },
      { suffix: 'md', buffer: md, width: 1280 },
      { suffix: 'lg', buffer: lg, width: 1920 },
    ],
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
  }
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/r2/lib/process-image-variants.ts
git commit -m "feat(r2): add sharp image variant processing function"
```

---

### Task 4: QStash optimize-image job

**Files:**
- Create: `src/shared/services/upstash/jobs/optimize-image.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`

- [ ] **Step 1: Create the job**

```typescript
import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema/media-files'
import { R2_BUCKETS } from '@/shared/services/r2/buckets'
import { getObject } from '@/shared/services/r2/lib/get-object'
import { processImageVariants } from '@/shared/services/r2/lib/process-image-variants'
import { putObject } from '@/shared/services/r2/put-object'

import { createJob } from '../lib/create-job'

interface OptimizeImagePayload {
  mediaFileId: number
}

export const optimizeImageJob = createJob<OptimizeImagePayload>(
  'optimize-image',
  async ({ mediaFileId }) => {
    // 1. Fetch media file record
    const [file] = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mediaFileId))

    if (!file) {
      console.error(`[optimize-image] Media file ${mediaFileId} not found`)
      return
    }

    // Skip if already processed
    if (file.optimizationStatus === 'optimized') {
      return
    }

    // 2. Mark as processing
    await db
      .update(mediaFiles)
      .set({ optimizationStatus: 'processing' })
      .where(eq(mediaFiles.id, mediaFileId))

    try {
      // 3. Fetch original from R2
      const bucket = file.bucket as typeof R2_BUCKETS.portfolioProjects
      const originalBuffer = await getObject(bucket, file.pathKey)

      // 4. Generate variants
      const { variants, blurDataUrl } = await processImageVariants(originalBuffer)

      // 5. Upload variants to R2
      const basePath = file.pathKey.replace(/\.[^.]+$/, '')
      await Promise.all(
        variants.map(v =>
          putObject(bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
        ),
      )

      // 6. Update DB
      await db
        .update(mediaFiles)
        .set({ optimizationStatus: 'optimized', blurDataUrl })
        .where(eq(mediaFiles.id, mediaFileId))
    }
    catch (error) {
      console.error(`[optimize-image] Failed for media file ${mediaFileId}:`, error)
      await db
        .update(mediaFiles)
        .set({ optimizationStatus: 'failed' })
        .where(eq(mediaFiles.id, mediaFileId))
    }
  },
)
```

- [ ] **Step 2: Register in job route**

In `src/app/api/qstash-jobs/route.ts`, add import and registration:

```typescript
import { optimizeImageJob } from '@/shared/services/upstash/jobs/optimize-image'

const jobs: Job[] = [
  generateAISummaryJob,
  syncCustomersJob,
  optimizeImageJob,
]
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/upstash/jobs/optimize-image.ts src/app/api/qstash-jobs/route.ts
git commit -m "feat(jobs): add optimize-image QStash job with sharp processing"
```

---

### Task 5: Dispatch job on upload

**Files:**
- Modify: `src/trpc/routers/projects.router.ts`

- [ ] **Step 1: Add import**

```typescript
import { optimizeImageJob } from '@/shared/services/upstash/jobs/optimize-image'
```

- [ ] **Step 2: Dispatch after createMediaFile**

After the `createMediaFile` mutation's DB insert (after `return created`), add dispatch. Since the procedure returns `created` before dispatching, add the dispatch before the return:

Find the `createMediaFile` mutation. After `const [created] = await db.insert(mediaFiles)...returning()`, before `return created`, add:

```typescript
      // Dispatch image optimization job
      if (created.mimeType.startsWith('image/')) {
        void optimizeImageJob.dispatch({ mediaFileId: created.id })
      }

      return created
```

- [ ] **Step 3: Dispatch after uploadFromDriveFile**

Find the `uploadFromDriveFile` mutation. Same pattern — after `const [created] = ...returning()`, before `return created`:

```typescript
      // Dispatch image optimization job
      if (input.mimeType.startsWith('image/')) {
        void optimizeImageJob.dispatch({ mediaFileId: created.id })
      }

      return created
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/projects.router.ts
git commit -m "feat(upload): dispatch optimize-image job after media file creation"
```

---

### Task 6: URL derivation helper

**Files:**
- Create: `src/shared/lib/get-optimized-urls.ts`

- [ ] **Step 1: Create the helper**

```typescript
import { R2_PUBLIC_DOMAINS } from '@/shared/services/r2/buckets'

const DEFAULT_R2_DOMAIN = R2_PUBLIC_DOMAINS['tpr-portfolio-projects'] ?? ''

interface MediaFileInput {
  url: string
  pathKey: string
  bucket: string
  optimizationStatus: string
}

export function getOptimizedSrc(file: MediaFileInput): string {
  if (file.optimizationStatus !== 'optimized') {
    return file.url
  }
  const base = file.pathKey.replace(/\.[^.]+$/, '')
  const domain = R2_PUBLIC_DOMAINS[file.bucket as keyof typeof R2_PUBLIC_DOMAINS] ?? DEFAULT_R2_DOMAIN
  return `${domain}/${base}-lg.webp`
}

export function getOptimizedSrcSet(file: MediaFileInput): string | undefined {
  if (file.optimizationStatus !== 'optimized') {
    return undefined
  }
  const base = file.pathKey.replace(/\.[^.]+$/, '')
  const domain = R2_PUBLIC_DOMAINS[file.bucket as keyof typeof R2_PUBLIC_DOMAINS] ?? DEFAULT_R2_DOMAIN
  return `${domain}/${base}-sm.webp 640w, ${domain}/${base}-md.webp 1280w, ${domain}/${base}-lg.webp 1920w`
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/get-optimized-urls.ts
git commit -m "feat(images): add URL derivation helpers for optimized variants"
```

---

### Task 7: OptimizedImage component

**Files:**
- Create: `src/shared/components/optimized-image.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'

import { cn } from '@/shared/lib/utils'
import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/lib/get-optimized-urls'

interface OptimizedImageProps {
  file: {
    url: string
    pathKey: string
    bucket: string
    optimizationStatus: string
    blurDataUrl?: string | null
  }
  alt: string
  sizes?: string
  priority?: boolean
  className?: string
  containerClassName?: string
  fill?: boolean
}

const DEFAULT_SIZES = '(max-width: 640px) 640px, (max-width: 1280px) 1280px, 1920px'

export function OptimizedImage({
  file,
  alt,
  sizes = DEFAULT_SIZES,
  priority = false,
  className,
  containerClassName,
  fill = false,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false)
  const src = getOptimizedSrc(file)
  const srcSet = getOptimizedSrcSet(file)
  const isProcessing = file.optimizationStatus === 'pending' || file.optimizationStatus === 'processing'

  return (
    <div className={cn('relative overflow-hidden', fill && 'absolute inset-0', containerClassName)}>
      {/* Blur placeholder */}
      {file.blurDataUrl && (
        <img
          src={file.blurDataUrl}
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 h-full w-full object-cover scale-110 blur-xl transition-opacity duration-500',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      {/* Processing shimmer */}
      {isProcessing && !file.blurDataUrl && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Real image */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onLoad={() => setLoaded(true)}
        className={cn('h-full w-full object-cover', className)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/optimized-image.tsx
git commit -m "feat(ui): add OptimizedImage component with srcSet + blur-up"
```

---

### Task 8: Update next.config.ts

**Files:**
- Modify: `next.config.ts`
- Delete: `src/shared/lib/cloudflare-image-loader.ts`

- [ ] **Step 1: Update next.config.ts**

Replace the current config:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
}

export default nextConfig
```

- [ ] **Step 2: Delete the cloudflare image loader**

```bash
rm src/shared/lib/cloudflare-image-loader.ts
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`

If any file imports `cloudflare-image-loader`, remove the import.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git rm src/shared/lib/cloudflare-image-loader.ts
git commit -m "chore: remove cloudflare image loader, set images.unoptimized"
```

---

### Task 9: Swap components in showroom/portfolio

**Files:**
- Modify: ~15 components listed in spec Section 7 "Where to Use"

For each component that renders R2 media file images (NOT local `/public/` assets):

- [ ] **Step 1: Replace `<Image>` with `<OptimizedImage>` where media files are rendered**

Pattern — change FROM:
```tsx
<Image src={heroImage.url} alt={project.title} fill className="object-cover" sizes="..." priority={index < 3} />
```

TO:
```tsx
<OptimizedImage file={heroImage} alt={project.title} fill sizes="..." priority={index < 3} />
```

The `file` prop accepts the media file object directly (needs `url`, `pathKey`, `bucket`, `optimizationStatus`, `blurDataUrl`).

**Important:** Components that render local images (logos from `/public/`, etc.) keep using Next.js `<Image>`. Only swap where `src` is a media file URL.

Components to update (search for `<Image` + R2/media URLs):
- `src/features/showroom/ui/components/showroom-project-card.tsx`
- `src/features/showroom/ui/components/showroom-hero.tsx`
- `src/features/showroom/ui/components/story-journey.tsx`
- `src/features/showroom/ui/components/story-transformation.tsx`
- `src/features/showroom/ui/components/story-challenge.tsx`
- `src/features/showroom/ui/components/story-gallery.tsx`
- `src/features/showroom/ui/components/story-before-after.tsx`
- `src/features/showroom/ui/components/story-hero.tsx`
- `src/features/showroom/ui/components/phase-carousel.tsx`
- `src/features/showroom/ui/components/photo-lightbox.tsx`
- `src/shared/components/portfolio/sortable-photo-card.tsx`
- `src/shared/components/portfolio/photo-detail-dialog.tsx`
- `src/features/landing/ui/components/portfolio/project-card.tsx`
- `src/features/landing/ui/components/portfolio/project/project-hero.tsx`
- `src/features/landing/ui/components/portfolio/project/before-after-gallery.tsx`
- `src/features/landing/ui/components/portfolio/project/progress-gallery.tsx`

**Note:** Some of these components receive `MediaFile` objects, others receive plain `{ url }` objects. For components that only receive a URL string (not the full media file), keep using `<Image unoptimized>` or `<img>` — they don't have the metadata needed for `<OptimizedImage>`.

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(images): swap media file Image usages to OptimizedImage with srcSet"
```

---

### Task 10: Migration script

**Files:**
- Create: `scripts/migrate-optimize-images.ts`

- [ ] **Step 1: Create the script**

```typescript
import 'dotenv/config'
import { Buffer } from 'node:buffer'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { mediaFiles } from '../src/shared/db/schema/media-files'
import { getObject } from '../src/shared/services/r2/lib/get-object'
import { processImageVariants } from '../src/shared/services/r2/lib/process-image-variants'
import { putObject } from '../src/shared/services/r2/put-object'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

const CONCURRENCY = 5

async function migrate() {
  const pending = await db
    .select({ id: mediaFiles.id, pathKey: mediaFiles.pathKey, bucket: mediaFiles.bucket, mimeType: mediaFiles.mimeType })
    .from(mediaFiles)
    .where(sql`${mediaFiles.optimizationStatus} = 'pending' AND ${mediaFiles.mimeType} LIKE 'image/%'`)

  console.log(`Found ${pending.length} images to process`)

  let processed = 0
  let failed = 0

  // Process in batches of CONCURRENCY
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (file) => {
      try {
        const bucket = file.bucket as 'tpr-portfolio-projects'
        const original = await getObject(bucket, file.pathKey)
        const { variants, blurDataUrl } = await processImageVariants(original)

        const basePath = file.pathKey.replace(/\.[^.]+$/, '')
        await Promise.all(
          variants.map(v =>
            putObject(bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
          ),
        )

        await db
          .update(mediaFiles)
          .set({ optimizationStatus: 'optimized', blurDataUrl })
          .where(eq(mediaFiles.id, file.id))

        processed++
        console.log(`[${processed + failed}/${pending.length}] ✓ ${file.pathKey}`)
      }
      catch (error) {
        failed++
        console.error(`[${processed + failed}/${pending.length}] ✗ ${file.pathKey}:`, error)
        await db
          .update(mediaFiles)
          .set({ optimizationStatus: 'failed' })
          .where(eq(mediaFiles.id, file.id))
      }
    }))
  }

  console.log(`\nDone! Processed: ${processed}, Failed: ${failed}`)
  await pool.end()
}

migrate().catch(console.error)
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-optimize-images.ts
git commit -m "feat(scripts): add image optimization migration script"
```

- [ ] **Step 3: Run on dev database**

```bash
npx tsx scripts/migrate-optimize-images.ts
```

Monitor output for errors. Expected: ~16 minutes for 2,000 images.

---

## Verification Checklist

After all tasks are complete:

- [ ] Upload a new image via the showroom editor → check R2 for 4 files (original + 3 variants)
- [ ] Check DB: `optimizationStatus = 'optimized'`, `blurDataUrl` starts with `data:image/webp;base64,`
- [ ] Visit portfolio page → images load with blur-up transition
- [ ] Open Network tab → verify sm/md/lg URLs in `srcSet`
- [ ] Resize browser → verify browser picks appropriate variant
- [ ] Upload via Google Drive → same optimization flow
- [ ] Local images (`/public/` logos, icons) still render correctly
- [ ] Migration script: check a few processed images in R2
