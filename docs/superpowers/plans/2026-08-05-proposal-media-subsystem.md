# Media Engine Generalization + Proposal Media — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the existing project `media_files` infrastructure into a shared "media engine" (schema, optimization pipeline+job, upload helpers, UI primitives) consumed by BOTH project media and a new proposal media feature — then build proposal media (attachments + per-file `internal|homeowner` visibility, homeowner gallery, manual copy-to-project) on that shared engine. No 80% copy: the substance is shared, only genuinely-divergent wiring (owner FK, bucket/access, taxonomy, auth) differs.

**Architecture — "one engine, two owners":** Two tables (`media_files`, `proposal_media_files`) sharing a `baseMediaColumns` column set. ONE optimizer core (`optimizeFile`: image/pdf now; video/pdf-raster in Plan 1b), ONE `optimizeMediaJob({ ownerKind, mediaId })` with an owner registry, table-parameterized optimization setters, a shared upload-target builder, shared UI primitives (`MediaCard`, dnd reorder grid, bulk bar) + generic hooks. Thin per-owner routers wire these (project: `agentProcedure`, public bucket, phase/hero; proposal: entity-scoped + CASL, private bucket, presigned, visibility, lock-exempt). Reorder ships for both. The **existing project path is migrated onto the shared engine** with regression gates.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), Zod, TanStack Query, `@aws-sdk/client-s3` (R2), `sharp`, `pdf-lib`, Upstash QStash, dnd-kit, Tailwind v4, shadcn/ui.

## Global Constraints

- **Verification model (NO unit-test runner in this repo):** every task closes with `pnpm tsc` (no errors) + `pnpm lint` (clean) + the stated manual/DB/Playwright check. Do NOT write vitest/jest/pytest — there is none. Never `pnpm build`.
- **Regression discipline:** the project media path is LIVE. Every task that touches it (`media_files` schema, `media.service`, `optimize-image` job, `media.router`, `sortable-media-manager`, `sortable-photo-card`) must end with the **Project-Media Regression Checklist** (defined once, at the end of this plan) passing.
- **DB pushes:** `pnpm db:push:dev` ONLY. Schema refactors that must be no-ops are verified with `pnpm db:push:dev --dry-run` reporting "No changes".
- **Git:** work on `main`, stage explicitly by path (never `git add -A`). Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **IDs:** both media tables use `serial` PK (`unsafeId`) → media-id inputs are `z.number()`. Owner ids are `uuid`.
- **Buckets:** project → `R2_BUCKETS.portfolioProjects` (public CDN). Proposal → `R2_BUCKETS.homeownerFiles` (private, presigned only). Proposal path: `proposals/{proposalId}/{uuid}{ext}`.
- **Proposal access:** presigned GET only; `proposal_media_files` has NO `url` column. Visibility default `'internal'`. Media edits are **lock-exempt** (no `isProposalFrozen` gate).
- **Conventions:** one component per file, named exports, `motion/react`, RHF+Zod for forms, entity co-location. Follow `memory/coding-conventions.md`.

---

## File Structure

**Create (shared engine):**
- `src/shared/db/schema/lib/media-columns.ts` — `baseMediaColumns` shared column set.
- `src/shared/lib/file-optimization/types.ts` — `FileKind`, `FileOptimizationResult`, `classifyFileKind`.
- `src/shared/lib/file-optimization/strategies/pdf.ts` — pdf-lib page count.
- `src/shared/lib/file-optimization/optimize-file.ts` — kind-dispatched core.
- `src/shared/lib/file-optimization/DOCS.md` — optimizer API contract.
- `src/shared/services/media/optimization-target.ts` — owner registry (`ownerKind → { getFile, setProcessing/Complete/Failed }`).
- `src/shared/services/media/optimize-media.ts` — generic `optimizeMediaFile({ ownerKind, mediaId })`.
- `src/shared/services/providers/upstash/jobs/optimize-media.ts` — the ONE job.
- `src/shared/services/media/upload-target.ts` — `buildMediaUploadTarget(config, …)` shared presigned-PUT helper.
- `src/shared/hooks/use-media-upload.ts` — **generalized** (currently project-only; widened by config).
- `src/shared/components/media/media-card.tsx` — shared card primitive.
- `src/shared/components/media/media-reorder-grid.tsx` — shared dnd grid.

**Create (proposal owner):**
- `src/shared/db/schema/proposal-media-files.ts`
- `src/shared/entities/proposal-media-files/dal/server/queries.ts`
- `src/shared/entities/proposal-media-files/dal/server/mutations.ts`
- `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts`
- `src/trpc/routers/proposals.router/media.router.ts`
- `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts`
- `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`
- `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`
- `src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx`

**Modify (migrate project onto engine):**
- `src/shared/db/schema/media-files.ts` — spread `baseMediaColumns` (no DB diff).
- `src/shared/db/schema/index.ts` — export proposal table.
- `src/shared/services/media.service.ts` — route through `optimizeFile`.
- `src/shared/services/providers/upstash/jobs/optimize-image.ts` — replace with `optimize-media` (repoint call sites).
- `src/app/api/qstash-jobs/route.ts` — register the new job.
- `src/trpc/routers/projects.router/media.router.ts` — dispatch `optimizeMediaJob`, use shared upload-target + `importFromProposal`.
- `src/shared/components/portfolio/sortable-media-manager.tsx`, `sortable-photo-card.tsx` — recompose on shared primitives (keep phase/hero/Drive).
- `src/shared/services/providers/r2/client.ts` — add `copyObject`.
- `src/trpc/routers/proposals.router/index.ts` — mount `media:` sub-router.
- `src/shared/entities/proposals/dal/server/queries.ts` — `getFullView` media enrichment.
- `src/features/proposal-flow/ui/components/form/index.tsx`, `views/edit-proposal-view.tsx` — Files tab.
- `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx` — mount gallery.
- DOCS: `proposals/DOCS.md`, `meetings/DOCS.md`, `projects/DOCS.md`, `file-optimization/DOCS.md`.

