# Media Optimization Completeness — Video (Cloudflare Stream) + PDF Raster + Upload UX — Implementation Plan (Plan 1b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the shared media engine's two deferred optimization paths — **video** (Cloudflare Stream: cross-browser playback + poster + duration) and **PDF first-page raster** (visual thumbnail) — plus a harvested client **upload-progress UX**, so both owners (project + proposal) get all of it from one engine.

**Architecture:** Turn Plan 1's `optimizeFile` into a **file-kind strategy registry** (`image|video|pdf|other`, one `optimize(ref)→outcome` interface). Add a **Cloudflare Stream** leaf provider (REST via `fetch`, no SDK) with direct upload + signed-webhook readiness + signed/public iframe playback. Add a **PDF raster strategy** (`pdfjs-dist` + `@napi-rs/canvas`). Make `buildUploadTarget`/`createRecord`/`removeRecord` branch on `provider`. Add a **provider-aware read resolver** producing one unified `MediaItem` (`kind`,`posterUrl`,`duration`,`pageCount`). Replace the progress-blind `fetch` upload with a **native-XHR progress transport** (abort+retry) fronted by `react-dropzone`. Render by `kind` in `MediaCard` (Stream **iframe player**, no hls.js).

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), Zod, TanStack Query, `@aws-sdk/client-s3` (R2), Cloudflare Stream (REST), `sharp`, `pdfjs-dist`, `@napi-rs/canvas`, `react-dropzone`, Upstash QStash, Tailwind v4, shadcn/ui, `motion/react`.

**Design spec:** `docs/superpowers/specs/2026-08-05-media-video-pdf-optimization-design.md`. **Prereq:** Plan 1 (`2026-08-05-proposal-media-subsystem.md`) is **fully executed** — its files (`src/shared/lib/file-optimization/*`, `src/shared/services/media/*`, `src/shared/components/media/*`, `src/shared/hooks/use-media-upload.ts`, generalized `MediaManager`, both media tables provider-aware) exist. If Plan 1 is not done, stop.

## Global Constraints

- **Verification model (NO unit-test runner):** each task closes with `pnpm tsc` (no errors) + `pnpm lint` (clean) + the stated manual/DB/deploy check. No vitest/jest exists. **Never `pnpm build`.**
- **Provider model:** `provider ∈ {'r2','stream'}` (Plan 1). `'r2'` rows have `pathKey`+`bucket`, `externalId=null`; `'stream'` rows have `externalId` (Stream UID), `pathKey`/`bucket`=`null`. Nothing in the router/job/UI may assume a media row is an R2 object.
- **Import direction (hard rule):** `src/shared/**` (media service/UI/lib) NEVER imports `@/features/**`. Providers are leaf (primitives in/out, no domain types, no DB writes). Verify per task with the stated grep.
- **Webhook convention** (`docs/codebase-conventions/webhook-routes.md`): one route per provider at `src/app/api/webhooks/<provider>/route.ts`; verify secret → 401 on fail; **200-always once verified**; log handler failures, don't 500.
- **Secrets:** the Stream **API token + signing key never reach the client**. The browser only ever sees a one-time `uploadURL` and short-TTL signed playback URLs.
- **Ceilings (product):** video **≤ 10 min, ≤ 500 MB**; enforced server-side in the upload procedure, never trusting the client. Image/PDF size ceilings stay as Plan 1.
- **DB pushes:** `pnpm db:push:dev` only; additive migrations verified with `pnpm db:push:dev --dry-run` first. Never prod.
- **Git:** work on `main`, stage by explicit path. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Conventions:** one component per file, named exports, `motion/react`, RHF+Zod for forms, entity co-location, `memory/coding-conventions.md`.
- **Regression discipline:** the project + proposal media paths are LIVE after Plan 1. Every task touching the optimizer, upload, or `MediaCard` ends with the **Media Regression Checklist** (end of plan) passing.

---

## File Structure

**Create — file-optimization strategies (`src/shared/lib/file-optimization/`):**
- `strategies/types.ts` — `FileOptimizationStrategy`, `MediaAssetRef`, `FileOptimizationOutcome`.
- `strategies/image.ts`, `strategies/pdf.ts` (raster), `strategies/video.ts`, `strategies/other.ts`, `strategies/registry.ts`.
- `strategies/pdf-raster.ts` — `renderPdfFirstPage(buffer): Promise<Buffer>` (pdfjs + @napi-rs/canvas).

**Create — Cloudflare Stream provider (`src/shared/services/providers/cloudflare-stream/`):**
- `types.ts`, `lib/config.ts`, `client.ts`.

**Create — webhook + client transport:**
- `src/app/api/webhooks/cloudflare-stream/route.ts`
- `src/shared/lib/upload/xhr-upload.ts` — `uploadWithProgress(...)`.

