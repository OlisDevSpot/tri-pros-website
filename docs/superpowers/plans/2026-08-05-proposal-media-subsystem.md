# Proposal Media Subsystem + Optimizer Generalization — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give proposals their own file store (photos/videos/PDFs) with a per-file `internal | homeowner` visibility toggle, a homeowner-facing gallery above the first SOW section, a generalized file-optimization pipeline, and a manual "import photos from a proposal" action inside the project gallery.

**Architecture:** A new proposal-owned `proposal_media_files` child table (parallel to `media_files`, NOT an overload of it). Files live in the existing private `tpr-homeowner-files` R2 bucket under a `proposals/{proposalId}/…` prefix and are served exclusively via short-TTL presigned GET URLs minted server-side. Image optimization is refactored into a shared, kind-dispatched `optimizeFile` core reused by both media tables. An agent-only `proposalMedia` tRPC sub-router (entity-scoped, CASL-guarded, **not** lock-gated) drives uploads/visibility. `getFullView` enriches the proposal with homeowner-visible media for the rendered gallery.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), Zod, TanStack Query, `@aws-sdk/client-s3` (R2), `sharp`, `pdf-lib`, Upstash QStash, dnd-kit, Tailwind v4, shadcn/ui.

## Global Constraints

- **Verification model (this repo has NO unit-test runner):** every task closes with `pnpm tsc` (must report no errors) and `pnpm lint` (must be clean), plus the task's stated manual / DB / Playwright check. Do **not** write vitest/jest/pytest — there is none. Never run `pnpm build`.
- **DB pushes:** schema changes go to the dev DB via `pnpm db:push:dev` ONLY. Never `db:push:prod` / bare `db:push`.
- **Git:** work on `main`, stage explicitly by path (never `git add -A`). Commit messages end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- **Money/ids:** proposal media PK mirrors `media_files` — `serial` integer (`unsafeId`), so all media-id inputs are `z.number()`. `proposalId` is a `uuid`.
- **Bucket:** proposal files → `R2_BUCKETS.homeownerFiles` (`'tpr-homeowner-files'`, private, no public domain). Path: `proposals/{proposalId}/{uuid}{ext}`.
- **Access:** proposal media is served ONLY via `r2Client.getPresignedDownloadUrl` — never a public URL. `proposal_media_files` has no `url` column by design.
- **Visibility default:** new files are `'internal'` until the agent flips them to `'homeowner'`.
- **Lock exemption:** proposal media edits are **not** gated by the proposal lock ladder (media is web-presentation, not signed-envelope content). Do NOT add `isProposalFrozen` checks to the media router/DAL.
- **Conventions:** one component per file, named exports, entity co-location, RHF+Zod for forms, `motion/react` (not framer-motion). Follow `memory/coding-conventions.md`.

---

## File Structure

**Create:**
- `src/shared/db/schema/proposal-media-files.ts` — table + `visibility` vocab + relations + zod schemas.
- `src/shared/lib/file-optimization/types.ts` — `FileKind`, `FileOptimizationResult`, `classifyFileKind`.
- `src/shared/lib/file-optimization/optimize-file.ts` — the shared kind-dispatched core (`optimizeFile`).
- `src/shared/lib/file-optimization/strategies/pdf.ts` — pdf-lib page-count strategy.
- `src/shared/lib/file-optimization/DOCS.md` — the optimizer API contract.
- `src/shared/entities/proposal-media-files/dal/server/queries.ts` — reads + optimization setters + presign resolver.
- `src/shared/entities/proposal-media-files/dal/server/mutations.ts` — insert/delete/reorder/setVisibility/rename (scope-checked).
- `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts` — best-variant-or-original presign helper.
- `src/shared/services/proposal-media.service.ts` — `optimizeFile(id)` persistence wrapper for proposal media.
- `src/shared/services/providers/upstash/jobs/optimize-proposal-media.ts` — the QStash job.
- `src/trpc/routers/proposals.router/media.router.ts` — `createProposalMediaRouter(entity)`.
- `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts` — client mutation hooks.
- `src/shared/hooks/use-proposal-media-upload.ts` — client upload hook.
- `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` — the Files-tab manager.
- `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx` — homeowner gallery.
- `src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx` — project-gallery import UI.

**Modify:**
- `src/shared/db/schema/index.ts` — export the new table.
- `src/shared/services/providers/r2/client.ts` — add `copyObject`.
- `src/shared/services/media.service.ts` — route image optimization through the shared core.
- `src/shared/services/providers/upstash/jobs/optimize-image.ts` — (unchanged behavior; verify still compiles).
- `src/app/api/qstash-jobs/route.ts` — register the new job.
- `src/trpc/routers/proposals.router/index.ts` — mount `media:` sub-router.
- `src/shared/entities/proposals/dal/server/queries.ts` — `getFullView` media enrichment + `ProposalWithCustomer` type.
- `src/features/proposal-flow/ui/components/form/index.tsx` — add the "Files" tab.
- `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx` — mount the gallery above the first SOW section.
- `src/trpc/routers/projects.router/media.router.ts` — add `importFromProposal` + a proposals-for-project list.
- `src/shared/components/portfolio/sortable-media-manager.tsx` — add the "Import from proposal" entry point.
- `src/shared/entities/proposals/DOCS.md` (+ `meetings/DOCS.md`, `projects/DOCS.md`) — new rules + stale-doc fix.

---

## Task 1: `proposal_media_files` schema + registration + DB push

**Files:**
- Create: `src/shared/db/schema/proposal-media-files.ts`
- Modify: `src/shared/db/schema/index.ts`

**Interfaces:**
- Produces: `proposalMediaFiles` (Drizzle table), `ProposalMediaFile` (select type), `insertProposalMediaFileSchema` / `InsertProposalMediaFile`, `proposalMediaVisibilities` (`readonly ['internal','homeowner']`), `ProposalMediaVisibility`.

- [ ] **Step 1: Create the schema file**

```ts
// src/shared/db/schema/proposal-media-files.ts
import type z from 'zod'
import { relations } from 'drizzle-orm'
import { integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { createdAt, unsafeId, updatedAt } from '../lib/schema-helpers'
import { proposals } from './proposals'

/**
 * Per-proposal file store (photos, videos, PDFs). Proposal-owned — deliberately
 * SEPARATE from `media_files` (which is portfolio/project-coupled: phase enum,
 * hero flag, project relations).
 *
 * Visibility model: each file is `internal` (agent-only) or `homeowner` (surfaced
 * on the rendered proposal). Visibility is a pure DB flag — toggling never moves
 * bytes. Access is ALWAYS via presigned GET URLs against the private
 * `tpr-homeowner-files` bucket; there is intentionally NO `url` column and no
 * public domain. See docs/superpowers/specs/2026-08-05-proposal-capabilities-*.md.
 */
export const proposalMediaVisibilities = ['internal', 'homeowner'] as const
export type ProposalMediaVisibility = (typeof proposalMediaVisibilities)[number]

export const proposalMediaFiles = pgTable('proposal_media_files', {
  id: unsafeId,
  proposalId: uuid('proposal_id')
    .notNull()
    .references(() => proposals.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  pathKey: text('path_key').notNull().unique(),
  bucket: text('bucket').notNull(),
  mimeType: text('mime_type').notNull(),
  fileExtension: text('file_extension').notNull(),
  visibility: text('visibility', { enum: proposalMediaVisibilities })
    .notNull()
    .default('internal'),
  sortOrder: integer('sort_order').notNull().default(0),
  duration: integer('duration'), // video length (seconds), client-captured
  pageCount: integer('page_count'), // pdf pages, optimizer-derived
  thumbnailPathKey: text('thumbnail_path_key'), // video poster object key (presigned at read); null in v1
  optimizationStatus: text('optimization_status').notNull().default('pending'),
  optimizationVariants: jsonb('optimization_variants').$type<string[]>(),
  blurDataUrl: text('blur_data_url'),
  createdAt,
  updatedAt,
})

export const proposalMediaFilesRelations = relations(proposalMediaFiles, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalMediaFiles.proposalId],
    references: [proposals.id],
  }),
}))

export const selectProposalMediaFileSchema = createSelectSchema(proposalMediaFiles)
export type ProposalMediaFile = z.infer<typeof selectProposalMediaFileSchema>

export const insertProposalMediaFileSchema = selectProposalMediaFileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  visibility: true,
  sortOrder: true,
  duration: true,
  pageCount: true,
  thumbnailPathKey: true,
  optimizationStatus: true,
  optimizationVariants: true,
  blurDataUrl: true,
})
export type InsertProposalMediaFile = z.infer<typeof insertProposalMediaFileSchema>
```