---

# PHASE A — Shared foundation (greenfield; zero risk to live code)

## Task A1: `baseMediaColumns` + `proposal_media_files` table

**Files:**
- Create: `src/shared/db/schema/lib/media-columns.ts`, `src/shared/db/schema/proposal-media-files.ts`
- Modify: `src/shared/db/schema/index.ts`

**Interfaces:**
- Produces: `baseMediaColumns` (object of Drizzle columns), `proposalMediaFiles` table, `ProposalMediaFile`, `insertProposalMediaFileSchema`/`InsertProposalMediaFile`, `proposalMediaVisibilities`/`ProposalMediaVisibility`.

- [ ] **Step 1: Shared base columns**

Exactly the columns `media_files` and `proposal_media_files` share (so extracting them from `media_files` later is a no-op DB diff). Excludes `id` (PK added per-table), owner FK, and owner-specific taxonomy.

```ts
// src/shared/db/schema/lib/media-columns.ts
import { integer, jsonb, text, varchar } from 'drizzle-orm/pg-core'
import { createdAt, updatedAt } from './schema-helpers'

/**
 * Columns shared by every media table (project + proposal). Owner FK + taxonomy
 * (phase/hero vs visibility) + PK are added per-table. Keeping these identical is
 * what lets the shared optimizer/setters operate on either table.
 */
export const baseMediaColumns = {
  name: varchar('name', { length: 80 }).notNull(),
  pathKey: text('path_key').notNull().unique(),
  bucket: text('bucket').notNull(),
  mimeType: text('mime_type').notNull(),
  fileExtension: text('file_extension').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  duration: integer('duration'),
  optimizationStatus: text('optimization_status').notNull().default('pending'),
  optimizationVariants: jsonb('optimization_variants').$type<string[]>(),
  blurDataUrl: text('blur_data_url'),
  createdAt,
  updatedAt,
}
```

> Implementer note: confirm the relative import path to `schema-helpers` (from `schema/lib/` it is `./schema-helpers`). `createdAt`/`updatedAt` live there per the existing `media-files.ts` import.

- [ ] **Step 2: Proposal media table**

```ts
// src/shared/db/schema/proposal-media-files.ts
import type z from 'zod'
import { relations } from 'drizzle-orm'
import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { baseMediaColumns } from './lib/media-columns'
import { unsafeId } from './lib/schema-helpers'
import { proposals } from './proposals'

export const proposalMediaVisibilities = ['internal', 'homeowner'] as const
export type ProposalMediaVisibility = (typeof proposalMediaVisibilities)[number]

/**
 * Per-proposal file store (photos, videos, PDFs). Proposal-owned; SEPARATE from
 * media_files. Access is ALWAYS presigned against the private tpr-homeowner-files
 * bucket — no `url` column, no public domain. `visibility` is a pure DB flag
 * (toggling never moves bytes). Media edits are lock-exempt (web-presentation,
 * not signed-envelope content).
 */
export const proposalMediaFiles = pgTable('proposal_media_files', {
  id: unsafeId,
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  ...baseMediaColumns,
  visibility: text('visibility', { enum: proposalMediaVisibilities }).notNull().default('internal'),
  pageCount: integer('page_count'),
  thumbnailPathKey: text('thumbnail_path_key'), // video poster object key (presigned at read); null in v1
})

export const proposalMediaFilesRelations = relations(proposalMediaFiles, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalMediaFiles.proposalId], references: [proposals.id] }),
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

- [ ] **Step 3: Register in the barrel**

In `src/shared/db/schema/index.ts`, add after `export * from './proposal-incentives'`:
```ts
export * from './proposal-media-files'
```

- [ ] **Step 4: Push + verify**

Run: `pnpm tsc` → clean. Then `pnpm db:push:dev` → creates `proposal_media_files`. Then `pnpm db:push:dev --dry-run` → "No changes detected".

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add src/shared/db/schema/lib/media-columns.ts src/shared/db/schema/proposal-media-files.ts src/shared/db/schema/index.ts
git commit -m "feat(media): shared baseMediaColumns + proposal_media_files table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task A2: R2 `copyObject` primitive

**Files:** Modify: `src/shared/services/providers/r2/client.ts`

**Interfaces:** Produces `r2Client.copyObject({ sourceBucket, sourceKey, destBucket, destKey }): Promise<void>`.

- [ ] **Step 1:** Add `CopyObjectCommand` to the `@aws-sdk/client-s3` import.
- [ ] **Step 2:** Add the method next to `putObject`/`getObject`:

```ts
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

- [ ] **Step 3:** `pnpm tsc && pnpm lint` → clean.
- [ ] **Step 4:** Commit (`feat(r2): add cross-bucket copyObject primitive`).

## Task A3: File-optimization types + classifier

**Files:** Create `src/shared/lib/file-optimization/types.ts`

**Interfaces:** Produces `FileKind`, `classifyFileKind(mimeType): FileKind`, `FileOptimizationResult`.

- [ ] **Step 1:** Create:

```ts
// src/shared/lib/file-optimization/types.ts
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
 * Normalized optimizer output. `complete` = ran; `skipped` = nothing to do
 * server-side today (video/other — transcode+raster arrive in Plan 1b);
 * `failed` = threw.
 */
export interface FileOptimizationResult {
  status: 'complete' | 'skipped' | 'failed'
  variants?: string[]
  blurDataUrl?: string
  pageCount?: number
  duration?: number
}
```

- [ ] **Step 2:** `pnpm tsc && pnpm lint`. **Step 3:** Commit (`feat(file-optimization): kind classifier + result type`).

## Task A4: `optimizeFile` core (image + pdf)

**Files:** Create `src/shared/lib/file-optimization/strategies/pdf.ts`, `src/shared/lib/file-optimization/optimize-file.ts`