**Modify:**
- `src/shared/db/schema/lib/media-columns.ts` (add `thumbnailPathKey`,`pageCount` to base); `src/shared/db/schema/media-files.ts` (drop now-duplicated locals if any); barrel unaffected.
- `src/shared/lib/file-optimization/optimize-file.ts` → thin dispatch over the registry; `.../types.ts` (kind classifier).
- `src/shared/entities/media-files/dal/server/optimization.ts` (persist `duration`/`pageCount`/`thumbnailPathKey`/status from outcome).
- `src/shared/services/media/stores.ts` (`videoRequireSignedUrls`); `optimization-target.ts` (`findMediaByExternalId`); `optimize-media.ts` (registry); `media.service.ts` (provider branch + `completeStreamAsset`).
- `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts` + `dal/server/queries.ts` (`toProposalMediaView` → provider-aware, `kind`/`posterUrl`/`duration`); project url building in `src/trpc/routers/projects.router/media.router.ts`.
- `src/shared/components/media/{types.ts,media-card.tsx,media-manager.tsx}` (kind rendering, progress, dropzone); `src/shared/hooks/use-media-upload.ts` (XHR transport + abort/retry).
- `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx` (video iframe + pdf).
- `next.config.ts` (`serverExternalPackages` + `outputFileTracingIncludes` for pdfjs/canvas).
- `src/app/api/qstash-jobs/route.ts` — no new job key (optimize-media already registered in Plan 1); confirm `maxDuration` stays 60.
- DOCS: `file-optimization/DOCS.md`, `src/shared/services/media/DOCS.md`, new `cloudflare-stream/README` (or DOCS), `webhook-routes.md` route map.

**Add deps:** `pdfjs-dist`, `@napi-rs/canvas`, `react-dropzone`.

---

## Task 1: Promote `thumbnailPathKey` + `pageCount` into `baseMediaColumns`

**Files:** Modify `src/shared/db/schema/lib/media-columns.ts`, `src/shared/db/schema/proposal-media-files.ts` (remove now-duplicated locals), `src/shared/db/schema/media-files.ts` (inherits new cols)

**Interfaces:**
- Produces: `baseMediaColumns.thumbnailPathKey` (nullable text), `baseMediaColumns.pageCount` (nullable int) — available on BOTH media tables.

- [ ] **Step 1:** Add to `baseMediaColumns` (after `blurDataUrl`):

```ts
  // Raster thumbnail for non-image kinds (pdf first-page; unused for r2 images).
  thumbnailPathKey: text('thumbnail_path_key'),
  // Page count for pdf; null otherwise.
  pageCount: integer('page_count'),
```

- [ ] **Step 2:** In `proposal-media-files.ts`, **remove** the local `pageCount` + `thumbnailPathKey` column decls (now inherited from `baseMediaColumns`) so they aren't declared twice. Keep `visibility`. Confirm `insertProposalMediaFileSchema.partial({... pageCount:true, thumbnailPathKey:true ...})` still lists them (already does).
- [ ] **Step 3:** `pnpm db:push:dev --dry-run` → expect **only**: add `thumbnail_path_key` + `page_count` to `media_files` (both nullable); `proposal_media_files` unchanged (columns moved, same shape). No drops/renames. Then `pnpm db:push:dev`.
- [ ] **Step 4:** `pnpm tsc && pnpm lint`; commit (`feat(media): share thumbnailPathKey + pageCount across both media tables`).

---

## Task 2: File-kind strategy registry

**Files:** Create `src/shared/lib/file-optimization/strategies/{types.ts,image.ts,pdf.ts,video.ts,other.ts,registry.ts}`; Modify `src/shared/lib/file-optimization/optimize-file.ts`, `.../types.ts`, `src/shared/entities/media-files/dal/server/optimization.ts`

**Interfaces:**
- Consumes (from Plan 1): `classifyFileKind(mimeType): FileKind`, `processImageVariants`, `r2Client`, generic setters.
- Produces: `FileOptimizationStrategy`, `MediaAssetRef`, `FileOptimizationOutcome`, `strategyRegistry: Record<FileKind, FileOptimizationStrategy>`. `optimizeFile(ref)` now dispatches via the registry. Setters persist `duration`/`pageCount`/`thumbnailPathKey`/`status`.

- [ ] **Step 1:** Strategy contract:

```ts
// src/shared/lib/file-optimization/strategies/types.ts
import type { MediaProvider } from '@/shared/db/schema/lib/media-columns'
import type { FileKind } from '../types'

export interface MediaAssetRef {
  provider: MediaProvider
  bucket: string | null
  pathKey: string | null
  externalId: string | null
  thumbnailPathKey: string | null
  mimeType: string
}

export interface FileOptimizationOutcome {
  status: 'optimized' | 'processing' | 'failed'
  variants?: string[]
  blurDataUrl?: string
  pageCount?: number
  duration?: number
  thumbnailPathKey?: string
}

export interface FileOptimizationStrategy {
  kind: FileKind
  optimize: (ref: MediaAssetRef) => Promise<FileOptimizationOutcome>
}
```

- [ ] **Step 2:** `image.ts` — move Plan 1's image path behind the interface (no behavior change):

