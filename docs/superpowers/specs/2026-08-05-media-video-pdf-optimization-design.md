# Media Optimization — Video (Cloudflare Stream) + PDF Raster (Plan 1b) — Design

**Status:** Design (brainstormed 2026-08-05). Companion to Plan 1 (`docs/superpowers/plans/2026-08-05-proposal-media-subsystem.md`) and the parent spec (`2026-08-05-proposal-capabilities-media-portfolio-finance-design.md`). Terminal step: `writing-plans` → `docs/superpowers/plans/2026-08-05-media-video-pdf-optimization.md`.

**Goal:** Complete the media capability's two deferred, high-value optimization paths — **video** (make phone-uploaded clips play cross-browser + get posters/duration) and **PDF first-page raster** (a visual thumbnail) — landing both in the *shared* `optimizeFile` engine so **both owners** (project portfolio + proposal) benefit. Along the way, harvest a client-driven **upload progress UX** so large uploads feel responsive without a paid upload service.

**Non-negotiable framing (from the user):** no thin/ad-hoc/hyper-specific APIs; no backwards-compat burden (Plan 1 hasn't shipped — reshape freely); minimize dependence on paid services where a non-paid path is genuinely viable.

---

## 0. What Plan 1 already provides (prerequisite)

Plan 1 was amended to make the media model **provider-aware from day one** (folded in per the schema decision). `baseMediaColumns` on **both** `media_files` and `proposal_media_files`:

- `provider: 'r2' | 'stream'` (`notNull default 'r2'`)
- `pathKey` / `bucket` — **nullable** (an R2 object has them; a Stream asset does not)
- `externalId` — nullable provider asset id (the Stream UID)
- plus the already-present `duration`, `pageCount` (proposal), `thumbnailPathKey` (proposal), `optimizationStatus`, `optimizationVariants`, `blurDataUrl`

Plan 1 writes **only** `provider = 'r2'`. Plan 1b implements everything `'stream'`, the strategy registry, the PDF raster strategy, the provider-aware read resolver, the shared upload transport, and the kind-aware UI. The only schema delta for 1b (see §4) is promoting the proposal-only `thumbnailPathKey` + `pageCount` into `baseMediaColumns`, so **project** PDFs/videos can also carry a raster thumbnail + page count.

---

## 1. The decisions this design implements

| Concern | Decision | Why |
|---|---|---|
| Video playback/transcode | **Cloudflare Stream** | Only path that fixes iPhone HEVC/.mov not playing in Chrome/Firefox; auto poster + duration + adaptive HLS; signed-token playback fits the homeowner-privacy model; consistent with our Cloudflare stack; no ffmpeg-on-serverless. |
| Video readiness signal | **Stream webhook** (`/api/webhooks/cloudflare-stream`) | The upload transcript offered **no** client-side substitute for transcoding; event-driven, no polling waste. Retry/refresh path re-queries Stream as reconciliation. |
| Video playback surface | **Stream `<iframe>` player** (no hls.js) | m3u8 needs hls.js in Chrome/Firefox; the iframe player handles adaptive playback + poster + signed tokens across all browsers with **zero JS dependency**. |
| PDF preview | **First-page raster** via `pdfjs-dist` + `@napi-rs/canvas` → webp thumbnail | Serverless-friendly (prebuilt binaries, no system deps); fits the existing pull-buffer→process→write-back job pattern. |
| Upload UX | **Shared XHR-progress transport** (harvested from the transcript) | `fetch()` cannot report upload progress (current code uses `fetch` → no progress bar); native `XMLHttpRequest.upload.onprogress` gives real per-file progress with no paid service. |
| Large-video resumability | **Deferred** — single-request upload now; `tus-js-client` documented as the future upgrade | Proposal/portfolio clips are not multi-GB; avoid a dep until reliability data demands it. |

---

## 2. Architecture

Five pillars. Each is owner-agnostic and provider-agnostic at its seam; provider/owner differences are pushed to the edges (config + call-site), never special-cased in the middle.

### 2.1 File-kind strategy registry — the general optimization API

`optimizeFile` stops being an if/else over image-vs-pdf and becomes a **registry keyed by `FileKind`**, each strategy honoring one interface: *"bring this media row to its ready presentation state."*

```ts
// src/shared/lib/file-optimization/types.ts
export type FileKind = 'image' | 'video' | 'pdf' | 'other'
export function classifyFileKind(mimeType: string): FileKind

/** Provider-neutral description of the asset a strategy operates on. */
export interface MediaAssetRef {
  provider: MediaProvider        // 'r2' | 'stream'
  bucket: string | null
  pathKey: string | null
  externalId: string | null      // Stream UID for provider 'stream'
  thumbnailPathKey: string | null // destination for a generated raster (pdf)
  mimeType: string
}

/** Uniform result the generic setters know how to persist. */
export interface FileOptimizationOutcome {
  status: 'optimized' | 'processing' | 'failed'
  variants?: string[]            // image
  blurDataUrl?: string           // image (and optionally pdf-thumb)
  pageCount?: number             // pdf
  duration?: number              // video
  thumbnailPathKey?: string      // pdf (echoes where the raster was written)
}

export interface FileOptimizationStrategy {
  kind: FileKind
  optimize: (ref: MediaAssetRef) => Promise<FileOptimizationOutcome>
}
```

- **`imageStrategy`** — `getObject` → `processImageVariants` (existing) → `putObject` variants → `{ status:'optimized', variants, blurDataUrl }`. (Unchanged behavior, relocated behind the interface.)
- **`pdfStrategy`** — `getObject` → render page 1 (see §2.3) → webp → `putObject(thumbnailPathKey)` → `{ status:'optimized', pageCount, thumbnailPathKey, blurDataUrl? }`.
- **`videoStrategy`** — query Stream by `externalId`; `readyToStream` → `{ status:'optimized', duration }`; else `{ status:'processing' }`. Never pulls bytes.
- **`otherStrategy`** — `{ status:'optimized' }` (nothing to derive; downloadable as-is).

`optimizeMediaFile({ ownerKind, mediaId })` (Plan 1) is unchanged in shape: load row → build `MediaAssetRef` → `registry[classifyFileKind(mimeType)].optimize(ref)` → persist via the generic setters (extended to also write `duration`, `pageCount`, `thumbnailPathKey`). **Idempotent** (safe to re-run — the retry/reconciliation path).

> Why this shape and not a `switch`: adding a future kind (e.g. `audio`) or a future provider is a new strategy object, not a new branch threaded through the router/UI. The router and the job never learn what a "video" is.

### 2.2 Upload target — one discriminated seam for two backends

`mediaService.buildUploadTarget` (Plan 1, r2-only) is extended to branch on `classifyFileKind`:

```ts
type UploadTarget =
  | { backend: 'r2'; uploadUrl: string; pathKey: string; bucket: R2BucketName }
  | { backend: 'stream'; uploadUrl: string; streamUid: string }

buildUploadTarget(store, { ownerId, filename, mimeType }): Promise<UploadTarget>
// image/pdf/other → presigned R2 PUT (as today)
// video           → cloudflareStream.createDirectUpload({ requireSignedURLs: store.videoRequireSignedUrls, maxDurationSeconds })
```

`createRecord` branches on `provider`:
- `'r2'` → insert (`pathKey`/`bucket` set) + dispatch `optimizeMediaJob` (image/pdf).
- `'stream'` → insert (`externalId` set, `pathKey`/`bucket` null, `optimizationStatus:'processing'`) + **no job dispatch** (Stream transcodes on its own; the webhook finalizes).

`removeRecord` branches on `provider`: `'r2'` → `deleteMediaWithVariants`; `'stream'` → `cloudflareStream.deleteVideo(externalId)` (+ delete the row).

`MediaStore` (Plan 1) gains one flag: `videoRequireSignedUrls: boolean` — `projectMediaStore:false` (portfolio is public), `proposalMediaStore:true` (homeowner-gated, tokened). Stream account config is global, not per-store.

### 2.3 PDF raster strategy (serverless)

Recipe inside the optimize job (Node runtime, `maxDuration=60`, well within budget — page-1 render is sub-2s):

- `pdfjs-dist` **legacy Node build** (`pdfjs-dist/legacy/build/pdf.mjs`), worker disabled (`isEvalSupported:false`, `useWorkerFetch:false`), `standardFontDataUrl` pointed at the shipped fonts dir.
- `@napi-rs/canvas` supplies the `CanvasFactory` / canvas backing (prebuilt `.node` binary, no system libs).
- Render page 1 at a target width (~1000px) → `canvas.toBuffer('image/png')` → `sharp` → webp → `putObject(bucket, thumbnailPathKey, buf, 'image/webp')`. `thumbnailPathKey` = original base path + `-thumb.webp`.
- `pageCount` from `pdfDoc.numPages`. Optional `blurDataUrl` from the thumb (cheap, nice for the card).

**Vercel bundling caveat (load-bearing):** the qstash-jobs route must trace the `@napi-rs/canvas` `.node` binary + `pdfjs` standard-font assets, via `outputFileTracingIncludes` in `next.config` (same mechanism `pdfkit` already required — see memory `feedback-pdfkit-direct-dep`). The plan includes a deploy-preview smoke test for this, because it only fails in the Vercel bundle, not locally.

### 2.4 Cloudflare Stream provider

New leaf provider following the codebase convention (`client.ts` singleton + `types.ts` + `lib/config.ts`; leaf = primitives in/out, no domain types, no DB writes), REST via `fetch` — **no Stream SDK dependency**.

```
src/shared/services/providers/cloudflare-stream/
  client.ts    cloudflareStream.{createDirectUpload, getVideo, deleteVideo, buildPlaybackUrls, verifyWebhook}
  types.ts     StreamVideo, StreamDirectUpload, playback URL shapes
  lib/config.ts  env resolution (lazyProxy, like r2)
```

- **`createDirectUpload({ requireSignedURLs, maxDurationSeconds, meta })`** → `POST /accounts/{acct}/stream/direct_upload` → `{ uploadURL, uid }`. `meta` carries `{ ownerKind }` for webhook disambiguation.
- **Client upload** → the shared XHR-progress transport POSTs the file to `uploadURL` (Stream's one-time upload URL; single request; progress via `xhr.upload.onprogress`).
- **`getVideo(uid)`** → `GET /stream/{uid}` → `{ readyToStream, duration, thumbnail }` (readiness reconciliation + retry).
- **`deleteVideo(uid)`** → `DELETE /stream/{uid}`.
- **`buildPlaybackUrls(uid, { requireSignedURLs })`** → returns `{ iframeUrl, posterUrl }`. Public videos (project) use `https://customer-<code>.cloudflarestream.com/<uid>/…` directly. Signed videos (proposal) mint a short-lived **signed token** (Stream signing key) appended to the iframe + thumbnail URLs. Poster = `.../thumbnails/thumbnail.jpg?time=1s` (+ token if signed).
- **`verifyWebhook(body, header)`** → HMAC check of Cloudflare's `Webhook-Signature` (`time` + `sig1`) against `CLOUDFLARE_STREAM_WEBHOOK_SECRET`.

**Readiness webhook** — `src/app/api/webhooks/cloudflare-stream/route.ts` (per webhook convention: one route, verify secret, switch, **200-always-once-verified**, log failures):
1. `verifyWebhook` → 401 on mismatch.
2. Parse the ready event → `uid`, `duration`, `readyToStream`.
3. Resolve the media row by `externalId = uid` across both media tables (`mediaService.completeStreamAsset(uid, { duration })` → uses a `findMediaByExternalId` in the optimize-target registry).
4. Set `optimizationStatus='optimized'`, `duration`. Return `{ ok:true }`.
5. On handler throw: log to the shared `webhook_errors` record path + still 200 (reconciliation/retry covers misses).

### 2.5 Provider-aware read resolver — unified presentation

The read side (Plan 1's `resolveProposalMediaUrl` / project url building) becomes **one provider-aware resolver** producing a single presentation shape regardless of backend:

```ts
// MediaItem (extends Plan 1's) — what the UI consumes
interface MediaItem {
  id: number
  name: string
  kind: FileKind                 // NEW — UI branches on this, not on mime parsing
  url: string                    // image: best variant | pdf: presigned original | video: iframe playback URL
  posterUrl?: string | null      // video poster / pdf thumbnail (presigned) — the grid image
  blurDataUrl?: string | null
  optimizationStatus?: string
  duration?: number | null
  pageCount?: number | null
  sortOrder?: number
}
```

Resolution by (`provider`,`kind`):
- **r2 image** → best-available variant URL (public CDN for project; presigned for proposal) + `blurDataUrl`.
- **r2 pdf** → presigned original as `url` (download/open) + presigned `thumbnailPathKey` as `posterUrl` + `pageCount`.
- **stream video** → `cloudflareStream.buildPlaybackUrls` → iframe `url` + `posterUrl` (+ signed token when the owner requires it) + `duration`.
- **r2 other** → presigned original as `url`.

Presign/token TTLs stay short (proposal reads already do this per-request); the homeowner token model is unchanged — a homeowner viewing a proposal gets freshly-signed media URLs on each `getFullView`.

### 2.6 Shared XHR-progress upload transport (the harvested UX)

A single client transport used by **every** upload (R2 PUT and Stream POST), replacing the current progress-blind `fetch`:

```ts
// src/shared/hooks/use-media-upload.ts (generalized in Plan 1; upgraded here)
uploadWithProgress(url, file, { method, headers, onProgress, signal }): Promise<void>
// native XMLHttpRequest; xhr.upload.onprogress → onProgress(0..100); xhr.onload status 2xx; xhr.onerror reject; signal → xhr.abort()
```

Harvested patterns (from the transcript, hardened):
- **Per-file state machine**: `{ id, file, status: 'queued'|'uploading'|'processing'|'done'|'error', progress, objectUrl, error }`. Uploads run per file; the manager shows a real progress bar + a "processing" state after upload while optimization/transcode completes.
- **Optimistic preview** via `URL.createObjectURL(file)` created **once on drop** (not in render, so progress ticks don't thrash the `<img>`), revoked on removal — no memory leak.
- **Abort + retry** (the transcript **lacked** both): every in-flight upload gets an `AbortController`; a failed file shows a Retry affordance. This is the deliberate hardening over the tutorial.
- **Server-side validation** (the transcript **omitted** auth + real limits): the `getUploadUrl`/`createDirectUpload` procedures enforce MIME allowlist + size/duration ceilings + CASL scope **server-side** — never trusting the client dropzone limits.
- **Drag-and-drop** via `react-dropzone` (accessible, small) layered onto the existing upload button — *enhancement, not replacement*. (Open dependency question — see §6; a native-DnD fallback exists if we want zero new UI deps.)

### 2.7 Kind-aware rendering

`MediaCard` (Plan 1's generalized card) branches on `item.kind`:
- **image** → `OptimizedImage` + blur (as today).
- **video** → `posterUrl` `<img>` with a play badge; click → dialog embedding the **Stream iframe player** (`item.url`); a `processing` overlay while `optimizationStatus !== 'optimized'`.
- **pdf** → `posterUrl` thumbnail (or a document card fallback if the raster is still processing/absent) + page-count badge; click → open the presigned original.
- **other** → document card + download.

The homeowner proposal gallery (Plan 1 E1) uses the same `MediaItem`/kind branching: images inline, videos via the iframe player, PDFs as download cards.

---

## 3. End-to-end flows

**Upload a phone video to a proposal (Internal):**
1. Agent drops `clip.mov` (HEVC) → dropzone shows optimistic thumbnail + queued.
2. `getUploadUrl` (kind=video) → server `createDirectUpload({ requireSignedURLs:true })` → `{ backend:'stream', uploadUrl, streamUid }`.
3. Transport POSTs the file to `uploadUrl` with live progress → `create({ provider:'stream', externalId:streamUid, … })` → row `optimizationStatus:'processing'`, `visibility:'internal'`.
4. Card shows "processing"; Stream transcodes HEVC→HLS.
5. Stream webhook fires → row → `optimized` + `duration`. Card flips to a playable poster.
6. Agent toggles the file → `homeowner`; it now appears in the homeowner gallery, playing via a **signed** iframe URL (tokened per homeowner view).

**Upload a PDF to a project:** presigned PUT (progress) → `create(provider:'r2')` → optimize job → `pdfStrategy` writes `-thumb.webp` + `pageCount` → card shows first-page thumbnail.

---

## 4. Data model delta (small)

- **Move `thumbnailPathKey` + `pageCount` into `baseMediaColumns`** (currently proposal-only) so **project** PDFs/videos can also carry a raster thumbnail / page count. This is a Plan 1 edit if sequenced there, or the first task of Plan 1b (a tiny additive migration on `media_files`: add `thumbnail_path_key`, `page_count`, both nullable). No back-compat concern.
- `MediaStore.videoRequireSignedUrls: boolean` (config, not a column).
- No other schema changes — `provider`/`externalId`/nullable `pathKey`/`bucket` already landed in Plan 1.

---

## 5. Security & guardrails

- **Webhook**: HMAC-verify `Webhook-Signature`; 401 on failure before any work; 200-always once verified; failures logged, reconciled by retry.
- **Stream API token** is server-only (provider config via `lazyProxy`); **never** shipped to the client. The client only ever sees a one-time `uploadURL` and (for playback) short-lived signed URLs.
- **Signed playback**: proposal videos require signed URLs; tokens are short-TTL and minted per read (same posture as proposal presigned R2 reads). Project (portfolio) videos are public by design.
- **Server-side limits** (not client-trusted): MIME allowlist (`image/*`, `video/*`, `application/pdf`), max size (images/pdf), max video **duration** (`maxDurationSeconds` on `createDirectUpload`) + a sane byte ceiling. Reject early in `getUploadUrl`/`createDirectUpload`.
- **PDF render** runs on trusted-ish agent uploads, but pdfjs is sandboxed (`isEvalSupported:false`, worker off) to avoid font/JS execution surprises.

---

## 6. Dependencies (explicit — minimize, none paid-managed beyond Stream)

**Add (all OSS, no paid tier):**
- `pdfjs-dist` — PDF page rendering (required by the PDF decision).
- `@napi-rs/canvas` — serverless canvas backing for pdfjs (prebuilt binaries).
- `react-dropzone` — drag-drop upload UX. **Open question:** this is the one *convenience* dep. Recommended (small, accessible, matches the harvested pattern), but a native drag/drop + hidden `<input>` fallback exists if you'd rather add zero new UI deps. Default: include it; easy to cut.

**Explicitly NOT added:**
- No Stream SDK — REST via `fetch`.
- No `hls.js` / `@cloudflare/stream-react` — iframe player instead.
- No `tus-js-client` — single-request upload now; documented upgrade path for multi-GB resumable video.
- No `axios` — native `XMLHttpRequest` for progress.
- No Mux / UploadThing / other paid upload/transcode SaaS.

**Cloudflare Stream** is the one paid service — unavoidable for cross-browser video playback, and the whole point of the video decision.

---

## 7. Environment / config (per `docs/codebase-conventions/environment.md`)

New keys (server-only): `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE` (the `customer-<code>` subdomain), `CLOUDFLARE_STREAM_WEBHOOK_SECRET`, and for signed playback a Stream signing key pair (`CLOUDFLARE_STREAM_KEY_ID` + `CLOUDFLARE_STREAM_JWK`). Config resolved via a `lazyProxy` so missing creds don't crash boot (mirrors r2). Stream webhook + signing key are provisioned once in the Cloudflare dashboard/API.

---

## 8. Out of scope / future

- **Resumable/multipart large-video upload** (`tus`) — add only if single-request video uploads prove unreliable at real file sizes.
- **Custom HLS player** (hls.js) / branded player skinning — iframe player is sufficient.
- **Animated preview thumbnails**, per-scene posters, captions/subtitles — Stream supports these; not needed now.
- **Live streaming** — irrelevant.
- **Multi-page PDF galleries** — first-page raster only; full-doc viewing is the presigned download.

---

## 9. Requirements checklist (Plan 1b)

- [ ] `FileKind` + `classifyFileKind` + strategy registry; `imageStrategy` relocated behind the interface (no behavior change; regression-checked).
- [ ] `pdfStrategy` — pdfjs + @napi-rs/canvas → webp thumbnail → `thumbnailPathKey`; `pageCount`; Vercel `outputFileTracingIncludes` + deploy-preview smoke test.
- [ ] `thumbnailPathKey` + `pageCount` shared into `baseMediaColumns` (additive migration on `media_files`).
- [ ] Cloudflare Stream provider (`client.ts`/`types.ts`/`lib/config.ts`): direct upload, getVideo, deleteVideo, buildPlaybackUrls (public + signed), verifyWebhook.
- [ ] `buildUploadTarget` / `createRecord` / `removeRecord` branch on kind/provider (Stream path); `MediaStore.videoRequireSignedUrls`.
- [ ] `videoStrategy` (Stream readiness query) + retry/reconciliation.
- [ ] Stream readiness webhook route (verify → resolve by `externalId` → `optimized`+`duration` → 200-always; failure logging).
- [ ] Provider-aware read resolver → unified `MediaItem` (`kind`, `posterUrl`, `duration`, `pageCount`); proposal + project read paths use it.
- [ ] Shared XHR-progress upload transport (progress, optimistic preview, **abort + retry**, server-side limits); generalized `use-media-upload`.
- [ ] `react-dropzone` drag-drop layered on the upload button (or native fallback).
- [ ] `MediaCard` kind-aware rendering: image / video (poster + iframe player + processing state) / pdf (thumbnail + page badge) / other; homeowner gallery parity.
- [ ] Env keys + Cloudflare dashboard provisioning (Stream webhook + signing key) documented.
- [ ] DOCS: extend `file-optimization/DOCS.md` (strategy registry), `src/shared/services/media/DOCS.md` (provider branch), a `cloudflare-stream` provider DOCS/README, and the webhook route map in `webhook-routes.md`.
- [ ] Project-Media Regression Checklist (Plan 1) still green after the strategy-registry relocation.

---

## 10. Confirmations to resolve during plan-writing

- Exact Cloudflare Stream endpoints/response shapes + signed-URL token algorithm (verify against current Cloudflare docs at plan time — treat §2.4 as the flow contract, not final request bodies).
- Whether `thumbnailPathKey`/`pageCount` promotion into `baseMediaColumns` lands as a Plan 1 edit or Plan 1b Task 1 (default: Plan 1b Task 1, keeps Plan 1 frozen post-review).
- `react-dropzone` vs native DnD (§6).
- Video byte/duration ceilings (product call).