**Interfaces:**
- Consumes: `classifyFileKind`, `FileOptimizationResult`; `processImageVariants`; `r2Client.getObject/putObject`; `R2BucketName`.
- Produces: `optimizeFile({ bucket, pathKey, mimeType }): Promise<FileOptimizationResult>`.

- [ ] **Step 1:** PDF strategy:

```ts
// src/shared/lib/file-optimization/strategies/pdf.ts
import type { Buffer } from 'node:buffer'
import { PDFDocument } from 'pdf-lib'

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

- [ ] **Step 2:** Core (note the `// PLAN 1b:` markers where video transcode + PDF raster attach — this is where they land ONCE for both owners):

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
 * Generalized file optimizer, shared by project + proposal media.
 * - image → sharp webp variants (sm/md/lg) + blur LQIP, uploaded next to original
 * - pdf   → page count (pdf-lib). PLAN 1b: first-page raster thumbnail
 * - video → skipped today. PLAN 1b: transcode + poster (needs infra decision)
 * - other → skipped
 */
export async function optimizeFile(input: OptimizeFileInput): Promise<FileOptimizationResult> {
  const kind = classifyFileKind(input.mimeType)

  if (kind === 'image') {
    const originalBuffer = await r2Client.getObject(input.bucket, input.pathKey)
    const { variants, blurDataUrl, variantSuffixes } = await processImageVariants(originalBuffer)
    const basePath = input.pathKey.replace(/\.[^.]+$/, '')
    await Promise.all(
      variants.map(v => r2Client.putObject(input.bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp')),
    )
    return { status: 'complete', variants: variantSuffixes, blurDataUrl }
  }

  if (kind === 'pdf') {
    const buffer = await r2Client.getObject(input.bucket, input.pathKey)
    const pageCount = await readPdfPageCount(buffer)
    // PLAN 1b: rasterize page 1 → thumbnail
    return { status: 'complete', pageCount: pageCount ?? undefined }
  }

  // PLAN 1b: video transcode + poster
  return { status: 'skipped' }
}
```

- [ ] **Step 3:** `pnpm tsc && pnpm lint`. **Step 4:** Commit (`feat(file-optimization): shared optimizeFile core (image+pdf)`).

## Task A5: Generic optimization DAL setters (table-parameterized)

**Files:** Create `src/shared/entities/media-files/dal/server/optimization.ts`

**Interfaces:**
- Produces (operate on ANY media table sharing `baseMediaColumns`):
  - `setMediaOptimizationProcessing(table, id): Promise<void>`
  - `setMediaOptimizationComplete(table, id, { variantSuffixes, blurDataUrl, pageCount? }): Promise<void>`
  - `setMediaOptimizationFailed(table, id): Promise<void>`

- [ ] **Step 1:** Create generic setters keyed on the Drizzle table:

```ts
// src/shared/entities/media-files/dal/server/optimization.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'

/**
 * Optimization-status setters that work on ANY media table sharing baseMediaColumns
 * (media_files, proposal_media_files). `pageCount` is only written when the target
 * table has the column (proposal media); pass undefined for project media.
 */
type OptimizableTable = {
  id: any
  optimizationStatus: any
  optimizationVariants: any
  blurDataUrl: any
  pageCount?: any
}

export async function setMediaOptimizationProcessing(table: OptimizableTable, id: number): Promise<void> {
  await db.update(table as any).set({ optimizationStatus: 'processing' }).where(eq(table.id, id))
}

export async function setMediaOptimizationComplete(
  table: OptimizableTable,
  id: number,
  data: { variantSuffixes: string[], blurDataUrl: string, pageCount?: number },
): Promise<void> {
  const patch: Record<string, unknown> = {
    optimizationStatus: 'optimized',
    optimizationVariants: data.variantSuffixes,
    blurDataUrl: data.blurDataUrl,
  }
  if (table.pageCount && data.pageCount !== undefined)
    patch.pageCount = data.pageCount
  await db.update(table as any).set(patch).where(eq(table.id, id))
}

export async function setMediaOptimizationFailed(table: OptimizableTable, id: number): Promise<void> {
  await db.update(table as any).set({ optimizationStatus: 'failed' }).where(eq(table.id, id))
}
```

> Implementer note: Drizzle's generic-table typing is awkward; the `as any` on the update target is a pragmatic, contained escape (the setters only ever receive the two known media tables). If `pnpm tsc` complains about `table.id` in `eq`, type the param as `PgTable & { id: PgColumn, ... }` — inspect the `mediaFiles` table's inferred type and mirror it. Keep the surface minimal.

- [ ] **Step 2:** `pnpm tsc && pnpm lint`. **Step 3:** Commit (`feat(media): table-parameterized optimization setters`).

## Task A6: Owner registry + generic `optimizeMediaFile` + the ONE job

**Files:**
- Create: `src/shared/services/media/optimization-target.ts`, `src/shared/services/media/optimize-media.ts`, `src/shared/services/providers/upstash/jobs/optimize-media.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`

**Interfaces:**
- Produces: `MediaOwnerKind = 'project' | 'proposal'`; `optimizeMediaFile({ ownerKind, mediaId }): Promise<void>`; `optimizeMediaJob` (key `'optimize-media'`, payload `{ ownerKind: MediaOwnerKind, mediaId: number }`).

- [ ] **Step 1:** Owner registry — maps ownerKind → its table + file getter:

```ts
// src/shared/services/media/optimization-target.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema/media-files'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'

export type MediaOwnerKind = 'project' | 'proposal'

interface OptimizationTarget {
  table: any
  getFile: (id: number) => Promise<{ id: number, bucket: string, pathKey: string, mimeType: string, optimizationStatus: string } | undefined>
}

export const optimizationTargets: Record<MediaOwnerKind, OptimizationTarget> = {
  project: {
    table: mediaFiles,
    getFile: async (id) => {
      const [f] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id))
      return f
    },
  },
  proposal: {
    table: proposalMediaFiles,
    getFile: async (id) => {
      const [f] = await db.select().from(proposalMediaFiles).where(eq(proposalMediaFiles.id, id))
      return f
    },
  },
}
```

- [ ] **Step 2:** Generic optimize service:

```ts
// src/shared/services/media/optimize-media.ts
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import type { MediaOwnerKind } from './optimization-target'
import {
  setMediaOptimizationComplete,
  setMediaOptimizationFailed,
  setMediaOptimizationProcessing,
} from '@/shared/entities/media-files/dal/server/optimization'
import { optimizeFile } from '@/shared/lib/file-optimization/optimize-file'
import { optimizationTargets } from './optimization-target'