```ts
// src/shared/lib/file-optimization/strategies/image.ts
import type { FileOptimizationStrategy } from './types'
import { r2Client } from '@/shared/services/providers/r2/client'
import { processImageVariants } from '@/shared/entities/media-files/lib/process-image-variants'

export const imageStrategy: FileOptimizationStrategy = {
  kind: 'image',
  async optimize(ref) {
    if (ref.provider !== 'r2' || !ref.bucket || !ref.pathKey)
      return { status: 'failed' }
    const original = await r2Client.getObject(ref.bucket, ref.pathKey)
    const { variants, blurDataUrl, variantSuffixes } = await processImageVariants(original)
    const base = ref.pathKey.replace(/\.[^.]+$/, '')
    await Promise.all(variants.map(v => r2Client.putObject(ref.bucket!, `${base}-${v.suffix}.webp`, v.buffer, 'image/webp')))
    return { status: 'optimized', variants: variantSuffixes, blurDataUrl }
  },
}
```

- [ ] **Step 3:** `other.ts` → `{ kind:'other', optimize: async () => ({ status:'optimized' }) }`. `video.ts` + `pdf.ts` are filled by Task 3/Task 5 — scaffold them now returning `{ status:'processing' }` (video) / delegating to the raster fn (pdf, added Task 3) so the registry compiles.
- [ ] **Step 4:** `registry.ts`:

```ts
// src/shared/lib/file-optimization/strategies/registry.ts
import type { FileKind } from '../types'
import type { FileOptimizationStrategy } from './types'
import { imageStrategy } from './image'
import { otherStrategy } from './other'
import { pdfStrategy } from './pdf'
import { videoStrategy } from './video'

export const strategyRegistry: Record<FileKind, FileOptimizationStrategy> = {
  image: imageStrategy,
  pdf: pdfStrategy,
  video: videoStrategy,
  other: otherStrategy,
}
```

- [ ] **Step 5:** Rewrite `optimize-file.ts` to dispatch: `export async function optimizeFile(ref: MediaAssetRef) { return strategyRegistry[classifyFileKind(ref.mimeType)].optimize(ref) }`. Delete the old inline image/pdf branches.
- [ ] **Step 6:** Extend the generic setters in `optimization.ts` to persist an outcome — one entry point:

```ts
// setMediaOptimizationOutcome(table, id, outcome)
//   status 'optimized' → set optimizationStatus='optimized', + optimizationVariants, blurDataUrl,
//     and (when the column exists on `table`) duration, pageCount, thumbnailPathKey.
//   status 'processing' → set optimizationStatus='processing' (leave derived fields).
//   status 'failed' → set optimizationStatus='failed'.
// Contained `as any` on the update target (same pattern as Plan 1). Only write pageCount/
// thumbnailPathKey/duration keys that are present in `outcome` AND exist on `table`.
```

Update `optimizeMediaFile` (Plan 1's `optimize-media.ts`) to build a `MediaAssetRef` from the loaded row and call `optimizeFile(ref)` → `setMediaOptimizationOutcome`.
- [ ] **Step 7:** `pnpm tsc && pnpm lint`.
- [ ] **Step 8: Media Regression Checklist** (image path only) — upload a JPG to a project, confirm variants+blur+status unchanged. Must pass (proves the relocation is behavior-preserving).
- [ ] **Step 9:** Commit (`refactor(file-optimization): strategy registry (image/pdf/video/other)`).

---

## Task 3: PDF first-page raster strategy

**Files:** Create `src/shared/lib/file-optimization/strategies/pdf-raster.ts`; Modify `strategies/pdf.ts`, `next.config.ts`, `package.json`

**Interfaces:**
- Produces: `renderPdfFirstPage(buffer): Promise<Buffer>` (webp); `pdfStrategy` → writes `-thumb.webp`, returns `{ status:'optimized', pageCount, thumbnailPathKey, blurDataUrl }`.

- [ ] **Step 1:** Add deps: `pnpm add pdfjs-dist @napi-rs/canvas`.
- [ ] **Step 2:** Rasterizer (serverless-safe: legacy build, worker off, canvas factory):

```ts
// src/shared/lib/file-optimization/strategies/pdf-raster.ts
import { Buffer } from 'node:buffer'
import { createCanvas } from '@napi-rs/canvas'
import sharp from 'sharp'
// legacy Node build — no DOM, no worker
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const TARGET_WIDTH = 1000

/** Render page 1 of a PDF to a webp buffer. Returns null-safe throws on unreadable PDFs. */
export async function renderPdfFirstPage(pdfBuffer: Buffer): Promise<{ webp: Buffer, pageCount: number }> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    useWorkerFetch: false,
    // standardFontDataUrl resolved from the shipped package (see next.config trace)
    standardFontDataUrl: 'pdfjs-dist/standard_fonts/',
  }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = TARGET_WIDTH / viewport.width
  const scaled = page.getViewport({ scale })
  const canvas = createCanvas(Math.ceil(scaled.width), Math.ceil(scaled.height))
  const ctx = canvas.getContext('2d')
  // @napi-rs/canvas ctx is API-compatible with the CanvasRenderingContext2D pdfjs expects
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: scaled }).promise
  const png = canvas.toBuffer('image/png')
  const webp = await sharp(png).webp({ quality: 72 }).toBuffer()
  return { webp, pageCount: doc.numPages }
}
```

- [ ] **Step 3:** `pdf.ts` strategy — pull original, raster, write thumb, return outcome:

```ts
// src/shared/lib/file-optimization/strategies/pdf.ts
import type { FileOptimizationStrategy } from './types'
import sharp from 'sharp'
import { r2Client } from '@/shared/services/providers/r2/client'
import { renderPdfFirstPage } from './pdf-raster'

export const pdfStrategy: FileOptimizationStrategy = {
  kind: 'pdf',
  async optimize(ref) {
    if (ref.provider !== 'r2' || !ref.bucket || !ref.pathKey)
      return { status: 'failed' }
    const original = await r2Client.getObject(ref.bucket, ref.pathKey)
    const { webp, pageCount } = await renderPdfFirstPage(original)
    const thumbKey = `${ref.pathKey.replace(/\.[^.]+$/, '')}-thumb.webp`
    await r2Client.putObject(ref.bucket, thumbKey, webp, 'image/webp')
    const blur = await sharp(webp).resize(20).webp({ quality: 20 }).toBuffer()
    return { status: 'optimized', pageCount, thumbnailPathKey: thumbKey, blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}` }
  },
}
```

- [ ] **Step 4:** `next.config.ts` — externalize + trace the native binary + fonts for the qstash-jobs route:

```ts
  serverExternalPackages: ['pdfkit', '@napi-rs/canvas', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/qstash-jobs': [
      './node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*',
      './node_modules/.pnpm/@napi-rs+canvas@*/node_modules/@napi-rs/canvas/*.node',
      './node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/standard_fonts/**/*',
    ],
    // ...existing entries unchanged
  },
