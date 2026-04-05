# Image Optimization Pipeline Design

> **Date:** 2026-04-04
> **Status:** Draft
> **Scope:** Upload-time sharp processing, QStash job queue, 3 variant sizes + blur placeholder, migration script, OptimizedImage component

---

## 1. Problem

Images are served directly from R2 at original quality (5-8 MB DSLR photos). Vercel's image optimization quota (1,000/month) is exhausted. Cloudflare Image Transforms require a paid plan. Images load slowly and waste bandwidth.

## 2. Solution

Process images at upload time using `sharp` via a QStash background job. Generate 3 WebP size variants + a tiny blur placeholder. Serve via a custom `<OptimizedImage>` component with browser-native `srcSet`. Zero ongoing cost.

---

## 3. Variant Set

| Variant | Width | Format | Quality | Approx Size | Storage |
|---------|-------|--------|---------|-------------|---------|
| `blur` | 20px | WebP base64 | 20 | 50-150 bytes | DB column (`blurDataUrl`) |
| `sm` | 640px | WebP | 80 | 15-40 KB | R2 (`{base}-sm.webp`) |
| `md` | 1280px | WebP | 80 | 40-120 KB | R2 (`{base}-md.webp`) |
| `lg` | 1920px | WebP | 80 | 80-300 KB | R2 (`{base}-lg.webp`) |
| original | — | unchanged | — | 2-8 MB | R2 (kept as backup) |

---

## 4. R2 Storage Convention

```
projects/{projectId}/{phase}/{uuid}.jpg           ← original (kept)
projects/{projectId}/{phase}/{uuid}-sm.webp       ← 640w
projects/{projectId}/{phase}/{uuid}-md.webp       ← 1280w
projects/{projectId}/{phase}/{uuid}-lg.webp       ← 1920w
```

Base path stored in DB `pathKey` column. Variant URLs derived by replacing the extension with `-{size}.webp`.

---

## 5. Schema Changes

### `mediaFiles` table

```
ADD    optimizationStatus: text('optimization_status').notNull().default('pending')
ADD    blurDataUrl: text('blur_data_url')
```

**`optimizationStatus` values:**
- `'pending'` — uploaded, no variants yet (default)
- `'processing'` — QStash job picked it up
- `'optimized'` — all 3 variants + blur exist
- `'failed'` — sharp processing failed (original still available)

**`blurDataUrl`:** Base64-encoded 20px WebP (e.g., `data:image/webp;base64,UklGR...`). ~100 bytes. Inline in `<img>` for instant blur-up placeholder.

---

## 6. Upload → QStash → Sharp Pipeline

### Flow

```
1. Agent uploads image
   ├── Presigned URL: browser PUT to R2 → createMediaFile(status='pending')
   └── Google Drive: server fetches → PUT to R2 → createMediaFile(status='pending')

2. createMediaFile procedure dispatches QStash job
   └── optimizeImageJob.dispatch({ mediaFileId })

3. UI shows shimmer/pulse overlay (optimizationStatus = 'pending')
   └── Ably channel publishes 'media-file.optimized' when done

4. QStash job handler (api/qstash-jobs?job=optimize-image)
   ├── DB: set optimizationStatus = 'processing'
   ├── Fetch original from R2 (GetObjectCommand)
   ├── Run sharp (in parallel):
   │   ├── resize(640).webp({quality:80})  → PUT {base}-sm.webp
   │   ├── resize(1280).webp({quality:80}) → PUT {base}-md.webp
   │   ├── resize(1920).webp({quality:80}) → PUT {base}-lg.webp
   │   └── resize(20).webp({quality:20})   → base64 string
   ├── DB: set optimizationStatus = 'optimized', blurDataUrl = base64
   └── Ably: publish 'media-file.optimized' { mediaFileId }

5. On error:
   ├── DB: set optimizationStatus = 'failed'
   └── Original image continues to serve (graceful degradation)
```

### QStash Job Definition

**File:** `src/shared/services/upstash/jobs/optimize-image.ts`