/** Optimizes one media file regardless of owner. Idempotent (skips if optimized). */
export async function optimizeMediaFile({ ownerKind, mediaId }: { ownerKind: MediaOwnerKind, mediaId: number }): Promise<void> {
  const target = optimizationTargets[ownerKind]
  const file = await target.getFile(mediaId)
  if (!file) {
    console.error(`[optimizeMedia] ${ownerKind} media ${mediaId} not found`)
    return
  }
  if (file.optimizationStatus === 'optimized')
    return

  await setMediaOptimizationProcessing(target.table, mediaId)
  try {
    const result = await optimizeFile({
      bucket: file.bucket as R2BucketName,
      pathKey: file.pathKey,
      mimeType: file.mimeType,
    })
    await setMediaOptimizationComplete(target.table, mediaId, {
      variantSuffixes: result.variants ?? [],
      blurDataUrl: result.blurDataUrl ?? '',
      pageCount: result.pageCount,
    })
  }
  catch (error) {
    console.error(`[optimizeMedia] failed for ${ownerKind} ${mediaId}:`, error)
    await setMediaOptimizationFailed(target.table, mediaId)
  }
}
```

- [ ] **Step 3:** The job:

```ts
// src/shared/services/providers/upstash/jobs/optimize-media.ts
import type { MediaOwnerKind } from '@/shared/services/media/optimization-target'
import { optimizeMediaFile } from '@/shared/services/media/optimize-media'
import { createJob } from '../lib/create-job'

interface OptimizeMediaPayload {
  ownerKind: MediaOwnerKind
  mediaId: number
}