```

- [ ] **Step 5:** `pnpm tsc && pnpm lint`. Local manual: upload a PDF to a project → optimize job runs → `optimization_status` optimized, `page_count` set, `-thumb.webp` present in R2, `thumbnail_path_key` set.
- [ ] **Step 6: Deploy-preview smoke test (load-bearing):** push a branch, open a Vercel Preview, upload a PDF there, confirm the raster job succeeds in the bundle (this is the ONLY place the tracing config is exercised — it passes locally regardless). If it 500s on a missing `.node`/font, fix the trace globs before proceeding.
- [ ] **Step 7:** Commit (`feat(file-optimization): PDF first-page raster (pdfjs + napi-rs/canvas)`).

---

## Task 4: Cloudflare Stream provider

**Files:** Create `src/shared/services/providers/cloudflare-stream/{types.ts,lib/config.ts,client.ts}`; add env keys per `environment.md`

**Interfaces:**
- Produces: `cloudflareStream.{ createDirectUpload, getVideo, deleteVideo, buildPlaybackUrls, verifyWebhook }`. Leaf: primitives in/out, no DB, no domain types.

> Verify exact Cloudflare endpoints/bodies + the signed-token algorithm against current Cloudflare Stream docs before finalizing — the shapes below are the flow contract (per design §2.4 / §10).

- [ ] **Step 1:** `lib/config.ts` — `lazyProxy` env resolver (mirror r2's): `{ accountId, apiToken, customerCode, webhookSecret, signingKeyId, signingKeyJwk }` from `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`, `CLOUDFLARE_STREAM_KEY_ID`, `CLOUDFLARE_STREAM_JWK`. Throw `NotConfiguredError` on first use if unset.
- [ ] **Step 2:** `client.ts`:

```ts
// src/shared/services/providers/cloudflare-stream/client.ts
import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { SignJWT, importJWK } from 'jose' // jose is already used for auth; confirm presence, else use node:crypto RS256
import { getStreamConfig } from './lib/config'

const API = 'https://api.cloudflare.com/client/v4'