- [ ] **Step 2: Register in the schema barrel**

In `src/shared/db/schema/index.ts`, add after the `export * from './proposal-incentives'` line (keeps the `proposal-*` exports grouped):

```ts
export * from './proposal-incentives'
export * from './proposal-media-files'
export * from './proposals'
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc`
Expected: no errors (the new table + zod schemas compile; `proposals` import resolves).

- [ ] **Step 4: Push schema to the DEV database**

Run: `pnpm db:push:dev`
Expected: drizzle-kit reports creating table `proposal_media_files` with a unique index on `path_key` and an FK to `proposals`. Confirm it prints the new table and completes without prompting a destructive change to other tables.

- [ ] **Step 5: Verify the table exists**

Run: `pnpm db:push:dev --dry-run` (or re-run push)
Expected: "No changes detected" — proving the table is now in sync with the schema.

- [ ] **Step 6: Lint + commit**

Run: `pnpm lint`
Then:
```bash
git add src/shared/db/schema/proposal-media-files.ts src/shared/db/schema/index.ts
git commit -m "feat(proposals): add proposal_media_files table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: R2 cross-bucket `copyObject` primitive

**Files:**
- Modify: `src/shared/services/providers/r2/client.ts`

**Interfaces:**
- Produces: `r2Client.copyObject({ sourceBucket, sourceKey, destBucket, destKey }): Promise<void>`.
- Consumes: existing lazy `s3` client + `R2BucketName` in the same file.

- [ ] **Step 1: Import `CopyObjectCommand`**

In `src/shared/services/providers/r2/client.ts`, extend the `@aws-sdk/client-s3` import (currently `DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client`) to include `CopyObjectCommand`:

```ts
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
```

- [ ] **Step 2: Add the `copyObject` method**

Add to the returned client object (next to `putObject` / `getObject`):

```ts
/**
 * Server-side copy of an object, optionally across buckets. Used to import a
 * proposal's private photo into the public portfolio bucket. CopySource is the
 * URL-encoded `<bucket>/<key>` of the source object.
 */
copyObject: async ({ sourceBucket, sourceKey, destBucket, destKey }: {
  sourceBucket: R2BucketName
  sourceKey: string
  destBucket: R2BucketName
  destKey: string
}): Promise<void> => {
  await s3.send(new CopyObjectCommand({
    Bucket: destBucket,
    Key: destKey,
    CopySource: encodeURIComponent(`${sourceBucket}/${sourceKey}`),
  }))
},
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. (Behavioral verification of the copy happens in Task 13's manual check, once there's a source object.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/r2/client.ts
git commit -m "feat(r2): add cross-bucket copyObject primitive

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: File-optimization types + classifier

**Files:**
- Create: `src/shared/lib/file-optimization/types.ts`

**Interfaces:**
- Produces: `FileKind` (`'image' | 'video' | 'pdf' | 'other'`), `classifyFileKind(mimeType: string): FileKind`, `FileOptimizationResult`.

- [ ] **Step 1: Create the types + classifier**

```ts
// src/shared/lib/file-optimization/types.ts

/** Coarse file kind the optimizer dispatches on. */
export type FileKind = 'image' | 'video' | 'pdf' | 'other'

export function classifyFileKind(mimeType: string): FileKind {
  if (mimeType.startsWith('image/'))
    return 'image'
  if (mimeType.startsWith('video/'))
    return 'video'
  if (mimeType === 'application/pdf')
    return 'pdf'
  return 'other'
}

/**
 * Normalized result of optimizing ONE file. Every strategy returns this shape so
 * callers handle all kinds uniformly.
 * - `status: 'complete'` — the strategy ran (may still leave optional fields empty)
 * - `status: 'skipped'`  — nothing to do server-side (video today, unknown kinds)
 * - `status: 'failed'`   — the strategy threw
 */
export interface FileOptimizationResult {
  status: 'complete' | 'skipped' | 'failed'
  variants?: string[] // image variant suffixes uploaded (e.g. ['sm','md','lg'])
  blurDataUrl?: string // image LQIP data URL
  pageCount?: number // pdf page count
  duration?: number // video seconds (reserved; client-provided today)
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/file-optimization/types.ts
git commit -m "feat(file-optimization): add file-kind classifier + result type

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `optimizeFile` core (image + pdf strategies) + route existing image job through it

**Files:**
- Create: `src/shared/lib/file-optimization/strategies/pdf.ts`
- Create: `src/shared/lib/file-optimization/optimize-file.ts`
- Modify: `src/shared/services/media.service.ts`

**Interfaces:**
- Consumes: `classifyFileKind`, `FileOptimizationResult` (Task 3); `processImageVariants` (`src/shared/entities/media-files/lib/process-image-variants.ts`); `r2Client.getObject/putObject`; `R2BucketName`.
- Produces: `optimizeFile({ bucket, pathKey, mimeType }: { bucket: R2BucketName, pathKey: string, mimeType: string }): Promise<FileOptimizationResult>`.

- [ ] **Step 1: PDF strategy (page count via pdf-lib)**

```ts
// src/shared/lib/file-optimization/strategies/pdf.ts
import type { Buffer } from 'node:buffer'
import { PDFDocument } from 'pdf-lib'

/** Reads page count from a PDF buffer. Returns null if the PDF can't be parsed. */
export async function readPdfPageCount(buffer: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(buffer, { updateMetadata: false })
    return doc.getPageCount()
  }
  catch {
    return null
  }
}
```

- [ ] **Step 2: The dispatched core**

```ts
// src/shared/lib/file-optimization/optimize-file.ts
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import type { FileOptimizationResult } from './types'
import { processImageVariants } from '@/shared/entities/media-files/lib/process-image-variants'
import { r2Client } from '@/shared/services/providers/r2/client'
import { readPdfPageCount } from './strategies/pdf'
import { classifyFileKind } from './types'

export interface OptimizeFileInput {
  bucket: R2BucketName
  pathKey: string
  mimeType: string
}

/**
 * Generalized file optimizer. Dispatches on file kind:
 * - image → sharp webp variants (sm/md/lg) + blur LQIP, uploaded next to the original
 * - pdf   → page count (metadata only; no rasterization — flagged follow-up)
 * - video → skipped server-side (poster/duration are client-captured; transcode = follow-up)
 * - other → skipped
 * Returns a normalized result; performs its own R2 IO for images. No DB writes.
 */