export const optimizeMediaJob = createJob<OptimizeMediaPayload>(
  'optimize-media',
  async ({ ownerKind, mediaId }) => {
    await optimizeMediaFile({ ownerKind, mediaId })
  },
)
```

- [ ] **Step 4:** Register in `src/app/api/qstash-jobs/route.ts` (import + add to `jobs` array). Keep the old `optimizeImageJob` registered for now (removed in Task B2).

- [ ] **Step 5:** `pnpm tsc && pnpm lint`. **Step 6:** Commit (`feat(media): owner registry + generic optimizeMediaFile + optimize-media job`).

---

# PHASE B — Migrate the project path onto the shared optimizer (regression-gated)

## Task B1: Refactor `media_files` schema onto `baseMediaColumns` (no DB diff)

**Files:** Modify `src/shared/db/schema/media-files.ts`

- [ ] **Step 1:** Rewrite the table to spread `baseMediaColumns`, keeping the project-specific columns (`url`, `tags`, `isHeroImage`, `phase`, `thumbnailUrl`, `projectId`) explicit. The resulting column set must be byte-identical to today:

```ts
export const mediaFiles = pgTable('media_files', {
  id: unsafeId,
  ...baseMediaColumns,
  url: varchar('url', { length: 255 }).notNull(),
  tags: jsonb('tags').$type<Tag[]>(),
  isHeroImage: boolean('is_hero_image').notNull().default(false),
  phase: mediaPhaseEnum('phase').notNull().default('uncategorized'),
  thumbnailUrl: varchar('thumbnail_url', { length: 255 }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
})
```

Keep `mediaFilesRelations`, `selectMediaFilesSchema`, `insertMediaFilesSchema` unchanged. Add the `baseMediaColumns` import; drop now-unused single-column imports if any.

- [ ] **Step 2: Verify NO DB diff**

Run: `pnpm db:push:dev --dry-run`
Expected: **"No changes detected"** — proves the refactor is a pure code reorganization. If it reports changes, a column def diverged (order doesn't matter; type/default/nullability do) — fix until the dry-run is clean.

- [ ] **Step 3:** `pnpm tsc && pnpm lint` → clean. **Step 4:** Commit (`refactor(media): media_files spreads baseMediaColumns (no DB change)`).

## Task B2: Route project optimization through the shared job + core; retire `optimizeImageJob`

**Files:** Modify `src/shared/services/media.service.ts`, `src/trpc/routers/projects.router/media.router.ts`, delete `src/shared/services/providers/upstash/jobs/optimize-image.ts`, modify `src/app/api/qstash-jobs/route.ts`

- [ ] **Step 1:** In `projects.router/media.router.ts`, replace the two `optimizeImageJob.dispatch({ mediaFileId: … })` calls (in `create` and `retryOptimization`) with:

```ts
void optimizeMediaJob.dispatch({ ownerKind: 'project', mediaId: created.id })
// and in retryOptimization:
void optimizeMediaJob.dispatch({ ownerKind: 'project', mediaId: input.mediaFileId })
```

Update imports: drop `optimizeImageJob`, add `optimizeMediaJob` from `@/shared/services/providers/upstash/jobs/optimize-media`.

- [ ] **Step 2:** `mediaService.optimizeImage` is now unused by the job (the job calls `optimizeMediaFile`). Confirm no other caller references `mediaService.optimizeImage` (grep). If none, delete `src/shared/services/media.service.ts`. If something else uses it, leave it but have it delegate to `optimizeMediaFile({ ownerKind: 'project', mediaId })`.

Run: `grep -rn "mediaService\|optimizeImageJob\|optimize-image" src` — repoint/remove all hits.

- [ ] **Step 3:** Delete `optimize-image.ts` and remove its import + `jobs` array entry from `src/app/api/qstash-jobs/route.ts`.

- [ ] **Step 4:** `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 5: Project-Media Regression Checklist** (defined at end of plan) — run it. Image optimization must be identical (variants + blur produced; status → optimized).

- [ ] **Step 6:** Commit (`refactor(media): project media optimizes via shared optimize-media job; retire optimize-image`).

---

# PHASE C — Proposal media DAL, router, read enrichment

## Task C1: Proposal-media DAL (reads, presign resolver, view mapper, scope-checked mutations)

**Files:** Create `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts`, `dal/server/queries.ts`, `dal/server/mutations.ts`

**Interfaces:** (identical to the prior draft — reproduced so this task is self-contained)
- `resolveProposalMediaUrl(file): Promise<string>` — best-variant-or-original presign.
- `getProposalMediaFileById(id)`, `listProposalMedia(proposalId)`, `listHomeownerProposalMedia(proposalId)`.
- `ProposalMediaView` + `toProposalMediaView(file): Promise<ProposalMediaView>`.
- Scope-checked mutations: `insertProposalMediaFile(ctx, values)`, `deleteProposalMediaFile(ctx, id)`, `reorderProposalMedia(ctx, updates)`, `setProposalMediaVisibility(ctx, id, visibility)`, `renameProposalMediaFile(ctx, id, name)`.

- [ ] **Step 1:** Presign resolver:

```ts
// src/shared/entities/proposal-media-files/lib/resolve-media-url.ts
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { r2Client } from '@/shared/services/providers/r2/client'

/** Presigned GET for a proposal media object; images prefer the largest webp variant. */
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

- [ ] **Step 2:** Queries + view mapper (`ProposalMediaView` = `{ id, name, mimeType, visibility, sortOrder, url, thumbnailUrl, blurDataUrl, duration, pageCount, optimizationStatus }`):

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
  return db.select().from(proposalMediaFiles)
    .where(eq(proposalMediaFiles.proposalId, proposalId))
    .orderBy(asc(proposalMediaFiles.sortOrder))
}

export async function listHomeownerProposalMedia(proposalId: string): Promise<ProposalMediaFile[]> {
  return db.select().from(proposalMediaFiles)
    .where(and(eq(proposalMediaFiles.proposalId, proposalId), eq(proposalMediaFiles.visibility, 'homeowner')))
    .orderBy(asc(proposalMediaFiles.sortOrder))
}
```

- [ ] **Step 3:** Scope-checked mutations — identical to the structure validated in the prior draft:

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

async function assertProposalInScope(ctx: ScopedContext, proposalId: string): Promise<void> {
  const [row] = await db.select({ id: proposals.id }).from(proposals)
    .where(and(eq(proposals.id, proposalId), ctx.scope ?? undefined))
  if (!row)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
}

async function assertMediaInScope(ctx: ScopedContext, id: number): Promise<ProposalMediaFile> {
  const [file] = await db.select().from(proposalMediaFiles).where(eq(proposalMediaFiles.id, id))
  if (!file)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Media file not found' })
  await assertProposalInScope(ctx, file.proposalId)
  return file
}

export async function insertProposalMediaFile(ctx: ScopedContext, values: InsertProposalMediaFile): Promise<ProposalMediaFile> {
  await assertProposalInScope(ctx, values.proposalId)
  const [created] = await db.insert(proposalMediaFiles).values(values).returning()
  return created
}

export async function deleteProposalMediaFile(ctx: ScopedContext, id: number): Promise<void> {
  const file = await assertMediaInScope(ctx, id)
  await r2Client.deleteMediaWithVariants(file.bucket as R2BucketName, file.pathKey)
  await db.delete(proposalMediaFiles).where(eq(proposalMediaFiles.id, id))
}

export async function reorderProposalMedia(ctx: ScopedContext, updates: { id: number, sortOrder: number }[]): Promise<void> {
  if (updates.length === 0)
    return
  await assertMediaInScope(ctx, updates[0].id)
  await db.transaction(async (tx) => {
    for (const { id, sortOrder } of updates)
      await tx.update(proposalMediaFiles).set({ sortOrder }).where(eq(proposalMediaFiles.id, id))
  })
}

export async function setProposalMediaVisibility(ctx: ScopedContext, id: number, visibility: ProposalMediaVisibility): Promise<void> {
  await assertMediaInScope(ctx, id)
  await db.update(proposalMediaFiles).set({ visibility }).where(eq(proposalMediaFiles.id, id))
}

export async function renameProposalMediaFile(ctx: ScopedContext, id: number, name: string): Promise<void> {
  await assertMediaInScope(ctx, id)
  await db.update(proposalMediaFiles).set({ name }).where(eq(proposalMediaFiles.id, id))
}
```

- [ ] **Step 4:** `pnpm tsc && pnpm lint`. **Step 5:** Commit (`feat(proposals): proposal-media DAL`).

## Task C2: Shared upload-target helper + proposal `media` sub-router

**Files:** Create `src/shared/services/media/upload-target.ts`, `src/trpc/routers/proposals.router/media.router.ts`; Modify `src/trpc/routers/proposals.router/index.ts`

**Interfaces:**
- Produces: `buildMediaUploadTarget({ bucket, pathKey, mimeType }): Promise<{ uploadUrl: string, pathKey: string, bucket: string }>` (thin wrapper over `getPresignedUploadUrl` so both owners share the presign call); `createProposalMediaRouter(entity)` mounted at `proposalsRouter.media`.

- [ ] **Step 1:** Shared upload-target helper (small but shared — both routers call it):

```ts
// src/shared/services/media/upload-target.ts
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { r2Client } from '@/shared/services/providers/r2/client'

/** Presigned PUT target for a media upload. Callers own the pathKey convention. */
export async function buildMediaUploadTarget({ bucket, pathKey, mimeType }: {
  bucket: R2BucketName
  pathKey: string
  mimeType: string
}): Promise<{ uploadUrl: string, pathKey: string, bucket: R2BucketName }> {
  const uploadUrl = await r2Client.getPresignedUploadUrl({ bucket, pathKey, mimeType })
  return { uploadUrl, pathKey, bucket }
}
```

- [ ] **Step 2:** Proposal media router — entity-scoped, CASL-guarded, lock-exempt (mirrors the `incentives` precedent for auth; uses shared upload-target + shared job):

```ts
// src/trpc/routers/proposals.router/media.router.ts
// `entity` param type: copy the EXACT type used by createContractsRouter(entity) in contracts.router.ts
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
import { buildMediaUploadTarget } from '@/shared/services/media/upload-target'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
import { createTRPCRouter } from '../../init'

const PROPOSAL_BUCKET = R2_BUCKETS.homeownerFiles

function assertCanUpdate(ctx: { ability: { cannot: (a: string, s: string) => boolean } | null }) {
  if (!ctx.ability || ctx.ability.cannot('update', 'Proposal'))
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this proposal.' })
}

export function createProposalMediaRouter(entity: /* EntityRouterContext from contracts.router.ts */ any) {
  return createTRPCRouter({
    getUploadUrl: entity.authedProcedure
      .input(z.object({ proposalId: z.string().uuid(), filename: z.string(), mimeType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        assertCanUpdate(ctx)
        const ext = `.${input.filename.split('.').pop() ?? ''}`.toLowerCase()
        const pathKey = `proposals/${input.proposalId}/${crypto.randomUUID()}${ext}`
        return buildMediaUploadTarget({ bucket: PROPOSAL_BUCKET, pathKey, mimeType: input.mimeType })
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
        if (created.mimeType.startsWith('image/') || created.mimeType === 'application/pdf')
          void optimizeMediaJob.dispatch({ ownerKind: 'proposal', mediaId: created.id })
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
      .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); await setProposalMediaVisibility(ctx, input.id, input.visibility) }),

    reorder: entity.authedProcedure
      .input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) }))
      .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); await reorderProposalMedia(ctx, input.updates) }),

    rename: entity.authedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
      .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); await renameProposalMediaFile(ctx, input.id, input.name) }),

    delete: entity.authedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); await deleteProposalMediaFile(ctx, input.id) }),
  })
}
```

- [ ] **Step 3:** Mount in `proposals.router/index.ts`: `media: createProposalMediaRouter(entity),` (next to `contracts`). Import at top. Replace the `any`/comment with the real `entity` type copied from `contracts.router.ts`.

- [ ] **Step 4:** `pnpm tsc && pnpm lint` → clean. **Step 5:** Commit (`feat(proposals): proposalMedia sub-router (scoped, lock-exempt) + shared upload-target`).

## Task C3: `getFullView` homeowner-media enrichment

**Files:** Modify `src/shared/entities/proposals/dal/server/queries.ts`

- [ ] **Step 1:** Add `media: ProposalMediaView[]` to `ProposalWithCustomer`; import `listHomeownerProposalMedia`, `toProposalMediaView`, `ProposalMediaView`.
- [ ] **Step 2:** Before the final return in `getFullView`, fetch homeowner media + map, and add to the returned object (ALWAYS homeowner-only — the gallery IS the homeowner view; the agent Files tab uses `proposalsRouter.media.list`):

```ts
const homeownerMedia = await listHomeownerProposalMedia(row.id)
const media = await Promise.all(homeownerMedia.map(toProposalMediaView))
return { ...row, fundingJSON: hydratedFunding, customer, incentives, media } as ProposalWithCustomer
```

- [ ] **Step 3:** `pnpm tsc && pnpm lint`. **Step 4:** Commit (`feat(proposals): getFullView returns homeowner-visible media`).

---

# PHASE D — Shared UI primitives + managers (reorder for both owners)

## Task D1: Extract shared UI primitives (`MediaCard`, `MediaReorderGrid`) + generic upload hook

**Files:** Create `src/shared/components/media/media-card.tsx`, `src/shared/components/media/media-reorder-grid.tsx`; Modify `src/shared/hooks/use-media-upload.ts`

**Interfaces:**
- `MediaCardModel = { id: number, name: string, mimeType: string, url: string, blurDataUrl?: string | null, optimizationStatus?: string }` — the minimal shape both owners provide.
- `<MediaCard model controls onRename? onDelete />` where `controls?: ReactNode` is an owner-specific slot (hero/phase for project; visibility toggle for proposal) and drag handle/select are built-in.
- `<MediaReorderGrid items sortableIds onReorder renderItem />` — wraps `DndContext`+`SortableContext` (lift the exact sensors/config from `sortable-media-manager.tsx` lines 72-76, 522-533).
- `useMediaUpload(config)` — `config = { getUploadUrl, createMedia }` (the two mutations) so both owners share the getUploadUrl→PUT→create flow.

- [ ] **Step 1:** Generalize `useMediaUpload` to accept the two mutation callables (default-bind to the project router to preserve current call sites, OR update the one project call site). The PUT step is provider-agnostic. Keep the exact three-step flow from the current hook; parameterize only the two tRPC mutations and the `create` payload builder.

- [ ] **Step 2:** Build `MediaReorderGrid` from the existing dnd scaffolding (sensors, `closestCenter`, `rectSortingStrategy`, `AUTO_SCROLL_CONFIG`, `arrayMove`) — a generic wrapper taking `items`, `onReorder(updates: {id,sortOrder}[])`, and a `renderItem` prop.

- [ ] **Step 3:** Build `MediaCard` by extracting the presentational parts of `SortablePhotoCard` (image/video/pdf thumb, select checkbox, drag handle, name input, delete) and exposing owner-specific actions via a `controls` slot. Reuse `OptimizedImage` for images.

- [ ] **Step 4:** `pnpm tsc && pnpm lint`. **Step 5:** Commit (`refactor(media): shared MediaCard + MediaReorderGrid + generic useMediaUpload`).

## Task D2: Recompose the project manager on the shared primitives (regression-gated)

**Files:** Modify `src/shared/components/portfolio/sortable-media-manager.tsx`, `src/shared/components/portfolio/sortable-photo-card.tsx`

- [ ] **Step 1:** Refactor `SortableMediaManager` to render `MediaReorderGrid` + `MediaCard`, moving phase-tabs/hero/Google-Drive/bulk logic into the manager as project-specific config passed to `MediaCard`'s `controls` slot. Preserve the `getForEdit`-bound optimistic reorder (`editQueryOptions`) exactly. `SortablePhotoCard` becomes a thin wrapper that composes `MediaCard` with project controls (hero/phase/rename via `projectsRouter.media.*`), or is deleted if fully absorbed.
- [ ] **Step 2:** `pnpm tsc && pnpm lint`.
- [ ] **Step 3: Project-Media Regression Checklist** — MUST pass (this is the riskiest UI change).
- [ ] **Step 4:** Commit (`refactor(projects): project media manager on shared primitives`).

> Sequencing safety valve: if Step 1 proves too large/risky to land safely in one pass, STOP and split it into its own plan (Plan 1c) — leave the project manager as-is and have the proposal manager (Task D3) consume the shared primitives directly. The shared primitives are validated by the proposal consumer regardless; the project migration can follow. Flag this to the reviewer rather than forcing a risky refactor.

## Task D3: `ProposalMediaManager` (visibility groups + reorder)

**Files:** Create `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts`, `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`; use `useMediaUpload` (Task D1)

- [ ] **Step 1:** Client mutation hooks (thin `useMutation` wrappers over `trpc.proposalsRouter.media.*`, invalidating the `list` query for the proposal) — mirror `use-replace-incentives.ts`'s shape. Include a proposal-bound `useMediaUpload` config (getUploadUrl + create mutations from `trpc.proposalsRouter.media`).
- [ ] **Step 2:** Build `ProposalMediaManager({ proposalId })`: a `MediaDropzone`/upload button with `accept="image/*,video/*,application/pdf"`, files split into "Shown to homeowner" / "Internal only" groups, each rendered via `MediaReorderGrid` + `MediaCard` with a **visibility Switch** in the `controls` slot (calls `setVisibility`), plus delete. Reorder wired to `proposalsRouter.media.reorder`. NOT registered with RHF (self-contained tRPC state); lock-exempt.
- [ ] **Step 3:** `pnpm tsc && pnpm lint`. **Step 4:** Commit (`feat(proposals): ProposalMediaManager on shared media primitives`).

## Task D4: "Files" tab in the proposal editor

**Files:** Modify `src/features/proposal-flow/ui/components/form/index.tsx`, `src/features/proposal-flow/ui/views/edit-proposal-view.tsx`

- [ ] **Step 1:** Thread `proposalId?: string` into `ProposalForm`; pass it from `edit-proposal-view.tsx`.
- [ ] **Step 2:** Add `'files'` to `FORM_TABS` + `TAB_LABELS.files = 'Files'`; import `ProposalMediaManager`.
- [ ] **Step 3:** Render body: `{tab === 'files' && (proposalId ? <ProposalMediaManager proposalId={proposalId} /> : <p className="text-sm text-muted-foreground">Save the proposal first to attach files.</p>)}`. Do NOT wrap in a disabled fieldset — media is lock-exempt (the manager isn't RHF-registered, so the form `disabled` flag doesn't reach it).
- [ ] **Step 4:** `pnpm tsc && pnpm lint`.
- [ ] **Step 5: Manual verification:** editor → Files tab → upload JPG+MP4+PDF (all land "Internal only"); toggle JPG → "Homeowner"; reorder within a group; confirm DB rows, JPG `optimization_status → optimized` + variants, PDF `page_count`; delete MP4 (row + R2 gone); confirm the tab still works on an envelope-locked test proposal.
- [ ] **Step 6:** Commit (`feat(proposals): Files tab in proposal editor`).

---

# PHASE E — Homeowner gallery, copy-to-project, docs

## Task E1: Homeowner gallery above the first SOW section

**Files:** Create `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`; Modify `scope-of-work.tsx`

- [ ] **Step 1:** Build `ProposalMediaGallery({ media }: { media: ProposalMediaView[] })`: return `null` if empty; render images/videos inline (image uses `blurDataUrl` as background placeholder; video uses `controls` + `poster={thumbnailUrl ?? undefined}`); render public PDFs as a "Documents" list of download links (`href={url}` target=_blank), showing `pageCount` when present.
- [ ] **Step 2:** In `scope-of-work.tsx`, at the top of `CardContent` before the `Accordion`, render `<ProposalMediaGallery media={proposal.data.media ?? []} />` (read `media` off the same proposal object the component already uses for `projectJSON.data.sow`; widen its local type to include `media` if needed).
- [ ] **Step 3:** `pnpm tsc && pnpm lint`.
- [ ] **Step 4: Manual verification (unauthenticated token URL):** proposal with ≥1 homeowner photo → gallery renders above first SOW section; internal files absent; a homeowner PDF shows as a download; zero-homeowner-media proposal renders no gallery block.
- [ ] **Step 5:** Commit (`feat(proposals): homeowner media gallery above first SOW section`).

## Task E2: Copy photos from a proposal into a project (import)

**Files:** Modify `src/trpc/routers/projects.router/media.router.ts`; Create `src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx`; Modify `src/shared/components/portfolio/sortable-media-manager.tsx`

- [ ] **Step 1:** Add `listImportableProposalMedia({ projectId })` (query) — image-only proposal files from proposals on the project's meeting (`innerJoin meetings on meetings.projectId = projectId`), grouped by proposal, each file presigned via `resolveProposalMediaUrl`.
- [ ] **Step 2:** Add `importFromProposal({ projectId, proposalMediaFileIds })` (mutation): for each selected image, `r2Client.copyObject` from `homeownerFiles` → `portfolioProjects` under `projects/{projectId}/uncategorized/{uuid}{ext}`, insert a `media_files` row (`phase: 'uncategorized'`, public `url`), and `optimizeMediaJob.dispatch({ ownerKind: 'project', mediaId })`. Return `{ imported }`.
- [ ] **Step 3:** Build `ImportFromProposalDialog({ projectId, onImported })` — a Dialog listing importable photos grouped by proposal, per-photo multi-select, a **"Select all"** button, and Import. Wire it into `sortable-media-manager.tsx`'s header (`onImported={onUpdate}`).
- [ ] **Step 4:** `pnpm tsc && pnpm lint`.
- [ ] **Step 5: Manual verification:** project whose meeting has a proposal with ≥1 image → Photos tab → "Import from proposal" → Select all → Import → photos appear in `uncategorized`, `media_files` rows exist, R2 objects copied, optimization runs; source proposal file untouched.
- [ ] **Step 6:** Commit (`feat(projects): import photos from a proposal into a project gallery`).

## Task E3: Documentation + stale conversion-trigger fix

**Files:** Modify `proposals/DOCS.md`, `meetings/DOCS.md`, `projects/DOCS.md`; Create `src/shared/lib/file-optimization/DOCS.md`

- [ ] **Step 1:** `proposals/DOCS.md`: add `### proposal-media-visibility` (table, internal|homeowner, private-bucket+presigned, no `url` column, lock-EXEMPT — do not add freeze gates, getFullView=homeowner-only vs Files-tab `list`=all) and `### proposal-media-copy-to-project` (manual import, image-only, agent-selected).
- [ ] **Step 2:** Fix the stale `#conversion-trigger` (line ~92): project creation is NOT automatic on approval; it's the agent-driven `projects.router/business.router.ts` `create` (which sets `converted_to_project`); approval inserts no project; there is no `proposals.router/business.router.ts`. Update the cross-refs in `meetings/DOCS.md` and `projects/DOCS.md`.
- [ ] **Step 3:** Create `file-optimization/DOCS.md`: `optimizeFile` contract, `FileKind` dispatch, `FileOptimizationResult`, the owner registry + `optimizeMediaJob`, and the two Plan 1b follow-ups (video transcode, PDF raster). Note images are byte-for-byte identical to the pre-refactor pipeline.
- [ ] **Step 4:** `pnpm lint` (careful re-read that the corrected text matches code). **Step 5:** Commit (`docs(proposals): media rules, optimizer API, fix stale conversion-trigger`).