```typescript
import { createJob } from '../lib/create-job'

interface OptimizeImagePayload {
  mediaFileId: number
}

export const optimizeImageJob = createJob<OptimizeImagePayload>(
  'optimize-image',
  async (payload) => {
    // 1. Fetch media file record from DB
    // 2. Fetch original from R2
    // 3. Generate 4 variants with sharp (3 sizes + blur)
    // 4. Upload 3 size variants to R2
    // 5. Update DB: optimizationStatus = 'optimized', blurDataUrl = base64
    // 6. Publish Ably event for real-time UI update
  }
)
```

**Register in job route:** Add `optimizeImageJob` to the `jobs` array in `src/app/api/qstash-jobs/route.ts`.

### Sharp Processing Function

**File:** `src/shared/services/r2/lib/process-image-variants.ts`

```typescript
import sharp from 'sharp'

const VARIANTS = [
  { suffix: 'sm', width: 640 },
  { suffix: 'md', width: 1280 },
  { suffix: 'lg', width: 1920 },
] as const

interface ProcessResult {
  variants: Array<{ suffix: string, buffer: Buffer, width: number }>
  blurDataUrl: string
}

export async function processImageVariants(originalBuffer: Buffer): Promise<ProcessResult> {
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

### Dispatch on Upload

In `src/trpc/routers/projects.router.ts`, after `createMediaFile`:

```typescript
// After DB insert, dispatch optimization job
await optimizeImageJob.dispatch({ mediaFileId: created.id })
```

Same for `uploadFromDriveFile` — dispatch after the DB record is created.

---

## 7. `<OptimizedImage>` Component

**File:** `src/shared/components/optimized-image.tsx`

A replacement for `<Image>` when rendering R2 media files. Uses browser-native `srcSet` with blur-up placeholder.

### Props

```typescript
interface OptimizedImageProps {
  src: string              // original or lg variant URL
  pathKey: string          // R2 path key (base for variant derivation)
  optimizationStatus: string
  blurDataUrl?: string | null
  alt: string
  width?: number
  height?: number
  sizes?: string           // srcSet sizes hint
  priority?: boolean       // eager loading for above-fold images
  className?: string
}
```

### Behavior

1. **optimized** → render `<img>` with:
   - `src` = lg variant URL
   - `srcSet` = `{base}-sm.webp 640w, {base}-md.webp 1280w, {base}-lg.webp 1920w`
   - `sizes` = provided or default `(max-width: 640px) 640px, (max-width: 1280px) 1280px, 1920px`
   - Blur placeholder via `blurDataUrl` (CSS background-image, fades out on load)

2. **pending/processing** → render shimmer animation overlay with blur placeholder if available

3. **failed** → render original URL directly, no srcSet

### Blur-Up Animation

```tsx
<div className="relative overflow-hidden" style={{ aspectRatio }}>
  {/* Blur layer — always present, fades when real image loads */}
  {blurDataUrl && (
    <img
      src={blurDataUrl}
      alt=""
      aria-hidden
      className={cn(
        'absolute inset-0 w-full h-full object-cover scale-110 blur-xl transition-opacity duration-500',
        loaded ? 'opacity-0' : 'opacity-100'
      )}
    />
  )}

  {/* Real image */}
  <img
    src={lgUrl}
    srcSet={srcSet}
    sizes={sizes}
    alt={alt}
    loading={priority ? 'eager' : 'lazy'}
    decoding="async"
    onLoad={() => setLoaded(true)}
    className="w-full h-full object-cover"
  />