export const cloudflareStream = {
  /** One-time direct creator upload. Returns the URL the browser POSTs the file to + the asset uid. */
  async createDirectUpload(input: { maxDurationSeconds: number, requireSignedURLs: boolean, meta?: Record<string, string> }) {
    const cfg = getStreamConfig()
    const res = await fetch(`${API}/accounts/${cfg.accountId}/stream/direct_upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxDurationSeconds: input.maxDurationSeconds, requireSignedURLs: input.requireSignedURLs, meta: input.meta }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(`Stream direct_upload failed: ${JSON.stringify(json.errors)}`)
    return { uploadURL: json.result.uploadURL as string, uid: json.result.uid as string }
  },

  async getVideo(uid: string) {
    const cfg = getStreamConfig()
    const res = await fetch(`${API}/accounts/${cfg.accountId}/stream/${uid}`, { headers: { Authorization: `Bearer ${cfg.apiToken}` } })
    const json = await res.json()
    if (!json.success) throw new Error(`Stream getVideo failed: ${JSON.stringify(json.errors)}`)
    return { readyToStream: json.result.readyToStream as boolean, duration: json.result.duration as number | null, state: json.result.status?.state as string }
  },

  async deleteVideo(uid: string) {
    const cfg = getStreamConfig()
    await fetch(`${API}/accounts/${cfg.accountId}/stream/${uid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${cfg.apiToken}` } })
  },

  /** Public → uid URLs; signed → mint a short-TTL token and use it in place of the uid. */
  async buildPlaybackUrls(uid: string, opts: { requireSignedURLs: boolean, ttlSeconds?: number }): Promise<{ iframeUrl: string, posterUrl: string }> {
    const cfg = getStreamConfig()
    const host = `https://customer-${cfg.customerCode}.cloudflarestream.com`
    if (!opts.requireSignedURLs)
      return { iframeUrl: `${host}/${uid}/iframe`, posterUrl: `${host}/${uid}/thumbnails/thumbnail.jpg?time=1s` }
    const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 3600)
    const key = await importJWK(JSON.parse(cfg.signingKeyJwk), 'RS256')
    const token = await new SignJWT({ sub: uid }).setProtectedHeader({ alg: 'RS256', kid: cfg.signingKeyId }).setExpirationTime(exp).sign(key)
    return { iframeUrl: `${host}/${token}/iframe`, posterUrl: `${host}/${token}/thumbnails/thumbnail.jpg?time=1s` }
  },

  /** Verify Cloudflare's `Webhook-Signature: time=...,sig1=...` HMAC over `time.body`. */
  verifyWebhook(rawBody: string, header: string | null): boolean {
    if (!header) return false
    const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')))
    const cfg = getStreamConfig()
    const expected = createHmac('sha256', cfg.webhookSecret).update(`${parts.time}.${rawBody}`).digest('hex')
    return !!parts.sig1 && expected === parts.sig1
  },
}
```

> `Date.now()` runs at request time on the server here (fine — this is app runtime, not a Workflow script). If `jose` isn't already a dep, sign with `node:crypto` RS256 instead — confirm during this step.

- [ ] **Step 3:** `types.ts` — export the small result shapes used above. `pnpm tsc && pnpm lint`; grep import direction: `grep -rn "from '@/features" src/shared/services/providers/cloudflare-stream` → empty.
- [ ] **Step 4:** Provision in Cloudflare: create the Stream API token, a signing key, and a webhook pointing at `https://<prod-host>/api/webhooks/cloudflare-stream`. Record env values (do not commit secrets). Commit code (`feat(providers): cloudflare-stream client (direct upload, playback, webhook verify)`).

---

## Task 5: Provider branch in the media service + video strategy

**Files:** Modify `src/shared/services/media/{stores.ts,media.service.ts,optimization-target.ts}`, `src/shared/lib/file-optimization/strategies/video.ts`

**Interfaces:**
- Consumes: `cloudflareStream`, `classifyFileKind`, Plan 1 `mediaService`, `MediaStore`.
- Produces: `buildUploadTarget` → discriminated `UploadTarget`; `createRecord`/`removeRecord` provider-aware; `mediaService.completeStreamAsset(uid,{duration})`; `findMediaByExternalId(uid)`; `videoStrategy`; `MediaStore.videoRequireSignedUrls`.

- [ ] **Step 1:** `stores.ts` — add `videoRequireSignedUrls: boolean` to `MediaStore`; `projectMediaStore: false`, `proposalMediaStore: true`.
- [ ] **Step 2:** `media.service.ts` — extend `buildUploadTarget` to branch by kind:

```ts
async buildUploadTarget(store, input) {
  if (classifyFileKind(input.mimeType) === 'video') {
    const { uploadURL, uid } = await cloudflareStream.createDirectUpload({
      maxDurationSeconds: 600, requireSignedURLs: store.videoRequireSignedUrls, meta: { ownerKind: store.ownerKind },
    })
    return { backend: 'stream' as const, uploadUrl: uploadURL, streamUid: uid }
  }
  const pathKey = store.buildPathKey(input.ownerId, crypto.randomUUID(), extOf(input.filename), input.extra)
  const uploadUrl = await r2Client.getPresignedUploadUrl({ bucket: store.bucket, pathKey, mimeType: input.mimeType })
  return { backend: 'r2' as const, uploadUrl, pathKey, bucket: store.bucket }
}
```

- [ ] **Step 3:** `createRecord` — dispatch optimize only for r2 image/pdf; stream rows insert `processing`, no dispatch:

```ts
async createRecord(store, values) {
  const [created] = await db.insert(store.table).values(values as any).returning()
  if (created.provider === 'r2') {
    const kind = classifyFileKind(created.mimeType)
    if (kind === 'image' || kind === 'pdf')
      void optimizeMediaJob.dispatch({ ownerKind: store.ownerKind, mediaId: created.id })
  }
  return created
}
```

(Callers for video pass `{ provider:'stream', externalId: streamUid, optimizationStatus:'processing', pathKey:null, bucket:null, ... }`.)
- [ ] **Step 4:** `removeRecord` — branch on provider:

```ts
async removeRecord(store, id) {
  const [row] = await db.select().from(store.table).where(eq(store.table.id, id))
  if (!row) return
  if (row.provider === 'stream' && row.externalId) await cloudflareStream.deleteVideo(row.externalId)
  else if (row.bucket && row.pathKey) await r2Client.deleteMediaWithVariants(row.bucket, row.pathKey)
  await db.delete(store.table).where(eq(store.table.id, id))
}
```

- [ ] **Step 5:** `optimization-target.ts` — add `findMediaByExternalId(uid)` scanning both stores' tables (returns `{ ownerKind, table, row } | null`). `media.service.ts` — `completeStreamAsset(uid, { duration })`: find row → `setMediaOptimizationOutcome(table, row.id, { status:'optimized', duration })`.
- [ ] **Step 6:** `video.ts` strategy — reconciliation/retry path (query Stream):

```ts
export const videoStrategy: FileOptimizationStrategy = {
  kind: 'video',
  async optimize(ref) {
    if (ref.provider !== 'stream' || !ref.externalId) return { status: 'failed' }
    const v = await cloudflareStream.getVideo(ref.externalId)
    return v.readyToStream ? { status: 'optimized', duration: v.duration ?? undefined } : { status: 'processing' }
  },
}
```

- [ ] **Step 7:** `pnpm tsc && pnpm lint`; grep `grep -rn "from '@/features" src/shared/services/media` → empty. Commit (`feat(media): stream provider branch (upload/create/remove) + video strategy`).

---

## Task 6: Stream readiness webhook

**Files:** Create `src/app/api/webhooks/cloudflare-stream/route.ts`

**Interfaces:**
- Consumes: `cloudflareStream.verifyWebhook`, `mediaService.completeStreamAsset`.

- [ ] **Step 1:** Route handler (per webhook convention — verify → switch → 200-always):

```ts
// src/app/api/webhooks/cloudflare-stream/route.ts
import { cloudflareStream } from '@/shared/services/providers/cloudflare-stream/client'
import { mediaService } from '@/shared/services/media/media.service'

export async function POST(req: Request) {
  const raw = await req.text()
  if (!cloudflareStream.verifyWebhook(raw, req.headers.get('Webhook-Signature')))
    return new Response('unauthorized', { status: 401 })
  let body: any
  try { body = JSON.parse(raw) } catch { return new Response('bad request', { status: 400 }) }
  try {
    // Stream fires on state changes; act only when ready.
    if (body?.uid && (body.readyToStream === true || body.status?.state === 'ready'))
      await mediaService.completeStreamAsset(body.uid, { duration: body.duration ?? undefined })
  }
  catch (err) {
    console.error('[cloudflare-stream webhook]', err)
    // 200-always once verified; retry/reconciliation covers misses.
  }
  return Response.json({ ok: true })
}
```

- [ ] **Step 2:** Add the route to the vendor map in `docs/codebase-conventions/webhook-routes.md`.
- [ ] **Step 3:** `pnpm tsc && pnpm lint`. Manual (deploy preview or ngrok): upload a video → after transcode, webhook flips the row to `optimized` + sets `duration`. Commit (`feat(webhooks): cloudflare-stream readiness → optimized + duration`).

---

## Task 7: Provider-aware read resolver → unified `MediaItem`

**Files:** Modify `src/shared/components/media/types.ts` (`MediaItem` + `kind`/`posterUrl`/`duration`/`pageCount`), `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts` + `dal/server/queries.ts` (`toProposalMediaView`), `src/trpc/routers/projects.router/media.router.ts` (project view building)

**Interfaces:**
- Consumes: `cloudflareStream.buildPlaybackUrls`, `r2Client.getPresignedDownloadUrl`, `classifyFileKind`.
- Produces: `MediaItem` gains `kind: FileKind`, `posterUrl?: string | null`, `duration?: number | null`, `pageCount?: number | null`; both owners' read paths populate them.

- [ ] **Step 1:** Extend `MediaItem` (design §2.5) with `kind`, `posterUrl`, `duration`, `pageCount`.
- [ ] **Step 2:** Proposal `resolve-media-url.ts` — provider-aware resolution of one row → view:

```ts
// returns { url, posterUrl, kind } for a proposal media row
// stream → cloudflareStream.buildPlaybackUrls(externalId, { requireSignedURLs: true }) → { iframeUrl→url, posterUrl }
// r2 pdf → presigned original → url; presigned thumbnailPathKey → posterUrl
// r2 image → best variant presigned → url (blurDataUrl passthrough)
// r2 other → presigned original → url
```

Update `toProposalMediaView` to attach `kind = classifyFileKind(row.mimeType)`, `duration`, `pageCount`.
- [ ] **Step 3:** Project side — where the project media list is mapped to the UI (Plan 1's project manager feed), build the same fields: stream video → `buildPlaybackUrls(externalId, { requireSignedURLs: false })`; r2 pdf → public/presigned original + thumbnail; image → existing url + blur. Keep project images on the public CDN url (no presign).
- [ ] **Step 4:** `pnpm tsc && pnpm lint`. Manual: proposal `getFullView` returns homeowner video with a signed iframe url + poster; a project pdf returns a thumbnail url. Commit (`feat(media): provider-aware read resolver → unified MediaItem (kind/poster/duration)`).

---

## Task 8: Shared XHR upload transport (progress + abort + retry) + dropzone

**Files:** Create `src/shared/lib/upload/xhr-upload.ts`; Modify `src/shared/hooks/use-media-upload.ts`; add `react-dropzone`

**Interfaces:**
- Produces: `uploadWithProgress(url,file,{method,headers,onProgress,signal}): Promise<void>`; `useMediaUpload` exposes per-file `{ status, progress, error, abort, retry }` and a `getRootProps`/`getInputProps` (dropzone) surface; supports both `r2` (PUT) and `stream` (POST multipart) backends via the discriminated `UploadTarget`.

- [ ] **Step 1:** Add dep: `pnpm add react-dropzone`.
- [ ] **Step 2:** Transport:

```ts
// src/shared/lib/upload/xhr-upload.ts
export function uploadWithProgress(url: string, body: XMLHttpRequestBodyInit, opts: {
  method: 'PUT' | 'POST', headers?: Record<string, string>, onProgress?: (pct: number) => void, signal?: AbortSignal,
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(opts.method, url)
    for (const [k, v] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && opts.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
    xhr.onerror = () => reject(new Error('Upload network error'))
    opts.signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(body)
  })
}
```

- [ ] **Step 3:** Generalize `useMediaUpload`: per-file state machine `{ id, file, status:'queued'|'uploading'|'processing'|'done'|'error', progress, objectUrl, error, controller }`. Flow per file: `getUploadUrl` → if `backend==='stream'` POST a `FormData` (field `file`) to `uploadUrl` else PUT the raw file to the presigned url (header `Content-Type: file.type`), both via `uploadWithProgress` with the file's `AbortController.signal` → `create` with the right provider payload → status `processing` (stream/optimize) or `done`. `createObjectURL` once at enqueue; `revokeObjectURL` on removal. `abort(id)`/`retry(id)` helpers.
- [ ] **Step 4:** Wire `react-dropzone` (`useDropzone`) into the hook/manager: `accept` from the owner config, `onDrop` enqueues. Keep the existing upload button working (dropzone wraps it).
- [ ] **Step 5:** `pnpm tsc && pnpm lint`; grep import direction on `src/shared/lib/upload` + `src/shared/hooks/use-media-upload.ts` → no `@/features`. Manual: upload a large file, watch the % bar; cancel mid-upload; retry a failed one. Commit (`feat(upload): native-XHR progress transport + abort/retry + dropzone`).

---

## Task 9: Kind-aware `MediaCard` + homeowner gallery parity

**Files:** Modify `src/shared/components/media/media-card.tsx`, `src/shared/components/media/media-manager.tsx`, `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`

**Interfaces:**
- Consumes: `MediaItem` (`kind`,`url`,`posterUrl`,`duration`,`pageCount`,`optimizationStatus`), per-file upload progress (Task 8).

- [ ] **Step 1:** `MediaCard` branches on `item.kind`:
  - `image` → `OptimizedImage` + blur (unchanged).
  - `video` → `posterUrl` `<img>` + a play badge + a `duration` chip; a "Processing…" overlay while `optimizationStatus !== 'optimized'`; click → dialog embedding `<iframe src={item.url} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen />` (the Stream player).
  - `pdf` → `posterUrl` thumbnail (fallback: a document card with the file icon when the raster is absent/processing) + a page-count badge; click → open `item.url` (presigned original) in a new tab.
  - `other` → document card + download.
- [ ] **Step 2:** `MediaManager` — render each queued upload's progress bar (from Task 8 state) above the grid; show the "processing" state for freshly-created video/pdf until optimized (reuse the existing edit-view optimization polling, extended to clear on video/pdf too).
- [ ] **Step 3:** `proposal-media-gallery.tsx` (homeowner) — render homeowner items by kind: images inline, videos via the same iframe player, PDFs as download cards. Renders null when empty (unchanged).
- [ ] **Step 4:** `pnpm tsc && pnpm lint`. Manual: a proposal with a homeowner image + video + PDF renders correctly for a token (homeowner) view — video plays via signed iframe, PDF shows the first-page thumbnail and downloads.
- [ ] **Step 5: Media Regression Checklist** — full pass (both owners). Commit (`feat(media): kind-aware MediaCard (video iframe / pdf thumbnail / processing) + homeowner gallery`).

---

## Task 10: Server-side upload limits

**Files:** Modify `src/trpc/routers/proposals.router/media.router.ts`, `src/trpc/routers/projects.router/media.router.ts`

**Interfaces:**
- Consumes: nothing new; adds validation in `getUploadUrl`/`create`.

- [ ] **Step 1:** In each owner's `getUploadUrl`, enforce **server-side** (not client-trusted): MIME allowlist (`image/*`, `video/*`, `application/pdf`); reject others with `BAD_REQUEST`. For video, pass `maxDurationSeconds: 600` to `createDirectUpload` (already Task 5) and reject client-declared `size > 500 * 1024 * 1024`. For image/pdf keep Plan 1's size ceiling.
- [ ] **Step 2:** Add the input fields needed (`mimeType`, `size?`) to the procedures' Zod input if not present; validate before minting any upload target.
- [ ] **Step 3:** `pnpm tsc && pnpm lint`. Manual: attempt an oversized/again-disallowed upload → rejected before an upload URL is issued. Commit (`feat(media): server-side MIME allowlist + size/duration ceilings`).

---

## Task 11: Docs + regression sign-off

**Files:** Modify `docs/codebase-conventions/webhook-routes.md` (done Task 6), create/extend `src/shared/lib/file-optimization/DOCS.md`, `src/shared/services/media/DOCS.md`, `src/shared/services/providers/cloudflare-stream/DOCS.md`; update `environment.md` env table

- [ ] **Step 1:** `file-optimization/DOCS.md` — the strategy registry contract (`FileKind` → strategy; `MediaAssetRef`/`FileOptimizationOutcome`; "add a kind = add a strategy, never a branch"). PDF raster serverless recipe + the Vercel tracing requirement.
- [ ] **Step 2:** `media/DOCS.md` — provider branch (`buildUploadTarget`/`createRecord`/`removeRecord`), `videoRequireSignedUrls`, `completeStreamAsset`, `findMediaByExternalId`. `cloudflare-stream/DOCS.md` — env, direct-upload flow, signed vs public playback, webhook.
- [ ] **Step 3:** `environment.md` — add the six Stream env keys + where they're set.
- [ ] **Step 4:** `pnpm lint`. Commit (`docs(media): strategy registry + stream provider + env`).

---

## Media Regression Checklist (run wherever referenced)

`pnpm dev`. **Project (portfolio):** (1) JPG upload → variants+blur+optimized (unchanged from Plan 1); (2) reorder/hero/phase/rename/delete/retry all still work; (3) PDF upload → first-page thumbnail + page badge; (4) video upload → progress bar → processing → plays via public iframe + duration chip; (5) delete video removes the Stream asset. **Proposal:** (6) image/video/PDF upload with Internal/Homeowner toggle; (7) homeowner token view: image inline, video via **signed** iframe, PDF thumbnail + download; (8) locked proposal still allows media edits (lock-exempt). Any deviation = a strategy/provider/UI generalization broke an incumbent — fix before proceeding.

---

## Self-Review

**Spec coverage (design §9 checklist):**
- Strategy registry + relocated image strategy → Task 2 ✅
- PDF raster (pdfjs+canvas) + tracing + deploy smoke test → Task 3 ✅
- `thumbnailPathKey`+`pageCount` shared into base → Task 1 ✅
- Cloudflare Stream provider (upload/get/delete/playback/webhook-verify) → Task 4 ✅
- Provider branch in service + `videoRequireSignedUrls` + video strategy → Task 5 ✅
- Readiness webhook (verify→externalId→optimized+duration→200-always) → Task 6 ✅
- Provider-aware resolver → unified `MediaItem` → Task 7 ✅
- XHR progress transport + abort/retry + dropzone + generalized hook → Task 8 ✅
- Kind-aware `MediaCard` + homeowner gallery parity → Task 9 ✅
- Server-side MIME/size/duration limits → Task 10 ✅
- Env + Cloudflare provisioning + DOCS → Task 4/11 ✅
- Project-media regression intact after relocation → Task 2/9 checklist ✅

**Placeholder scan:** no TBD/"add error handling"/"similar to". The two intentional deferrals are documented in the design (§8: tus resumable; hls.js custom player) and out of this plan's scope.

**Type consistency:** `FileKind`/`classifyFileKind`, `MediaAssetRef`/`FileOptimizationOutcome`/`FileOptimizationStrategy`/`strategyRegistry`, `optimizeFile`, `setMediaOptimizationOutcome`, `cloudflareStream.{createDirectUpload,getVideo,deleteVideo,buildPlaybackUrls,verifyWebhook}`, `UploadTarget` (`backend:'r2'|'stream'`), `videoRequireSignedUrls`, `completeStreamAsset`, `findMediaByExternalId`, `videoStrategy`, `MediaItem`(`kind`/`posterUrl`/`duration`/`pageCount`), `uploadWithProgress` — consistent across tasks.

**Implementer confirmations (inline, flagged):** exact Cloudflare Stream endpoint bodies + signed-token algorithm (Task 4 note); `jose` presence vs `node:crypto` RS256 (Task 4 Step 2); `@napi-rs/canvas` ctx cast for pdfjs (Task 3); the `.pnpm/@napi-rs+canvas@*` / `pdfjs-dist@*` trace globs (Task 3 Step 6 deploy smoke test is the gate).

**Risk controls:** the image relocation (Task 2) is behavior-preserving and regression-gated immediately; the PDF tracing config has a dedicated deploy-preview gate (Task 3 Step 6) because it can't fail locally; the webhook is 200-always with retry/reconciliation for misses; secrets never reach the client; every service/UI/lib task greps clean of `@/features`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-05-media-video-pdf-optimization.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach? (Note: this plan is gated on Plan 1 being executed first — video/PDF build on Plan 1's shared engine.)