---

## Project-Media Regression Checklist (run wherever referenced)

With `pnpm dev` running, on a real portfolio project's Photos tab:
1. **Upload** a JPG → row appears; `optimization_status` transitions `pending → processing → optimized`; `optimization_variants` populated; `blur_data_url` set.
2. **Reorder** two photos via drag → order persists after refetch (optimistic update + server commit).
3. **Hero** toggle → the photo becomes hero and any prior hero in the same project is cleared.
4. **Move phase** (e.g. uncategorized → after) → the photo moves tabs.
5. **Rename** → debounced rename persists.
6. **Delete** → row and R2 object (+ variants) removed.
7. **Retry optimization** on a failed item → re-dispatches.
8. The edit view's optimization **polling** still resolves (spinner clears when status becomes `optimized`).

Any deviation = the generalization broke the incumbent; fix before proceeding.

---

## Self-Review

**Spec coverage** (Feature 1 + generalized-engine + copy-to-project + docs):
- Shared base columns / no DB diff → A1, B1 ✅
- Shared optimizer core + generic setters + ONE job + owner registry → A3–A6 ✅
- Project path migrated onto shared optimizer/job (regression-gated) → B2 ✅
- `r2Client.copyObject` → A2 ✅
- `proposal_media_files` + visibility + presigned-only (no url) → A1 ✅
- Proposal DAL (reads, presign, scope-checked mutations) → C1 ✅
- Shared upload-target + proposal router (scoped, CASL, lock-exempt) → C2 ✅
- getFullView homeowner-only media → C3 ✅
- Shared UI primitives (`MediaCard`, `MediaReorderGrid`) + generic upload hook → D1 ✅
- Project manager recomposed on primitives (regression-gated; split-to-1c valve) → D2 ✅
- ProposalMediaManager with visibility groups + **reorder** → D3 ✅
- Files tab → D4 ✅
- Homeowner gallery above first SOW → E1 ✅
- Copy-to-project (mutation + picker + Select all + image-only) → E2 ✅
- Docs + stale conversion-trigger fix → E3 ✅