</div>
```

### Where to Use

Replace `<Image>` with `<OptimizedImage>` in components that render `mediaFile` data:
- `showroom-project-card.tsx` (hero image)
- `showroom-hero.tsx` (project hero)
- `story-*.tsx` components (journey, transformation, gallery, before-after)
- `phase-carousel.tsx`
- `photo-lightbox.tsx`
- `sortable-photo-card.tsx`
- `project-card.tsx` (landing portfolio)
- `project-hero.tsx` (landing portfolio)
- `before-after-gallery.tsx`
- `progress-gallery.tsx`
- `photo-detail-dialog.tsx`

Local images (`/public/` paths — logos, icons, sidebar) keep using `<Image>`.

---

## 8. Migration Script

**File:** `scripts/migrate-optimize-images.ts`

A local CLI script that processes all existing media files.

### Approach

1. Query all media files from DB where `optimizationStatus = 'pending'`
2. For each (with rate limiting — 5 concurrent):
   - Fetch original from R2
   - Run `processImageVariants()`
   - Upload 3 variants to R2
   - Update DB: `optimizationStatus = 'optimized'`, `blurDataUrl = base64`
3. Log progress: `[142/2000] Processed: projects/{id}/hero/{uuid}.jpg`
4. On error: log the file, mark as `'failed'`, continue

### Rate Limiting

Process 5 images concurrently (parallel sharp + R2 upload). Each image ~2-3 seconds. 2,000 images ÷ 5 parallel ÷ 2.5s = ~16 minutes total.

### Running

```bash
npx tsx scripts/migrate-optimize-images.ts
```

Requires: `DATABASE_URL` and R2 credentials in `.env`.

---

## 9. Fallback Strategy

The system is designed so nothing breaks during rollout:

| Scenario | What Renders |
|----------|-------------|
| New image, variants not yet generated | Original URL (full size) with shimmer overlay |
| Image optimized successfully | srcSet with sm/md/lg variants + blur placeholder |
| Image optimization failed | Original URL (full size), subtle warning icon |
| Old image, migration not yet run | Original URL (full size) — `optimizationStatus` defaults to `'pending'` |
| Component doesn't pass `pathKey` | Original URL — `<OptimizedImage>` degrades to basic `<img>` |

---

## 10. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/db/schema/media-files.ts` | MODIFY | Add `optimizationStatus`, `blurDataUrl` columns |
| `src/shared/services/r2/lib/process-image-variants.ts` | NEW | Sharp processing function |
| `src/shared/services/upstash/jobs/optimize-image.ts` | NEW | QStash job handler |
| `src/app/api/qstash-jobs/route.ts` | MODIFY | Register optimize-image job |
| `src/shared/components/optimized-image.tsx` | NEW | OptimizedImage component |
| `src/shared/lib/cloudflare-image-loader.ts` | DELETE | No longer needed — variants are pre-generated, not transformed on-the-fly |
| `next.config.ts` | MODIFY | Remove custom loader, set `images: { unoptimized: true }`. Local images stay as Next.js static assets (no optimization needed). R2 images use `<OptimizedImage>` with pre-generated srcSet. |
| `src/trpc/routers/projects.router.ts` | MODIFY | Dispatch QStash job after upload |
| `scripts/migrate-optimize-images.ts` | NEW | One-time migration script |
| ~15 showroom/portfolio components | MODIFY | Replace `<Image>` with `<OptimizedImage>` for media files |

---

## 11. Verification Plan

- [ ] Upload a new image → shimmer shows → variants generated in ~3s → blur-up transition → crisp image
- [ ] Check R2: original + 3 variants exist at correct paths
- [ ] Check DB: `optimizationStatus = 'optimized'`, `blurDataUrl` populated
- [ ] Mobile viewport loads sm variant (~30KB), desktop loads lg (~200KB)
- [ ] Failed optimization: original still serves, status = 'failed'
- [ ] Migration script: run on 10 images, verify all 4 files created in R2
- [ ] Portfolio page loads fast (< 2s on 3G with sm variants)
- [ ] Google Drive upload also triggers optimization
- [ ] Local images (/public/) still render correctly via `<Image>`

---

## 12. Cost Analysis

| Resource | Usage | Cost |
|----------|-------|------|
| R2 storage | 2,000 images × 4 files × ~200KB avg = ~1.6 GB | Free (10 GB free tier) |
| R2 operations | Migration: ~8,000 PUTs. Ongoing: ~12 PUTs/image | Free (1M free/month) |
| QStash | ~2,000 migration + ongoing uploads | Free (500K messages/month) |
| Sharp CPU | Runs on Vercel serverless (QStash handler) | Free (included in Vercel compute) |
| **Total ongoing cost** | | **$0** |