export async function optimizeFile(input: OptimizeFileInput): Promise<FileOptimizationResult> {
  const kind = classifyFileKind(input.mimeType)

  if (kind === 'image') {
    const originalBuffer = await r2Client.getObject(input.bucket, input.pathKey)
    const { variants, blurDataUrl, variantSuffixes } = await processImageVariants(originalBuffer)
    const basePath = input.pathKey.replace(/\.[^.]+$/, '')
    await Promise.all(
      variants.map(v =>
        r2Client.putObject(input.bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
      ),
    )
    return { status: 'complete', variants: variantSuffixes, blurDataUrl }
  }

  if (kind === 'pdf') {
    const buffer = await r2Client.getObject(input.bucket, input.pathKey)
    const pageCount = await readPdfPageCount(buffer)
    return { status: 'complete', pageCount: pageCount ?? undefined }
  }

  // video + other: nothing to do server-side today
  return { status: 'skipped' }
}
```

- [ ] **Step 3: Route the existing image service through the shared core**

Replace the body of `optimizeImage` in `src/shared/services/media.service.ts` so image behavior is identical but sourced from the shared core. New file:

```ts
// src/shared/services/media.service.ts
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import {
  getMediaFileById,
  setOptimizationComplete,
  setOptimizationFailed,
  setOptimizationProcessing,
} from '@/shared/entities/media-files/dal/server/queries'
import { optimizeFile } from '@/shared/lib/file-optimization/optimize-file'

function createMediaService() {
  return {
    optimizeImage: async (mediaFileId: number) => {
      const file = await getMediaFileById(mediaFileId)
      if (!file) {
        console.error(`[mediaService] Media file ${mediaFileId} not found`)
        return
      }
      if (file.optimizationStatus === 'optimized') {
        return
      }
      await setOptimizationProcessing(mediaFileId)
      try {
        const result = await optimizeFile({
          bucket: file.bucket as R2BucketName,
          pathKey: file.pathKey,
          mimeType: file.mimeType,
        })
        if (result.status === 'complete' && result.variants) {
          await setOptimizationComplete(mediaFileId, {
            variantSuffixes: result.variants,
            blurDataUrl: result.blurDataUrl ?? '',
          })
        }
        else {
          // non-image project media (rare) — nothing to persist; mark done
          await setOptimizationComplete(mediaFileId, { variantSuffixes: [], blurDataUrl: '' })
        }
      }
      catch (error) {
        console.error(`[mediaService] Optimization failed for ${mediaFileId}:`, error)
        await setOptimizationFailed(mediaFileId)
      }
    },
  }
}

export type MediaService = ReturnType<typeof createMediaService>
export const mediaService = createMediaService()
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. `optimize-image.ts` job is unchanged and still calls `mediaService.optimizeImage`.

- [ ] **Step 5: Manual regression check (image optimization unchanged)**

Verify the image path still works end-to-end using the existing project uploader:
1. `pnpm dev`
2. Open a portfolio project's Photos tab, upload one JPG.
3. Confirm in R2 (or via the DB) that `optimization_status` becomes `optimized` and `optimization_variants` is populated (`["sm","md","lg"]` or a subset), and `blur_data_url` is set — identical to prior behavior.

Expected: image optimization behaves exactly as before (the refactor is behavior-preserving).

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/file-optimization/ src/shared/services/media.service.ts
git commit -m "refactor(media): generalize image optimization into shared optimizeFile core (image+pdf)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Proposal-media DAL (reads, optimization setters, presign resolver, mutations)

**Files:**
- Create: `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts`
- Create: `src/shared/entities/proposal-media-files/dal/server/queries.ts`
- Create: `src/shared/entities/proposal-media-files/dal/server/mutations.ts`

**Interfaces:**
- Consumes: `db`, `proposalMediaFiles`, `proposals`; `ScopedContext` (`@/shared/dal/server/types`); `r2Client.getPresignedDownloadUrl`, `deleteMediaWithVariants`; `R2BucketName`.
- Produces (queries):
  - `getProposalMediaFileById(id: number): Promise<ProposalMediaFile | undefined>`
  - `listProposalMedia(proposalId: string): Promise<ProposalMediaFile[]>`
  - `listHomeownerProposalMedia(proposalId: string): Promise<ProposalMediaFile[]>`
  - `setProposalMediaProcessing(id) / setProposalMediaComplete(id, {variantSuffixes, blurDataUrl, pageCount}) / setProposalMediaFailed(id)`
  - `resolveProposalMediaUrl(file: ProposalMediaFile): Promise<string>` (from lib)
  - `ProposalMediaView` type + `toProposalMediaView(file): Promise<ProposalMediaView>`
- Produces (mutations, all scope-checked via parent proposal):
  - `insertProposalMediaFile(ctx, values): Promise<ProposalMediaFile>`
  - `deleteProposalMediaFile(ctx, id): Promise<void>`
  - `reorderProposalMedia(ctx, updates: {id,sortOrder}[]): Promise<void>`
  - `setProposalMediaVisibility(ctx, id, visibility): Promise<void>`
  - `renameProposalMediaFile(ctx, id, name): Promise<void>`

- [ ] **Step 1: Presign resolver (best variant or original)**

```ts
// src/shared/entities/proposal-media-files/lib/resolve-media-url.ts
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { r2Client } from '@/shared/services/providers/r2/client'

/**
 * Presigned GET URL for a proposal media object. For images, prefers the largest
 * generated webp variant (smaller than the original phone photo) and falls back
 * to the original. Non-images presign the original. Access is ALWAYS presigned —
 * the bucket is private.
 */
export async function resolveProposalMediaUrl(file: ProposalMediaFile): Promise<string> {
  const bucket = file.bucket as R2BucketName
  const variants = file.optimizationVariants ?? []
  const preferred = ['lg', 'md', 'sm'].find(s => variants.includes(s))
  if (file.mimeType.startsWith('image/') && preferred) {
    const basePath = file.pathKey.replace(/\.[^.]+$/, '')
    return r2Client.getPresignedDownloadUrl({ bucket, pathKey: `${basePath}-${preferred}.webp` })
  }
  return r2Client.getPresignedDownloadUrl({ bucket, pathKey: file.pathKey })
}
```

- [ ] **Step 2: Queries + view mapper**

```ts
// src/shared/entities/proposal-media-files/dal/server/queries.ts
import type { ProposalMediaFile, ProposalMediaVisibility } from '@/shared/db/schema/proposal-media-files'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { r2Client } from '@/shared/services/providers/r2/client'
import { resolveProposalMediaUrl } from '../../lib/resolve-media-url'

export type { ProposalMediaFile }

/** Homeowner/agent-facing shape: presigned url resolved, no bucket/pathKey leaked. */
export interface ProposalMediaView {
  id: number
  name: string
  mimeType: string
  visibility: ProposalMediaVisibility
  sortOrder: number
  url: string
  thumbnailUrl: string | null
  blurDataUrl: string | null
  duration: number | null
  pageCount: number | null
  optimizationStatus: string
}

export async function toProposalMediaView(file: ProposalMediaFile): Promise<ProposalMediaView> {
  const url = await resolveProposalMediaUrl(file)
  const thumbnailUrl = file.thumbnailPathKey
    ? await r2Client.getPresignedDownloadUrl({ bucket: file.bucket as R2BucketName, pathKey: file.thumbnailPathKey })
    : null
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    visibility: file.visibility,
    sortOrder: file.sortOrder,
    url,
    thumbnailUrl,
    blurDataUrl: file.blurDataUrl,
    duration: file.duration,
    pageCount: file.pageCount,
    optimizationStatus: file.optimizationStatus,
  }
}

export async function getProposalMediaFileById(id: number): Promise<ProposalMediaFile | undefined> {
  const [file] = await db.select().from(proposalMediaFiles).where(eq(proposalMediaFiles.id, id))
  return file
}

export async function listProposalMedia(proposalId: string): Promise<ProposalMediaFile[]> {
  return db
    .select()
    .from(proposalMediaFiles)
    .where(eq(proposalMediaFiles.proposalId, proposalId))
    .orderBy(asc(proposalMediaFiles.sortOrder))
}

export async function listHomeownerProposalMedia(proposalId: string): Promise<ProposalMediaFile[]> {
  return db
    .select()
    .from(proposalMediaFiles)
    .where(and(
      eq(proposalMediaFiles.proposalId, proposalId),
      eq(proposalMediaFiles.visibility, 'homeowner'),
    ))
    .orderBy(asc(proposalMediaFiles.sortOrder))
}

export async function setProposalMediaProcessing(id: number): Promise<void> {
  await db.update(proposalMediaFiles).set({ optimizationStatus: 'processing' }).where(eq(proposalMediaFiles.id, id))
}

export async function setProposalMediaComplete(
  id: number,
  data: { variantSuffixes: string[], blurDataUrl: string, pageCount?: number },
): Promise<void> {
  await db.update(proposalMediaFiles).set({
    optimizationStatus: 'optimized',
    optimizationVariants: data.variantSuffixes,
    blurDataUrl: data.blurDataUrl,
    pageCount: data.pageCount ?? null,
  }).where(eq(proposalMediaFiles.id, id))
}

export async function setProposalMediaFailed(id: number): Promise<void> {
  await db.update(proposalMediaFiles).set({ optimizationStatus: 'failed' }).where(eq(proposalMediaFiles.id, id))
}
```

- [ ] **Step 3: Mutations (scope-checked through the parent proposal)**

```ts
// src/shared/entities/proposal-media-files/dal/server/mutations.ts
import type { InsertProposalMediaFile, ProposalMediaFile, ProposalMediaVisibility } from '@/shared/db/schema/proposal-media-files'
import type { ScopedContext } from '@/shared/dal/server/types'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { proposals } from '@/shared/db/schema/proposals'
import { r2Client } from '@/shared/services/providers/r2/client'

/** Throws NOT_FOUND if the proposal is missing or outside the caller's scope. */
async function assertProposalInScope(ctx: ScopedContext, proposalId: string): Promise<void> {
  const [row] = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), ctx.scope ?? undefined))
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
  }
}

/** Resolves a media file's proposalId, then asserts scope. Returns the file. */
async function assertMediaInScope(ctx: ScopedContext, id: number): Promise<ProposalMediaFile> {
  const [file] = await db.select().from(proposalMediaFiles).where(eq(proposalMediaFiles.id, id))
  if (!file) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Media file not found' })
  }
  await assertProposalInScope(ctx, file.proposalId)
  return file
}

export async function insertProposalMediaFile(
  ctx: ScopedContext,
  values: InsertProposalMediaFile,
): Promise<ProposalMediaFile> {
  await assertProposalInScope(ctx, values.proposalId)
  const [created] = await db.insert(proposalMediaFiles).values(values).returning()
  return created
}

export async function deleteProposalMediaFile(ctx: ScopedContext, id: number): Promise<void> {
  const file = await assertMediaInScope(ctx, id)
  await r2Client.deleteMediaWithVariants(file.bucket as R2BucketName, file.pathKey)
  await db.delete(proposalMediaFiles).where(eq(proposalMediaFiles.id, id))
}

export async function reorderProposalMedia(
  ctx: ScopedContext,
  updates: { id: number, sortOrder: number }[],
): Promise<void> {
  if (updates.length === 0)
    return
  // Scope-check the first file's proposal (all reordered files share one proposal).
  await assertMediaInScope(ctx, updates[0].id)
  await db.transaction(async (tx) => {
    for (const { id, sortOrder } of updates) {
      await tx.update(proposalMediaFiles).set({ sortOrder }).where(eq(proposalMediaFiles.id, id))
    }
  })
}

export async function setProposalMediaVisibility(
  ctx: ScopedContext,
  id: number,
  visibility: ProposalMediaVisibility,
): Promise<void> {
  await assertMediaInScope(ctx, id)
  await db.update(proposalMediaFiles).set({ visibility }).where(eq(proposalMediaFiles.id, id))
}

export async function renameProposalMediaFile(ctx: ScopedContext, id: number, name: string): Promise<void> {
  await assertMediaInScope(ctx, id)
  await db.update(proposalMediaFiles).set({ name }).where(eq(proposalMediaFiles.id, id))
}
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/proposal-media-files/
git commit -m "feat(proposals): proposal-media DAL (reads, presign resolver, scope-checked mutations)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Proposal-media optimization service + QStash job + registration

**Files:**
- Create: `src/shared/services/proposal-media.service.ts`
- Create: `src/shared/services/providers/upstash/jobs/optimize-proposal-media.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`

**Interfaces:**
- Consumes: proposal-media queries (Task 5); `optimizeFile` (Task 4); `createJob`.
- Produces: `proposalMediaService.optimizeFile(id: number): Promise<void>`; `optimizeProposalMediaJob` (key `'optimize-proposal-media'`, payload `{ proposalMediaFileId: number }`).

- [ ] **Step 1: Service persistence wrapper**

```ts
// src/shared/services/proposal-media.service.ts
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import {
  getProposalMediaFileById,
  setProposalMediaComplete,
  setProposalMediaFailed,
  setProposalMediaProcessing,
} from '@/shared/entities/proposal-media-files/dal/server/queries'
import { optimizeFile } from '@/shared/lib/file-optimization/optimize-file'

function createProposalMediaService() {
  return {
    optimizeFile: async (proposalMediaFileId: number) => {
      const file = await getProposalMediaFileById(proposalMediaFileId)
      if (!file) {
        console.error(`[proposalMediaService] File ${proposalMediaFileId} not found`)
        return
      }
      if (file.optimizationStatus === 'optimized') {
        return
      }
      await setProposalMediaProcessing(proposalMediaFileId)
      try {
        const result = await optimizeFile({
          bucket: file.bucket as R2BucketName,
          pathKey: file.pathKey,
          mimeType: file.mimeType,
        })
        await setProposalMediaComplete(proposalMediaFileId, {
          variantSuffixes: result.variants ?? [],
          blurDataUrl: result.blurDataUrl ?? '',
          pageCount: result.pageCount,
        })
      }
      catch (error) {
        console.error(`[proposalMediaService] Optimization failed for ${proposalMediaFileId}:`, error)
        await setProposalMediaFailed(proposalMediaFileId)
      }
    },
  }
}

export type ProposalMediaService = ReturnType<typeof createProposalMediaService>
export const proposalMediaService = createProposalMediaService()
```

- [ ] **Step 2: The job**

```ts
// src/shared/services/providers/upstash/jobs/optimize-proposal-media.ts
import { proposalMediaService } from '@/shared/services/proposal-media.service'
import { createJob } from '../lib/create-job'

interface OptimizeProposalMediaPayload {
  proposalMediaFileId: number
}

export const optimizeProposalMediaJob = createJob<OptimizeProposalMediaPayload>(
  'optimize-proposal-media',
  async ({ proposalMediaFileId }) => {
    await proposalMediaService.optimizeFile(proposalMediaFileId)
  },
)
```

- [ ] **Step 3: Register the job in the QStash receiver**

In `src/app/api/qstash-jobs/route.ts`: add the import next to the other job imports, and add `optimizeProposalMediaJob` to the `jobs` array.

```ts
import { optimizeProposalMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-proposal-media'
// ...
const jobs: Job[] = [
  // ...existing entries...
  optimizeProposalMediaJob,
]
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/proposal-media.service.ts src/shared/services/providers/upstash/jobs/optimize-proposal-media.ts src/app/api/qstash-jobs/route.ts
git commit -m "feat(proposals): proposal-media optimization service + QStash job

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `proposalMedia` tRPC sub-router (entity-scoped, CASL-guarded, lock-exempt)

**Files:**
- Create: `src/trpc/routers/proposals.router/media.router.ts`
- Modify: `src/trpc/routers/proposals.router/index.ts`

**Interfaces:**
- Consumes: proposal-media DAL (Tasks 5); `insertProposalMediaFileSchema`, `proposalMediaVisibilities`; `r2Client.getPresignedUploadUrl`; `R2_BUCKETS.homeownerFiles`; `optimizeProposalMediaJob`; the entity factory param `entity` (has `authedProcedure`).
- Produces: `createProposalMediaRouter(entity)` mounted as `proposalsRouter.media` with procedures `getUploadUrl`, `create`, `list`, `setVisibility`, `reorder`, `rename`, `delete`.

> **Authorization note:** unlike the project media router (bare `agentProcedure`), this uses `entity.authedProcedure` + a CASL `update Proposal` guard and DAL scope checks (the `incentives.replace` precedent), so an agent can only touch media on proposals they can see. It deliberately does **NOT** call `isProposalFrozen` — media is lock-exempt.

- [ ] **Step 1: Create the router factory**

```ts
// src/trpc/routers/proposals.router/media.router.ts
import type { EntityRouterContext } from '@/trpc/lib/create-entity-router' // adjust to the actual `entity` param type used by createDeliveryRouter/createContractsRouter
import { extname } from 'node:path'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { proposalMediaVisibilities } from '@/shared/db/schema/proposal-media-files'
import {
  deleteProposalMediaFile,
  insertProposalMediaFile,
  renameProposalMediaFile,
  reorderProposalMedia,
  setProposalMediaVisibility,
} from '@/shared/entities/proposal-media-files/dal/server/mutations'
import { listProposalMedia, toProposalMediaView } from '@/shared/entities/proposal-media-files/dal/server/queries'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'
import { optimizeProposalMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-proposal-media'
import { createTRPCRouter } from '../../init'

const PROPOSAL_BUCKET = R2_BUCKETS.homeownerFiles

function assertCanUpdate(ctx: { ability: { cannot: (a: string, s: string) => boolean } | null }) {
  if (!ctx.ability || ctx.ability.cannot('update', 'Proposal')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this proposal.' })
  }
}

// `entity` is the createEntityRouter factory param (same one createContractsRouter receives).
export function createProposalMediaRouter(entity: EntityRouterContext) {
  return createTRPCRouter({
    getUploadUrl: entity.authedProcedure
      .input(z.object({
        proposalId: z.string().uuid(),
        filename: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        const ext = extname(input.filename).toLowerCase()
        const fileId = crypto.randomUUID()
        const pathKey = `proposals/${input.proposalId}/${fileId}${ext}`
        const uploadUrl = await r2Client.getPresignedUploadUrl({
          bucket: PROPOSAL_BUCKET,
          pathKey,
          mimeType: input.mimeType,
        })
        return { uploadUrl, pathKey, bucket: PROPOSAL_BUCKET }
      }),

    create: entity.authedProcedure
      .input(z.object({
        proposalId: z.string().uuid(),
        name: z.string().min(1).max(80),
        pathKey: z.string(),
        bucket: z.string(),
        mimeType: z.string(),
        fileExtension: z.string(),
        duration: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        const created = await insertProposalMediaFile(ctx, input)
        // Optimize images (variants) + pdfs (page count). Video/other: nothing to do.
        if (created.mimeType.startsWith('image/') || created.mimeType === 'application/pdf') {
          void optimizeProposalMediaJob.dispatch({ proposalMediaFileId: created.id })
        }
        return created
      }),

    list: entity.authedProcedure
      .input(z.object({ proposalId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        const rows = await listProposalMedia(input.proposalId)
        return Promise.all(rows.map(toProposalMediaView))
      }),

    setVisibility: entity.authedProcedure
      .input(z.object({ id: z.number(), visibility: z.enum(proposalMediaVisibilities) }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await setProposalMediaVisibility(ctx, input.id, input.visibility)
      }),

    reorder: entity.authedProcedure
      .input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await reorderProposalMedia(ctx, input.updates)
      }),

    rename: entity.authedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await renameProposalMediaFile(ctx, input.id, input.name)
      }),

    delete: entity.authedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        await deleteProposalMediaFile(ctx, input.id)
      }),
  })
}
```

> **Implementer note:** open `src/trpc/routers/proposals.router/contracts.router.ts` and copy the EXACT type it uses for its `entity` parameter (e.g. `createContractsRouter(entity: <Type>)`) — use that same type for `EntityRouterContext` above rather than inventing one. `entity.authedProcedure`, `ctx.ability`, and `ctx.scope` are all present on that context (the incentives router at `proposals.router/index.ts` uses `entity.authedProcedure` + `ctx.ability.cannot('update','Proposal')` identically).

- [ ] **Step 2: Mount the sub-router**

In `src/trpc/routers/proposals.router/index.ts`, import and mount alongside `delivery` / `contracts`:

```ts
import { createProposalMediaRouter } from './media.router'
// ...inside createTRPCRouter({...}) returned by createEntityRouter:
    delivery: createDeliveryRouter(entity),
    contracts: createContractsRouter(entity),
    media: createProposalMediaRouter(entity),
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. If `EntityRouterContext` mismatches, fix by matching `contracts.router.ts`'s param type exactly.

- [ ] **Step 4: Manual check (procedure reachable)**

1. `pnpm dev`
2. In the browser devtools console on the dashboard, the tRPC client exposes `proposalsRouter.media`. Simplest check: proceed to Task 9–11 which exercise it via UI. (No standalone check needed here beyond compilation.)

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/proposals.router/media.router.ts src/trpc/routers/proposals.router/index.ts
git commit -m "feat(proposals): agent-only proposalMedia sub-router (entity-scoped, lock-exempt)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `getFullView` homeowner-media enrichment

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts`

**Interfaces:**
- Consumes: `listHomeownerProposalMedia`, `toProposalMediaView`, `ProposalMediaView` (Task 5).
- Produces: `ProposalWithCustomer.media: ProposalMediaView[]` — homeowner-visible files only, presigned, ordered by `sortOrder`.

- [ ] **Step 1: Extend the return type**

In `src/shared/entities/proposals/dal/server/queries.ts`, add `media` to the `ProposalWithCustomer` type (lines ~47-52):

```ts
export type ProposalWithCustomer = Proposal & {
  customer: ProposalCustomer | null
  meetingProjectId: string | null
  projectFirstContractSentAt: string | null
  incentives: ProposalIncentiveRow[]
  media: ProposalMediaView[]
}
```

Add imports at the top:

```ts
import type { ProposalMediaView } from '@/shared/entities/proposal-media-files/dal/server/queries'
import { listHomeownerProposalMedia, toProposalMediaView } from '@/shared/entities/proposal-media-files/dal/server/queries'
```

- [ ] **Step 2: Enrich in `getFullView`**

Just before the final `return { ...row, fundingJSON: hydratedFunding, customer, incentives } as ProposalWithCustomer` (around line 150), fetch + attach homeowner media. The rendered gallery is the homeowner view (agents preview the same document; internal files are managed in the Files tab's separate `list` query), so `getFullView` ALWAYS returns homeowner-visible media only — no path branching:

```ts
    const homeownerMedia = await listHomeownerProposalMedia(row.id)
    const media = await Promise.all(homeownerMedia.map(toProposalMediaView))

    return { ...row, fundingJSON: hydratedFunding, customer, incentives, media } as ProposalWithCustomer
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. Any consumer destructuring `ProposalWithCustomer` still compiles (new field is additive).

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts
git commit -m "feat(proposals): enrich getFullView with homeowner-visible media (presigned)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Client upload hook + client mutation hooks

**Files:**
- Create: `src/shared/hooks/use-proposal-media-upload.ts`
- Create: `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts`

**Interfaces:**
- Consumes: `trpc.proposalsRouter.media.*` (Task 7); `useInvalidation`; `useTRPC`.
- Produces:
  - `useProposalMediaUpload(): { upload: (args: { file: File, proposalId: string }) => Promise<void>, isUploading: boolean }`
  - `useSetProposalMediaVisibility()`, `useReorderProposalMedia()`, `useRenameProposalMedia()`, `useDeleteProposalMedia()` — thin `useMutation` wrappers that invalidate the proposal-media `list` query for the proposal.

- [ ] **Step 1: Upload hook (getUploadUrl → PUT → create)**

```ts
// src/shared/hooks/use-proposal-media-upload.ts
import { useState } from 'react'
import { extname } from 'node:path' // if node:path is unavailable client-side, derive ext inline: file.name.split('.').pop()
import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useProposalMediaUpload() {
  const trpc = useTRPC()
  const [isUploading, setIsUploading] = useState(false)
  const getUploadUrl = useMutation(trpc.proposalsRouter.media.getUploadUrl.mutationOptions())
  const createMedia = useMutation(trpc.proposalsRouter.media.create.mutationOptions())

  async function upload({ file, proposalId }: { file: File, proposalId: string }) {
    setIsUploading(true)
    try {
      const { uploadUrl, pathKey, bucket } = await getUploadUrl.mutateAsync({
        proposalId,
        filename: file.name,
        mimeType: file.type,
      })
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      const ext = `.${file.name.split('.').pop() ?? ''}`.toLowerCase()
      await createMedia.mutateAsync({
        proposalId,
        name: file.name.replace(/\.[^/.]+$/, '').slice(0, 80),
        pathKey,
        bucket,
        mimeType: file.type,
        fileExtension: ext,
      })
    }
    finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading }
}
```

> Implementer note: `node:path`'s `extname` may not bundle client-side — the inline `file.name.split('.').pop()` derivation above avoids it. Drop the `node:path` import.

- [ ] **Step 2: Mutation hooks**

```ts
// src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts
import { useMutation } from '@tanstack/react-query'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

function useInvalidateProposalMedia() {
  const trpc = useTRPC()
  const { queryClient } = useInvalidation()
  return (proposalId: string) =>
    queryClient.invalidateQueries({ queryKey: trpc.proposalsRouter.media.list.queryKey({ proposalId }) })
}

export function useSetProposalMediaVisibility() {
  const trpc = useTRPC()
  const invalidate = useInvalidateProposalMedia()
  return useMutation(trpc.proposalsRouter.media.setVisibility.mutationOptions())
}

export function useReorderProposalMedia() {
  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.media.reorder.mutationOptions())
}

export function useRenameProposalMedia() {
  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.media.rename.mutationOptions())
}

export function useDeleteProposalMedia() {
  const trpc = useTRPC()
  return useMutation(trpc.proposalsRouter.media.delete.mutationOptions())
}
```

> Implementer note: match the EXACT invalidation shape used by `use-replace-incentives.ts` (`useInvalidation()` surface) — if `useInvalidation` exposes `queryClient`, use the pattern above; if it exposes a named helper, mirror that. The manager (Task 10) calls `onUpdate()` after each mutation to refetch, so invalidation here is a belt-and-suspenders; keep it minimal.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/hooks/use-proposal-media-upload.ts src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts
git commit -m "feat(proposals): client hooks for proposal media upload + mutations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `ProposalMediaManager` component (Files-tab manager)

**Files:**
- Create: `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`

**Interfaces:**
- Consumes: `useProposalMediaUpload` (Task 9); the mutation hooks (Task 9); `trpc.proposalsRouter.media.list` query; shadcn primitives; `useConfirm` (`src/shared/hooks`, per memory).
- Produces: `<ProposalMediaManager proposalId={string} />` — self-contained (own tRPC state), NOT part of RHF.

- [ ] **Step 1: Build the manager**

Adapt the shape of `sortable-media-manager.tsx` but simplified: no phases, no hero; instead a per-file **"Viewable by homeowner"** toggle, with files grouped into "Shown to homeowner" and "Internal only". Accept `image/*,video/*,application/pdf`; keep videos (do NOT filter them out). Use the existing `SortablePhotoCard`? It is portfolio-specific (hero/phase). For v1 render a simpler card grid here rather than reusing `SortablePhotoCard`.

```tsx
// src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx
'use client'

import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useProposalMediaUpload } from '@/shared/hooks/use-proposal-media-upload'
import { useTRPC } from '@/trpc/helpers'
import {
  useDeleteProposalMedia,
  useSetProposalMediaVisibility,
} from '@/features/proposal-flow/dal/client/mutations/use-proposal-media'

interface Props {
  proposalId: string
}

export function ProposalMediaManager({ proposalId }: Props) {
  const trpc = useTRPC()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading } = useProposalMediaUpload()
  const listQuery = useQuery(trpc.proposalsRouter.media.list.queryOptions({ proposalId }))
  const setVisibility = useSetProposalMediaVisibility()
  const deleteMedia = useDeleteProposalMedia()
  const [ConfirmDialog, confirm] = useConfirm('Delete file?', 'This removes the file from the proposal.')

  const files = listQuery.data ?? []
  const homeownerFiles = files.filter(f => f.visibility === 'homeowner')
  const internalFiles = files.filter(f => f.visibility === 'internal')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    const results = await Promise.allSettled(selected.map(file => upload({ file, proposalId })))
    if (results.some(r => r.status === 'rejected'))
      toast.error('Some files failed to upload')
    await listQuery.refetch()
  }

  async function handleToggleVisible(id: number, current: string) {
    await setVisibility.mutateAsync({ id, visibility: current === 'homeowner' ? 'internal' : 'homeowner' })
    await listQuery.refetch()
  }

  async function handleDelete(id: number) {
    if (!(await confirm()))
      return
    await deleteMedia.mutateAsync({ id })
    await listQuery.refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Upload photos, videos, or PDFs. Toggle “Viewable by homeowner” to show a file on the proposal.
        </p>
        <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? 'Uploading…' : 'Upload files'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <MediaGroup
        title="Shown to homeowner"
        files={homeownerFiles}
        onToggleVisible={handleToggleVisible}
        onDelete={handleDelete}
      />
      <MediaGroup
        title="Internal only"
        files={internalFiles}
        onToggleVisible={handleToggleVisible}
        onDelete={handleDelete}
      />
      {ConfirmDialog}
    </div>
  )
}

function MediaGroup({ title, files, onToggleVisible, onDelete }: {
  title: string
  files: { id: number, name: string, mimeType: string, url: string, visibility: string, optimizationStatus: string }[]
  onToggleVisible: (id: number, current: string) => void
  onDelete: (id: number) => void
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{`${title} (${files.length})`}</h3>
      {files.length === 0
        ? <p className="text-xs text-muted-foreground">No files.</p>
        : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {files.map(file => (
                <li key={file.id} className="rounded-lg border p-2">
                  <MediaThumb file={file} />
                  <p className="mt-1 truncate text-xs" title={file.name}>{file.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-1 text-xs">
                      <Switch
                        checked={file.visibility === 'homeowner'}
                        onCheckedChange={() => onToggleVisible(file.id, file.visibility)}
                      />
                      Homeowner
                    </label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(file.id)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
    </section>
  )
}

function MediaThumb({ file }: { file: { mimeType: string, url: string, name: string } }) {
  if (file.mimeType.startsWith('image/'))
    return <img src={file.url} alt={file.name} className="aspect-square w-full rounded object-cover" />
  if (file.mimeType.startsWith('video/'))
    return <video src={file.url} className="aspect-square w-full rounded object-cover" muted />
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
      PDF
    </div>
  )
}
```

> Implementer note: confirm the exact import paths for `Button`, `Switch`, `useConfirm` against the repo (shadcn components live under `src/shared/components/ui/`). Reorder (dnd-kit) is intentionally deferred out of this v1 manager to keep it focused; `sortOrder` still exists and the `reorder` procedure is available for a follow-up. If reorder is desired now, lift the dnd-kit scaffolding from `sortable-media-manager.tsx` lines 522-550.

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx
git commit -m "feat(proposals): ProposalMediaManager (Files-tab uploader + visibility toggle)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Add the "Files" tab to the proposal editor

**Files:**
- Modify: `src/features/proposal-flow/ui/components/form/index.tsx`

**Interfaces:**
- Consumes: `ProposalMediaManager` (Task 10). Needs the proposal id — read it from where the form view has it (the edit view knows `proposalId`; pass it into `ProposalForm` as a prop, OR read from the existing form context if the id is present there).

- [ ] **Step 1: Thread the proposalId into `ProposalForm`**

`ProposalForm` currently doesn't receive the proposal id. Add an optional prop and pass it from `edit-proposal-view.tsx`'s `<ProposalForm ... />` (the create view can pass `undefined`, hiding the Files tab until the proposal exists).

In `src/features/proposal-flow/ui/components/form/index.tsx`, extend the component props with `proposalId?: string`.

In `src/features/proposal-flow/ui/views/edit-proposal-view.tsx`, pass `proposalId={proposalId}` to `<ProposalForm .../>`.

- [ ] **Step 2: Register the tab**

In `form/index.tsx`:

```ts
const FORM_TABS = ['general', 'sow', 'funding', 'files'] as const
// ...
const TAB_LABELS: Record<FormTab, string> = {
  funding: 'Funding',
  general: 'General',
  sow: 'Scope of Work',
  files: 'Files',
}
```

Add the import:

```ts
import { ProposalMediaManager } from './proposal-media-manager'
```

- [ ] **Step 3: Render the tab body**

In the tab-body map (the block rendering `{tab === 'general' && ...}` etc.), add:

```tsx
{tab === 'files' && (proposalId
  ? <ProposalMediaManager proposalId={proposalId} />
  : <p className="text-sm text-muted-foreground">Save the proposal first to attach files.</p>
)}
```

> The Files tab must render even when the form is lock-disabled (media is lock-exempt). Because `ProposalMediaManager` is NOT registered with RHF, the form-level `disabled` flag does not reach it — it stays interactive by construction. Do not wrap it in a `fieldset disabled`.

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Manual verification (full upload + visibility loop)**

1. `pnpm dev`
2. Open an existing proposal's editor → "Files" tab.
3. Upload a JPG, an MP4, and a PDF. Confirm all three appear under "Internal only".
4. Toggle the JPG to "Homeowner" → it moves to "Shown to homeowner".
5. In the DB, confirm rows exist in `proposal_media_files` with correct `visibility`, and the JPG's `optimization_status` becomes `optimized` with `optimization_variants` populated; the PDF gets a `page_count`.
6. Delete the MP4 → confirm the row and R2 object are gone.

Expected: all steps pass; the tab works while the proposal is unlocked. (If the proposal is envelope-locked, the Files tab still works — verify by locking a test proposal.)

- [ ] **Step 6: Commit**

```bash
git add src/features/proposal-flow/ui/components/form/index.tsx src/features/proposal-flow/ui/views/edit-proposal-view.tsx
git commit -m "feat(proposals): Files tab in the proposal editor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Homeowner-facing gallery above the first SOW section

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx`

**Interfaces:**
- Consumes: `proposal.data.media` (the `ProposalMediaView[]` added to `getFullView` in Task 8) — access it the same way `scope-of-work.tsx` reads `proposal.data.projectJSON.data.sow`.
- Produces: `<ProposalMediaGallery media={ProposalMediaView[]} />`.

- [ ] **Step 1: Build the gallery**

```tsx
// src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx
import type { ProposalMediaView } from '@/shared/entities/proposal-media-files/dal/server/queries'

export function ProposalMediaGallery({ media }: { media: ProposalMediaView[] }) {
  if (media.length === 0)
    return null

  const visuals = media.filter(m => m.mimeType.startsWith('image/') || m.mimeType.startsWith('video/'))
  const documents = media.filter(m => m.mimeType === 'application/pdf')

  return (
    <div className="mb-8 space-y-4">
      {visuals.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visuals.map(item =>
            item.mimeType.startsWith('image/')
              ? (
                  <img
                    key={item.id}
                    src={item.url}
                    alt={item.name}
                    loading="lazy"
                    className="aspect-video w-full rounded-lg object-cover"
                    style={item.blurDataUrl ? { backgroundImage: `url(${item.blurDataUrl})`, backgroundSize: 'cover' } : undefined}
                  />
                )
              : (
                  <video
                    key={item.id}
                    src={item.url}
                    controls
                    poster={item.thumbnailUrl ?? undefined}
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                ),
          )}
        </div>
      )}
      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map(doc => (
            <li key={doc.id}>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium underline"
              >
                {doc.name}
                {doc.pageCount ? ` (${doc.pageCount} pages)` : ''}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Mount above the first SOW section**

In `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx`, at the top of the `CardContent` (before the `Accordion`, around line 44), render the gallery. Read `media` off the same proposal object the component already receives:

```tsx
import { ProposalMediaGallery } from './proposal-media-gallery'
// ...
// inside CardContent, before <Accordion ...>:
<ProposalMediaGallery media={proposal.data.media ?? []} />
```

> Confirm the exact prop/shape the component uses to reach the proposal (it already reads `proposal.data.projectJSON.data.sow`), and read `proposal.data.media` off the same object. If the rendering component is typed against a narrower type than `ProposalWithCustomer`, widen it to include `media` (additive).

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Manual verification (homeowner view, unauthenticated)**

1. `pnpm dev`
2. For a proposal that has ≥1 homeowner-visible photo, open the token URL (the shareable proposal link, no login).
3. Confirm the gallery renders above the first Scope-of-Work section: images inline, any homeowner PDF as a download link. Internal-only files must NOT appear.
4. Open a proposal with zero homeowner-visible files → confirm no empty gallery block renders.

Expected: only homeowner-visible media shows; presigned image URLs load; internal files are absent.

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx
git commit -m "feat(proposals): homeowner media gallery above first SOW section

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: `importFromProposal` project-media mutation (copy selected proposal photos into a project)

**Files:**
- Modify: `src/trpc/routers/projects.router/media.router.ts`

**Interfaces:**
- Consumes: `r2Client.copyObject` (Task 2); proposal-media DAL `getProposalMediaFileById` + a new `listProposalsForProject` read; `mediaFiles` insert; `optimizeImageJob`.
- Produces:
  - `projectsRouter.media.listImportableProposalMedia({ projectId }): Promise<{ proposalId, proposalLabel, files: {id,name,url,mimeType}[] }[]>` — image files from proposals on the project's meeting.
  - `projectsRouter.media.importFromProposal({ projectId, proposalMediaFileIds }): Promise<{ imported: number }>`.

- [ ] **Step 1: Add a query listing importable proposal photos for a project**

The project links to its originating meeting via `meetings.projectId = project.id`. Add (in `media.router.ts`, `agentProcedure`):

```ts
listImportableProposalMedia: agentProcedure
  .input(z.object({ projectId: z.string().uuid() }))
  .query(async ({ input }) => {
    // proposals whose meeting is linked to this project
    const rows = await db
      .select({
        proposalId: proposals.id,
        proposalLabel: proposals.label,
        file: proposalMediaFiles,
      })
      .from(proposals)
      .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
      .innerJoin(proposalMediaFiles, eq(proposalMediaFiles.proposalId, proposals.id))
      .where(and(eq(meetings.projectId, input.projectId), like(proposalMediaFiles.mimeType, 'image/%')))

    // group by proposal, presign each file
    const byProposal = new Map<string, { proposalId: string, proposalLabel: string, files: { id: number, name: string, url: string, mimeType: string }[] }>()
    for (const r of rows) {
      const url = await resolveProposalMediaUrl(r.file)
      const group = byProposal.get(r.proposalId) ?? { proposalId: r.proposalId, proposalLabel: r.proposalLabel ?? 'Proposal', files: [] }
      group.files.push({ id: r.file.id, name: r.file.name, url, mimeType: r.file.mimeType })
      byProposal.set(r.proposalId, group)
    }
    return [...byProposal.values()]
  }),
```

Add imports: `proposals`, `meetings` from `@/shared/db/schema`; `proposalMediaFiles` from `@/shared/db/schema/proposal-media-files`; `like`, `and`, `eq` from `drizzle-orm`; `resolveProposalMediaUrl` from `@/shared/entities/proposal-media-files/lib/resolve-media-url`.

- [ ] **Step 2: Add the import mutation (server-side copy → media_files rows)**

```ts
importFromProposal: agentProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    proposalMediaFileIds: z.array(z.number()).min(1),
  }))
  .mutation(async ({ input }) => {
    let imported = 0
    for (const id of input.proposalMediaFileIds) {
      const source = await getProposalMediaFileById(id)
      if (!source || !source.mimeType.startsWith('image/'))
        continue

      const fileId = crypto.randomUUID()
      const destKey = `projects/${input.projectId}/uncategorized/${fileId}${source.fileExtension}`
      await r2Client.copyObject({
        sourceBucket: source.bucket as typeof PORTFOLIO_BUCKET,
        sourceKey: source.pathKey,
        destBucket: PORTFOLIO_BUCKET,
        destKey,
      })
      const publicUrl = `${R2_PUBLIC_DOMAINS[PORTFOLIO_BUCKET] ?? ''}/${destKey}`
      const [created] = await db.insert(mediaFiles).values({
        name: source.name,
        pathKey: destKey,
        bucket: PORTFOLIO_BUCKET,
        mimeType: source.mimeType,
        fileExtension: source.fileExtension,
        url: publicUrl,
        projectId: input.projectId,
        phase: 'uncategorized',
      }).returning()
      void optimizeImageJob.dispatch({ mediaFileId: created.id })
      imported += 1
    }
    return { imported }
  }),
```

Add imports: `getProposalMediaFileById` from the proposal-media queries.

> Note: the copied object is re-optimized in the portfolio bucket (fresh variants under the new key). We copy the ORIGINAL (`source.pathKey`), not a variant, so the project gets a full-resolution master.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/projects.router/media.router.ts
git commit -m "feat(projects): import selected photos from a proposal into a project gallery

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Import-from-proposal UI in the project gallery

**Files:**
- Create: `src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx`
- Modify: `src/shared/components/portfolio/sortable-media-manager.tsx`

**Interfaces:**
- Consumes: `trpc.projectsRouter.media.listImportableProposalMedia`, `...importFromProposal`; shadcn `Dialog`, `Checkbox`, `Button`.
- Produces: `<ImportFromProposalDialog projectId onImported />` + an "Import from proposal" button in the media manager header.

- [ ] **Step 1: Build the dialog (multi-select + Select all)**

```tsx
// src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx
'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { useTRPC } from '@/trpc/helpers'

export function ImportFromProposalDialog({ projectId, onImported }: { projectId: string, onImported: () => void }) {
  const trpc = useTRPC()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const groups = useQuery({ ...trpc.projectsRouter.media.listImportableProposalMedia.queryOptions({ projectId }), enabled: open })
  const importMutation = useMutation(trpc.projectsRouter.media.importFromProposal.mutationOptions())

  const allIds = (groups.data ?? []).flatMap(g => g.files.map(f => f.id))

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleImport() {
    if (selected.size === 0)
      return
    const { imported } = await importMutation.mutateAsync({ projectId, proposalMediaFileIds: [...selected] })
    toast.success(`Imported ${imported} photo${imported === 1 ? '' : 's'}`)
    setSelected(new Set())
    setOpen(false)
    onImported()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Import from proposal</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Import photos from a proposal</DialogTitle></DialogHeader>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(allIds))}>
            Select all
          </Button>
        </div>
        <div className="max-h-[60vh] space-y-6 overflow-y-auto">
          {(groups.data ?? []).map(group => (
            <section key={group.proposalId}>
              <h4 className="mb-2 text-sm font-semibold">{group.proposalLabel}</h4>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.files.map(file => (
                  <button
                    type="button"
                    key={file.id}
                    onClick={() => toggle(file.id)}
                    className="relative overflow-hidden rounded border"
                  >
                    <img src={file.url} alt={file.name} className="aspect-square w-full object-cover" />
                    <span className="absolute right-1 top-1">
                      <Checkbox checked={selected.has(file.id)} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {groups.isSuccess && (groups.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No proposal photos available to import for this project.</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={handleImport} disabled={selected.size === 0 || importMutation.isPending}>
            {`Import ${selected.size || ''}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire the button into the project media manager**

In `src/shared/components/portfolio/sortable-media-manager.tsx`, render `<ImportFromProposalDialog projectId={projectId} onImported={onUpdate} />` in the manager header (near the upload controls). Import the component.

> Confirm exact shadcn import paths (`Dialog`, `Checkbox`) against the repo.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Manual verification (end-to-end import)**

1. `pnpm dev`
2. Ensure a proposal (on a meeting whose `projectId` points at a test project) has ≥1 image file.
3. Open that project's Photos tab → "Import from proposal" → the proposal's photos appear.
4. Use "Select all", then Import.
5. Confirm the selected photos now appear in the project's "uncategorized" phase, a new `media_files` row exists, the R2 object was copied into the portfolio bucket, and optimization runs (`optimization_status` → `optimized`).

Expected: selected photos copy in and optimize; the source proposal file is untouched.

- [ ] **Step 5: Commit**

```bash
git add src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx src/shared/components/portfolio/sortable-media-manager.tsx
git commit -m "feat(projects): import-from-proposal photo picker in the project gallery

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Documentation — new rules + stale conversion-trigger fix + optimizer API

**Files:**
- Modify: `src/shared/entities/proposals/DOCS.md`
- Modify: `src/shared/entities/meetings/DOCS.md`, `src/shared/entities/projects/DOCS.md`
- Create: `src/shared/lib/file-optimization/DOCS.md`

- [ ] **Step 1: Add proposal-media rules to `proposals/DOCS.md`**

Add a new `### proposal-media-visibility` rule section documenting: the `proposal_media_files` table, the `internal | homeowner` flag, private-bucket + presigned-URL serving (no `url` column), the lock-ladder EXEMPTION (media is web-presentation, not signed-envelope content — do not add freeze gates), and that `getFullView` returns homeowner-visible media only while the agent Files tab lists all via `proposalsRouter.media.list`. Add a `### proposal-media-copy-to-project` rule for the manual import action.

- [ ] **Step 2: Fix the stale `#conversion-trigger` rule**

Rewrite `proposals/DOCS.md#conversion-trigger` (currently at line ~92) to describe reality:
> Project creation is **not** an automatic side-effect of approval. Approving a proposal (`status → approved`, via the table action or the `completed` contract webhook in `contracts.service.ts:applyContractEvent`) inserts **no** project. A Project is created by the agent-driven `projects.router/business.router.ts` `create` mutation, which also sets the meeting outcome `converted_to_project`. There is no `proposals.router/business.router.ts`.

Update the cross-references that assert the old behavior:
- `meetings/DOCS.md` (the `converted_to_project` "set by proposal approval" lines) → "set by project creation (`projects.business.create`), which the agent runs after approval."
- `projects/DOCS.md` (the "meeting outcome flips to converted_to_project" step) → confirm it points at `projects.business.create`.

- [ ] **Step 3: Write the optimizer API doc**

Create `src/shared/lib/file-optimization/DOCS.md` documenting `optimizeFile`, the `FileKind` dispatch, the `FileOptimizationResult` contract, the image/pdf/video/other strategies, and the two flagged follow-ups (server-side video transcode; PDF first-page rasterization). Note that images are byte-for-byte identical to the pre-refactor pipeline.

- [ ] **Step 4: Verify no broken doc anchors + lint**

Run: `pnpm lint`
(Markdown isn't type-checked; this task's "verification" is a careful re-read that the corrected `#conversion-trigger` text matches the code paths cited in Task 13's findings.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/proposals/DOCS.md src/shared/entities/meetings/DOCS.md src/shared/entities/projects/DOCS.md src/shared/lib/file-optimization/DOCS.md
git commit -m "docs(proposals): proposal-media rules, optimizer API, fix stale conversion-trigger

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (run before handing off)

**Spec coverage** (against `2026-08-05-proposal-capabilities-media-portfolio-finance-design.md`, Feature 1 + cross-cutting):
- Table + visibility flag → Task 1 ✅
- Agent-only router (getUploadUrl/create/list/setVisibility/reorder/rename/delete) → Task 7 ✅
- Presigned PUT to `tpr-homeowner-files` under `proposals/{id}/…` → Task 7 ✅
- Files tab + accept image/video/pdf + visibility toggle + grouping → Tasks 10–11 ✅
- Lock-exempt media → Tasks 7, 11 (documented Task 15) ✅
- getFullView presigned homeowner-only media → Task 8 ✅
- Gallery above first SOW (photos/videos inline, PDFs as downloads, empty-renders-nothing) → Task 12 ✅
- Generalized optimizer (image unchanged, pdf pageCount, video/other skipped, shared core, two wrappers) → Tasks 3–4, 6 ✅
- `r2Client.copyObject` → Task 2 ✅
- Manual import (mutation + picker + Select all + image-only) → Tasks 13–14 ✅
- Docs incl. stale conversion-trigger fix → Task 15 ✅

**Deferred (correctly, per spec Out-of-scope):** video transcode/poster server-side, PDF first-page raster, dnd-kit reorder in the proposal manager (procedure exists; UI later).

**Type consistency:** `ProposalMediaFile`, `ProposalMediaView`, `proposalMediaVisibilities`, `optimizeFile`, `FileOptimizationResult`, `resolveProposalMediaUrl`, `optimizeProposalMediaJob`, `createProposalMediaRouter`, `importFromProposal` used consistently across tasks. Router mounted at `proposalsRouter.media`; client calls `trpc.proposalsRouter.media.*`.

**Known implementer confirmations (called out inline):** the `entity` param type for the media router (copy from `contracts.router.ts`); the exact `useInvalidation` surface; shadcn import paths; how `scope-of-work.tsx` reaches the proposal object; whether `node:path` bundles client-side (avoided).