**Plan 1b (committed, separate doc):** server-side video transcode + poster (infra decision), PDF first-page raster — both land in the shared `optimizeFile`/strategies (markers already in A4), so both owners get them. To be written next.

**Type consistency:** `baseMediaColumns`, `optimizeFile`, `FileOptimizationResult`, `MediaOwnerKind`, `optimizeMediaFile`, `optimizeMediaJob`, `optimizationTargets`, `buildMediaUploadTarget`, `ProposalMediaFile`, `ProposalMediaView`, `resolveProposalMediaUrl`, `MediaCard`/`MediaReorderGrid`, `createProposalMediaRouter`, `importFromProposal` — used consistently. Proposal router at `proposalsRouter.media`; client at `trpc.proposalsRouter.media.*`.

**Risk controls:** every live-path change (B1, B2, D2) is gated by the Project-Media Regression Checklist; the `media_files` schema refactor is proven a no-op via `db:push:dev --dry-run`; D2 carries an explicit split-to-Plan-1c safety valve.

**Implementer confirmations (inline):** the `entity` param type (copy from `contracts.router.ts`); the generic-table typing in the setters (contain the `as any`); `useInvalidation` surface; shadcn import paths; how `scope-of-work.tsx` reaches the proposal object; client-side `node:path` avoidance.
