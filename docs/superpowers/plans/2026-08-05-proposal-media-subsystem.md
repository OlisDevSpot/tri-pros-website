# Generalized Media/File Service + Proposal Media — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the project-only `media_files` infrastructure into a **general-purpose file/media management capability** — a shared **service** (`src/shared/services/media/`) plus a shared **UI area** (`src/shared/components/media/`) — reusable from any call-site (projects, proposals, and future features). Then build proposal media (attachments + `internal|homeowner` visibility, homeowner gallery, copy-to-project) as the second consumer, and migrate the existing project path onto the shared capability.

**Architecture — "media is a service, two owners today":**
- **Service layer** (`src/shared/services/media/`): owner-parameterized file operations (upload target, create+optimize dispatch, delete+R2 cleanup, reorder, rename, list, copy) driven by a `MediaStore` config. The optimizer core + job + owner registry live here. Routers are **thin callers**; nothing about file management is projects-only.
- **Two tables** (`media_files`, `proposal_media_files`) share `baseMediaColumns`; each keeps its owner FK + taxonomy. `baseMediaColumns` is **provider-aware** (`provider` `'r2'|'stream'` + nullable `pathKey`/`bucket` + `externalId`) so a row can be an R2 object *or* a Cloudflare Stream video. Plan 1 writes only `'r2'`; **Plan 1b** implements the `'stream'` provider (video), the strategy registry (pdf raster + video readiness), and the shared XHR-progress upload transport.
- **UI layer** (`src/shared/components/media/`): a generalized, dependency-injected `<MediaManager>` + primitives (`MediaCard`, `MediaReorderGrid`, `MediaUploadButton`, `PhotoDetailDialog`). Owner call-sites in `features/` configure it (project: phase/hero/Drive; proposal: visibility). The `src/shared/components/portfolio/*` media components are **removed**.
- **Import direction (hard rule):** `src/shared/**` (service + UI) NEVER imports from `src/features/**`. Call-sites in `features/` and routers in `src/trpc/` import *into* shared. The generalized `<MediaManager>` receives all data + actions as props (DI) — it imports no router and no feature.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), Zod, TanStack Query, `@aws-sdk/client-s3` (R2), `sharp`, `pdf-lib`, Upstash QStash, dnd-kit, Tailwind v4, shadcn/ui.

## Global Constraints

- **Verification model (NO unit-test runner):** each task closes with `pnpm tsc` (no errors) + `pnpm lint` (clean) + the stated manual/DB/Playwright check. No vitest/jest/pytest exists. Never `pnpm build`.
- **Import direction:** `src/shared/**` must not `import … from '@/features/…'` (verify with `grep -rn "from '@/features" src/shared/services/media src/shared/components/media` → must be empty). Routers (`src/trpc`) and feature call-sites may import shared.
- **Regression discipline:** the project media path is LIVE. Every task touching it (`media_files` schema, project `media.router`, the relocated/generalized UI) ends with the **Project-Media Regression Checklist** (end of plan) passing.
- **DB pushes:** `pnpm db:push:dev` only; no-op refactors verified with `pnpm db:push:dev --dry-run` → "No changes".
- **Git:** work on `main`, stage by explicit path. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **IDs:** both media tables use `serial` PK → id inputs are `z.number()`; owner ids are `uuid`.
- **Buckets:** project → `R2_BUCKETS.portfolioProjects` (public CDN); proposal → `R2_BUCKETS.homeownerFiles` (private, presigned only, path `proposals/{proposalId}/{uuid}{ext}`). Proposal media has NO `url` column; access is presigned only; visibility default `internal`; **lock-exempt** (no `isProposalFrozen` gate).
- **Conventions:** one component per file, named exports, `motion/react`, RHF+Zod for forms, entity co-location, `memory/coding-conventions.md`.

---

## File Structure

**Create — shared SERVICE (`src/shared/services/media/`):**
- `stores.ts` — `MediaStore` type + `projectMediaStore` / `proposalMediaStore` (+ `MediaOwnerKind`).
- `optimization-target.ts` — owner registry (getFile per ownerKind) for optimization.
- `optimize-media.ts` — generic `optimizeMediaFile({ ownerKind, mediaId })`.
- `media.service.ts` — `mediaService`: `buildUploadTarget`, `createRecord`, `removeRecord`, `reorder`, `rename`, `list`, `copyObject` (R2), all owner-parameterized by `MediaStore`.

**Create — shared optimizer core (`src/shared/lib/file-optimization/`):**
- `types.ts`, `strategies/pdf.ts`, `optimize-file.ts`, `DOCS.md`.

**Create — shared generic setters:**
- `src/shared/entities/media-files/dal/server/optimization.ts` — table-parameterized status setters.

**Create — shared generalized UI (`src/shared/components/media/`):**
- `media-manager.tsx` (DI `<MediaManager>`), `media-card.tsx`, `media-reorder-grid.tsx`, `media-upload-button.tsx` (from upload-source-popover), `photo-detail-dialog.tsx` (relocated), `types.ts` (`MediaItem`, `MediaGroup`, `MediaManagerProps`).
- `src/shared/hooks/use-media-upload.ts` — **generalized** (config-injected mutations).

**Create — proposal owner:**
- `src/shared/db/schema/lib/media-columns.ts`, `src/shared/db/schema/proposal-media-files.ts`
- `src/shared/entities/proposal-media-files/dal/server/queries.ts` (+ `lib/resolve-media-url.ts`), `dal/server/authz.ts` (scope assert)
- `src/trpc/routers/proposals.router/media.router.ts`
- `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` (thin call-site config)
- `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts`
- `src/features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx`
- `src/features/project-management/ui/components/form/project-media-manager.tsx` (thin call-site config — replaces the portfolio manager)
- `src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx`

**Modify:**
- `src/shared/services/providers/r2/client.ts` (add `copyObject`); `src/shared/db/schema/media-files.ts` (spread base cols); `src/shared/db/schema/index.ts`.
- `src/trpc/routers/projects.router/media.router.ts` (thin caller of `mediaService`); `src/app/api/qstash-jobs/route.ts` (register `optimize-media`, drop `optimize-image`).
- `src/trpc/routers/proposals.router/index.ts` (mount `media`); `src/shared/entities/proposals/dal/server/queries.ts` (getFullView media).
- `src/features/project-management/ui/components/form/photos-tab-content.tsx` (use new `ProjectMediaManager`).
- `src/features/proposal-flow/ui/components/form/index.tsx`, `views/edit-proposal-view.tsx` (Files tab).
- `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx` (gallery).
- DOCS: `proposals/DOCS.md`, `meetings/DOCS.md`, `projects/DOCS.md`, `file-optimization/DOCS.md`, and a new `src/shared/services/media/DOCS.md`.

**Delete (after relocation):** `src/shared/components/portfolio/{sortable-media-manager,sortable-photo-card,upload-source-popover,photo-detail-dialog}.tsx`, `src/shared/services/providers/upstash/jobs/optimize-image.ts`, and (if unused) `src/shared/services/media.service.ts` (old project-only optimize wrapper).

---

# PHASE A — Shared media service + optimizer foundation (greenfield)

## Task A1: `baseMediaColumns` + `proposal_media_files`

**Files:** Create `src/shared/db/schema/lib/media-columns.ts`, `src/shared/db/schema/proposal-media-files.ts`; Modify `src/shared/db/schema/index.ts`

- [ ] **Step 1:** `baseMediaColumns` (the columns both media tables share). **Provider-aware from day one** (folded in from Plan 1b): a media row is no longer assumed to be an R2 object — it may live in Cloudflare Stream. Plan 1 only ever writes `provider = 'r2'`; Plan 1b implements the `'stream'` path. Because `media_files` is live and R2-only today, applying this base in Task B1 is a **small, safe migration** (adds `provider`/`external_id`, relaxes `path_key`/`bucket` to nullable) — not the no-op it would otherwise be. See Task B1 for the exact expected diff.

```ts
// src/shared/db/schema/lib/media-columns.ts
import { integer, jsonb, text, varchar } from 'drizzle-orm/pg-core'
import { createdAt, updatedAt } from './schema-helpers'

/** Where a media file's canonical asset lives. */
export const mediaProviders = ['r2', 'stream'] as const
export type MediaProvider = (typeof mediaProviders)[number]

export const baseMediaColumns = {
  name: varchar('name', { length: 80 }).notNull(),
  // Storage provider. 'r2' = object in an R2 bucket (pathKey + bucket populated).
  // 'stream' = Cloudflare Stream asset (externalId populated; pathKey/bucket null).
  // Plan 1 produces ONLY 'r2'; Plan 1b adds the 'stream' path for video.
  provider: text('provider', { enum: mediaProviders }).notNull().default('r2'),
  // R2 coordinates — nullable because a 'stream' row has no R2 object.
  // (unique() on a nullable column is fine — Postgres permits multiple NULLs.)
  pathKey: text('path_key').unique(),
  bucket: text('bucket'),
  // Provider asset id for non-R2 providers (Cloudflare Stream UID). Null for 'r2'.
  externalId: text('external_id'),
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

- [ ] **Step 2:** `proposal_media_files` table (spreads base; adds owner FK + `visibility` + `pageCount` + `thumbnailPathKey`). Exactly as specified previously — reproduced:

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

/** Proposal-owned files; private bucket, presigned-only access (no `url` column); lock-exempt. */
export const proposalMediaFiles = pgTable('proposal_media_files', {
  id: unsafeId,
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  ...baseMediaColumns,
  visibility: text('visibility', { enum: proposalMediaVisibilities }).notNull().default('internal'),
  pageCount: integer('page_count'),
  thumbnailPathKey: text('thumbnail_path_key'),
})

export const proposalMediaFilesRelations = relations(proposalMediaFiles, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalMediaFiles.proposalId], references: [proposals.id] }),
}))

export const selectProposalMediaFileSchema = createSelectSchema(proposalMediaFiles)
export type ProposalMediaFile = z.infer<typeof selectProposalMediaFileSchema>

export const insertProposalMediaFileSchema = selectProposalMediaFileSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial({ visibility: true, sortOrder: true, duration: true, pageCount: true, thumbnailPathKey: true, optimizationStatus: true, optimizationVariants: true, blurDataUrl: true, provider: true, externalId: true })
export type InsertProposalMediaFile = z.infer<typeof insertProposalMediaFileSchema>
```

- [ ] **Step 3:** Register `export * from './proposal-media-files'` in the barrel (after `proposal-incentives`).
- [ ] **Step 4:** `pnpm tsc` → clean; `pnpm db:push:dev` → creates table; `pnpm db:push:dev --dry-run` → "No changes".
- [ ] **Step 5:** `pnpm lint`; commit (`feat(media): baseMediaColumns + proposal_media_files table`).

## Task A2: R2 `copyObject`
Add `CopyObjectCommand` import + `r2Client.copyObject({ sourceBucket, sourceKey, destBucket, destKey })` (as previously specified). `pnpm tsc && pnpm lint`; commit (`feat(r2): cross-bucket copyObject`).

## Task A3–A4: optimizer types + core
Create `src/shared/lib/file-optimization/types.ts` (`FileKind`, `classifyFileKind`, `FileOptimizationResult`), `strategies/pdf.ts` (`readPdfPageCount` via pdf-lib), and `optimize-file.ts` (image → sharp variants+blur; pdf → pageCount; video/other → skipped, with `// PLAN 1b:` markers for transcode + raster). Exactly as previously specified. `pnpm tsc && pnpm lint`; commit (`feat(file-optimization): shared optimizeFile core (image+pdf)`).

## Task A5: table-parameterized optimization setters
Create `src/shared/entities/media-files/dal/server/optimization.ts` — `setMediaOptimizationProcessing/Complete/Failed(table, id, …)` operating on any base-media table (contained `as any` on the update target; write `pageCount` only when `table.pageCount` exists). As previously specified. `pnpm tsc && pnpm lint`; commit.

## Task A6: media stores + optimize registry + generic optimize + job

**Files:** Create `src/shared/services/media/stores.ts`, `optimization-target.ts`, `optimize-media.ts`, `src/shared/services/providers/upstash/jobs/optimize-media.ts`; Modify `src/app/api/qstash-jobs/route.ts`

- [ ] **Step 1:** The `MediaStore` config (this is the seam that makes media owner-agnostic):

```ts
// src/shared/services/media/stores.ts
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { mediaFiles } from '@/shared/db/schema/media-files'
import { proposalMediaFiles } from '@/shared/db/schema/proposal-media-files'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

export type MediaOwnerKind = 'project' | 'proposal'

export interface MediaStore {
  ownerKind: MediaOwnerKind
  table: any // one of the base-media tables; contained generic
  ownerColumn: any // table.projectId | table.proposalId
  bucket: R2BucketName
  /** builds the R2 object key for a new upload */
  buildPathKey: (ownerId: string, fileId: string, ext: string, extra?: Record<string, string>) => string
}

export const projectMediaStore: MediaStore = {
  ownerKind: 'project',
  table: mediaFiles,
  ownerColumn: mediaFiles.projectId,
  bucket: R2_BUCKETS.portfolioProjects,
  buildPathKey: (ownerId, fileId, ext, extra) => `projects/${ownerId}/${extra?.phase ?? 'uncategorized'}/${fileId}${ext}`,
}

export const proposalMediaStore: MediaStore = {
  ownerKind: 'proposal',
  table: proposalMediaFiles,
  ownerColumn: proposalMediaFiles.proposalId,
  bucket: R2_BUCKETS.homeownerFiles,
  buildPathKey: (ownerId, fileId, ext) => `proposals/${ownerId}/${fileId}${ext}`,
}
```

- [ ] **Step 2:** `optimization-target.ts` — resolves `ownerKind → { table, getFile }` (uses the stores). `optimize-media.ts` — `optimizeMediaFile({ ownerKind, mediaId })` (idempotent; calls `optimizeFile` + generic setters). `optimize-media` job (`createJob<{ownerKind,mediaId}>('optimize-media', …)`). Register in qstash route; keep `optimize-image` for now (removed in B2). As previously specified.
- [ ] **Step 3:** `pnpm tsc && pnpm lint`; commit (`feat(media): stores + generic optimize + optimize-media job`).

## Task A7: `mediaService` (the file-management service)

**Files:** Create `src/shared/services/media/media.service.ts`

**Interfaces (this is the service every call-site uses):**
```
mediaService.buildUploadTarget(store, { ownerId, filename, mimeType, extra? }): Promise<{ uploadUrl, pathKey, bucket }>
mediaService.createRecord(store, values): Promise<row>            // inserts + dispatches optimize for image/pdf
mediaService.removeRecord(store, id): Promise<void>              // R2 deleteMediaWithVariants + db delete
mediaService.reorder(store, updates: {id,sortOrder}[]): Promise<void>
mediaService.rename(store, id, name): Promise<void>
mediaService.list(store, ownerId): Promise<row[]>
```

- [ ] **Step 1:** Implement, importing ONLY shared (`db`, stores, `r2Client`, `optimizeMediaJob`) — no features:

```ts
// src/shared/services/media/media.service.ts
import type { MediaStore } from './stores'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { r2Client } from '@/shared/services/providers/r2/client'
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'

function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot).toLowerCase() : ''
}

export const mediaService = {
  async buildUploadTarget(store: MediaStore, input: { ownerId: string, filename: string, mimeType: string, extra?: Record<string, string> }) {
    const pathKey = store.buildPathKey(input.ownerId, crypto.randomUUID(), extOf(input.filename), input.extra)
    const uploadUrl = await r2Client.getPresignedUploadUrl({ bucket: store.bucket, pathKey, mimeType: input.mimeType })
    return { uploadUrl, pathKey, bucket: store.bucket }
  },

  async createRecord<T extends Record<string, unknown>>(store: MediaStore, values: T) {
    const [created] = await db.insert(store.table).values(values as any).returning()
    if (typeof created.mimeType === 'string' && (created.mimeType.startsWith('image/') || created.mimeType === 'application/pdf'))
      void optimizeMediaJob.dispatch({ ownerKind: store.ownerKind, mediaId: created.id })
    return created
  },

  async removeRecord(store: MediaStore, id: number) {
    const [row] = await db.select().from(store.table).where(eq(store.table.id, id))
    if (!row)
      return
    await r2Client.deleteMediaWithVariants(row.bucket, row.pathKey)
    await db.delete(store.table).where(eq(store.table.id, id))
  },

  async reorder(store: MediaStore, updates: { id: number, sortOrder: number }[]) {
    if (updates.length === 0)
      return
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of updates)
        await tx.update(store.table).set({ sortOrder }).where(eq(store.table.id, id))
    })
  },

  async rename(store: MediaStore, id: number, name: string) {
    await db.update(store.table).set({ name }).where(eq(store.table.id, id))
  },

  async list(store: MediaStore, ownerId: string) {
    return db.select().from(store.table).where(eq(store.ownerColumn, ownerId)).orderBy(asc(store.table.sortOrder))
  },
}
```

> Implementer note: the `any`/generic-table casts are contained to this one service (the same pragmatic pattern as the optimization setters). Callers pass the correct owner-specific `values` shape; per-owner authorization happens in the caller BEFORE invoking (see C2). This keeps `mediaService` a pure, feature-free, reusable file service.
>
> Provider scope (Plan 1): `buildUploadTarget`, `createRecord`, and `removeRecord` handle the **`'r2'` provider only** — presigned PUT, insert-with-`provider:'r2'` (the column default), and R2 `deleteMediaWithVariants`. **Plan 1b extends these to branch on file kind / `store`** for the `'stream'` provider (Cloudflare Stream direct-upload target, Stream-UID record, Stream asset delete). Do not build the Stream branch here; just don't foreclose it — keep the provider off the column default so `'r2'` inserts need no change.

- [ ] **Step 2:** `pnpm tsc && pnpm lint`; commit (`feat(media): mediaService — owner-parameterized file operations`).
- [ ] **Step 3:** Verify import direction: `grep -rn "from '@/features" src/shared/services/media` → empty.

---

# PHASE B — Migrate the project path onto the service (regression-gated)

## Task B1: `media_files` spreads `baseMediaColumns` (small provider migration)
Rewrite `media_files` to `{ id: unsafeId, ...baseMediaColumns, url, tags, isHeroImage, phase, thumbnailUrl, projectId }` keeping app-facing schemas/relations unchanged. Because `baseMediaColumns` is now provider-aware, this is a **small, safe migration** — NOT a no-op:

- **Adds** `provider` (`notNull default 'r2'` — existing rows backfill to `'r2'`) and `external_id` (nullable, stays NULL for all existing rows).
- **Relaxes** `path_key` and `bucket` from `NOT NULL` → nullable (existing rows keep their values; no data touched).

`pnpm db:push:dev --dry-run` → verify the diff shows **exactly** those three changes (add `provider`, add `external_id`, drop-not-null on `path_key`/`bucket`) and **no drops/renames/data loss**. If the diff shows anything else, the base-column extraction diverged from the live shape — stop and reconcile. Then `pnpm db:push:dev`. `pnpm tsc && pnpm lint`; commit.

## Task B2: project `media.router` becomes a thin `mediaService` caller

**Files:** Modify `src/trpc/routers/projects.router/media.router.ts`; delete `optimize-image.ts`; modify `qstash-jobs/route.ts`; remove old `media.service.ts` if unused.

- [ ] **Step 1:** Rewrite each project media procedure to delegate to `mediaService` with `projectMediaStore`, preserving project-specific behavior (phase in the path via `extra`, hero toggle stays project-specific, Google Drive stays). Example — `getUploadUrl`, `create`, `delete`, `reorder`, `rename`:

```ts
getUploadUrl: agentProcedure
  .input(z.object({ projectId: z.string().uuid(), phase: z.enum(mediaPhases), filename: z.string(), mimeType: z.string() }))
  .mutation(async ({ input }) => {
    const { uploadUrl, pathKey, bucket } = await mediaService.buildUploadTarget(projectMediaStore, {
      ownerId: input.projectId, filename: input.filename, mimeType: input.mimeType, extra: { phase: input.phase },
    })
    const publicUrl = `${R2_PUBLIC_DOMAINS[bucket] ?? ''}/${pathKey}`
    return { uploadUrl, pathKey, publicUrl }
  }),

create: agentProcedure
  .input(insertMediaFilesSchema.omit({ bucket: true }).extend({ bucket: z.string().optional() }))
  .mutation(async ({ input }) => mediaService.createRecord(projectMediaStore, { ...input, bucket: input.bucket ?? projectMediaStore.bucket })),

delete: agentProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => { await mediaService.removeRecord(projectMediaStore, input.id) }),
reorder: agentProcedure.input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) })).mutation(async ({ input }) => { await mediaService.reorder(projectMediaStore, input.updates) }),
rename: agentProcedure.input(z.object({ id: z.number(), name: z.string().min(1).max(80) })).mutation(async ({ input }) => { await mediaService.rename(projectMediaStore, input.id, input.name) }),
```

Keep `movePhase`, `bulkDelete`, `toggleHero`, `retryOptimization` — but route their optimize dispatch + R2 delete through `mediaService`/`optimizeMediaJob` (e.g. `retryOptimization` → `resetOptimizationStatus` + `optimizeMediaJob.dispatch({ ownerKind: 'project', mediaId })`; `bulkDelete` → loop `mediaService.removeRecord`).

- [ ] **Step 2:** Delete `optimize-image.ts` + its registration; repoint/remove `mediaService` (old) references (`grep -rn "optimizeImageJob\|optimize-image\|services/media.service" src`).
- [ ] **Step 3:** `pnpm tsc && pnpm lint`.
- [ ] **Step 4: Project-Media Regression Checklist** — MUST pass.
- [ ] **Step 5:** Commit (`refactor(projects): project media routes through mediaService; retire optimize-image`).

---

# PHASE C — Proposal owner (DAL + thin router via service) + read enrichment

## Task C1: proposal presign resolver + read views + scope assert
Create `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts` (best-variant-or-original presign), `dal/server/queries.ts` (`getProposalMediaFileById`, `listHomeownerProposalMedia`, `ProposalMediaView` + `toProposalMediaView`), and `dal/server/authz.ts` (`assertProposalInScope(ctx, proposalId)`, `assertProposalMediaInScope(ctx, id)`) — exactly as previously specified (reads/presign) with the scope helpers extracted for router use. `pnpm tsc && pnpm lint`; commit.

## Task C2: proposal `media` sub-router (auth+scope in router; mechanics via `mediaService`)

**Files:** Create `src/trpc/routers/proposals.router/media.router.ts`; Modify `src/trpc/routers/proposals.router/index.ts`

- [ ] **Step 1:** Thin router: CASL guard + scope assert (from C1), then delegate mechanics to `mediaService` with `proposalMediaStore`. `list` maps rows through `toProposalMediaView` (presigned). Lock-exempt (no `isProposalFrozen`).

```ts
getUploadUrl: entity.authedProcedure
  .input(z.object({ proposalId: z.string().uuid(), filename: z.string(), mimeType: z.string() }))
  .mutation(async ({ ctx, input }) => {
    assertCanUpdate(ctx); await assertProposalInScope(ctx, input.proposalId)
    return mediaService.buildUploadTarget(proposalMediaStore, { ownerId: input.proposalId, filename: input.filename, mimeType: input.mimeType })
  }),

create: entity.authedProcedure
  .input(z.object({ proposalId: z.string().uuid(), name: z.string().min(1).max(80), pathKey: z.string(), bucket: z.string(), mimeType: z.string(), fileExtension: z.string(), duration: z.number().int().optional() }))
  .mutation(async ({ ctx, input }) => {
    assertCanUpdate(ctx); await assertProposalInScope(ctx, input.proposalId)
    return mediaService.createRecord(proposalMediaStore, input)
  }),

list: entity.authedProcedure.input(z.object({ proposalId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    assertCanUpdate(ctx); await assertProposalInScope(ctx, input.proposalId)
    const rows = await mediaService.list(proposalMediaStore, input.proposalId)
    return Promise.all(rows.map(toProposalMediaView))
  }),

setVisibility: entity.authedProcedure.input(z.object({ id: z.number(), visibility: z.enum(proposalMediaVisibilities) }))
  .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); await assertProposalMediaInScope(ctx, input.id); await db.update(proposalMediaFiles).set({ visibility: input.visibility }).where(eq(proposalMediaFiles.id, input.id)) }),

reorder: entity.authedProcedure.input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number().int() })) }))
  .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); if (input.updates[0]) await assertProposalMediaInScope(ctx, input.updates[0].id); await mediaService.reorder(proposalMediaStore, input.updates) }),

rename: entity.authedProcedure.input(z.object({ id: z.number(), name: z.string().min(1).max(80) }))
  .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); await assertProposalMediaInScope(ctx, input.id); await mediaService.rename(proposalMediaStore, input.id, input.name) }),

delete: entity.authedProcedure.input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => { assertCanUpdate(ctx); await assertProposalMediaInScope(ctx, input.id); await mediaService.removeRecord(proposalMediaStore, input.id) }),
```

`assertCanUpdate(ctx)` = throw FORBIDDEN unless `ctx.ability?.cannot('update','Proposal')` is false. `setVisibility` writes `visibility` directly (owner-specific column, not in the generic service). Copy the `entity` param type from `contracts.router.ts`.

- [ ] **Step 2:** Mount `media: createProposalMediaRouter(entity)` in `proposals.router/index.ts`.
- [ ] **Step 3:** `pnpm tsc && pnpm lint`; commit (`feat(proposals): proposalMedia sub-router via mediaService (scoped, lock-exempt)`).

## Task C3: `getFullView` homeowner-media enrichment
Add `media: ProposalMediaView[]` to `ProposalWithCustomer`; before the final return, `listHomeownerProposalMedia(row.id)` → `toProposalMediaView`, attach (homeowner-only, always). As previously specified. `pnpm tsc && pnpm lint`; commit.

---

# PHASE D — Generalized media UI area + owner call-sites (regression-gated)

## Task D1: Build the generalized `src/shared/components/media/` area

**Files:** Create `src/shared/components/media/{types.ts,media-card.tsx,media-reorder-grid.tsx,media-upload-button.tsx,photo-detail-dialog.tsx,media-manager.tsx}`; Modify `src/shared/hooks/use-media-upload.ts`

**Interfaces (DI — no router/feature imports):**
```ts
// src/shared/components/media/types.ts
import type { ReactNode } from 'react'
export interface MediaItem { id: number, name: string, mimeType: string, url: string, blurDataUrl?: string | null, optimizationStatus?: string, sortOrder?: number }
export interface MediaGroup { key: string, label: string, items: MediaItem[] }
export interface MediaManagerProps {
  groups: MediaGroup[]
  accept: string
  isUploading: boolean
  onUpload: (files: File[]) => void
  onReorder: (groupKey: string, updates: { id: number, sortOrder: number }[]) => void
  onDelete: (id: number) => void
  onRename: (id: number, name: string) => void
  /** owner-specific per-item controls (hero/phase for project; visibility for proposal) */
  renderItemControls?: (item: MediaItem) => ReactNode
  /** optional extra upload source (project: Google Drive) */
  onGoogleDriveUpload?: () => void
  isPickerLoading?: boolean
  emptyLabel?: string
}
```

- [ ] **Step 1:** Move `upload-source-popover.tsx` → `media/media-upload-button.tsx` (already generic; rename export if desired). Move `photo-detail-dialog.tsx` → `media/photo-detail-dialog.tsx`.
- [ ] **Step 2:** `media-reorder-grid.tsx` — extract the dnd-kit scaffolding (sensors, `closestCenter`, `rectSortingStrategy`, `AUTO_SCROLL_CONFIG`, `arrayMove`) from the old manager into `<MediaReorderGrid items onReorder renderItem />`.
- [ ] **Step 3:** `media-card.tsx` — generic card: image (`OptimizedImage`)/video/pdf thumb, select checkbox, drag handle, debounced name input (calls `onRename`), delete, a `controls` slot for owner actions, and "View details" (`PhotoDetailDialog`). No `phase`/`isHeroImage`/router imports — those come via `renderItemControls`.
- [ ] **Step 4:** `media-manager.tsx` — `<MediaManager>` renders an upload button (`MediaUploadButton` when `onGoogleDriveUpload` provided, else a plain button) + one `MediaReorderGrid` per group, each item a `MediaCard` with `renderItemControls`. Fully DI.
- [ ] **Step 5:** Generalize `use-media-upload.ts` to accept injected `{ getUploadUrl, createMedia, buildCreatePayload }` mutations so both owners share the getUploadUrl→PUT→create flow.
- [ ] **Step 6:** `pnpm tsc && pnpm lint`; commit (`feat(media): generalized MediaManager UI area (DI)`).

## Task D2: Project call-site on the shared manager; delete `portfolio/*` (regression-gated)

**Files:** Create `src/features/project-management/ui/components/form/project-media-manager.tsx`; Modify `photos-tab-content.tsx`; Delete `src/shared/components/portfolio/{sortable-media-manager,sortable-photo-card,upload-source-popover,photo-detail-dialog}.tsx`

- [ ] **Step 1:** `ProjectMediaManager({ projectId, mediaFiles, onUpdate })` (features) builds phase-grouped `MediaGroup[]` from `mediaFiles`, wires `onUpload`/`onReorder`(optimistic against `getForEdit`)/`onDelete`/`onRename` to `trpc.projectsRouter.media.*`, and passes `renderItemControls` = hero star + phase "Move to" menu + selection (project-specific), plus `onGoogleDriveUpload`. Renders `<MediaManager .../>`.
- [ ] **Step 2:** Point `photos-tab-content.tsx` at `ProjectMediaManager` (replacing the portfolio import). Delete the four `portfolio/*` files. `grep -rn "components/portfolio" src` → empty.
- [ ] **Step 3:** `pnpm tsc && pnpm lint`.
- [ ] **Step 4: Project-Media Regression Checklist** — MUST pass (upload/optimize/reorder/hero/phase/rename/delete/retry/polling).
- [ ] **Step 5:** Commit (`refactor(projects): project media on generalized MediaManager; remove portfolio components`).

> Safety valve: if fully porting project features (bulk move/delete, Drive) onto the shared manager risks the regression checklist in one pass, land the shared manager + proposal consumer first and split the project migration to **Plan 1c** (leave `portfolio/*` temporarily, tracked for removal). Flag to the reviewer — do not force a risky big-bang.

## Task D3: Proposal call-site + Files tab

**Files:** Create `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`, `dal/client/mutations/use-proposal-media.ts`; Modify `form/index.tsx`, `views/edit-proposal-view.tsx`

- [ ] **Step 1:** Client mutation hooks (thin wrappers over `trpc.proposalsRouter.media.*`, invalidate the `list` query) + a proposal-bound `useMediaUpload` config.
- [ ] **Step 2:** `ProposalMediaManager({ proposalId })` (features): query `proposalsRouter.media.list`; build two `MediaGroup`s ("Shown to homeowner" / "Internal only") by `visibility`; wire `onUpload` (accept `image/*,video/*,application/pdf`), `onReorder`, `onDelete`, `onRename`; `renderItemControls` = a visibility `Switch` (calls `setVisibility`). Render `<MediaManager .../>`. No Google Drive. Not RHF-registered; lock-exempt.
- [ ] **Step 3:** Add `'files'` tab to `FORM_TABS` + label; thread `proposalId` into `ProposalForm`; render `ProposalMediaManager` (or a "save first" hint when no id). Do not disable it under the form lock.
- [ ] **Step 4:** `pnpm tsc && pnpm lint`.
- [ ] **Step 5: Manual verification:** upload JPG+MP4+PDF (Internal); toggle JPG→Homeowner; reorder; DB rows + JPG optimized/variants + PDF page_count; delete MP4; works on a locked test proposal.
- [ ] **Step 6:** Commit (`feat(proposals): Files tab + ProposalMediaManager on shared MediaManager`).

---

# PHASE E — Homeowner gallery, copy-to-project (via service), docs

## Task E1: Homeowner gallery above first SOW
Create `proposal-media-gallery.tsx` (images/videos inline + public PDFs as downloads; renders null when empty); mount above the first SOW accordion in `scope-of-work.tsx` reading `proposal.data.media ?? []`. As previously specified. `pnpm tsc && pnpm lint`; manual token-URL verification; commit.

## Task E2: Copy photos from a proposal into a project (via `mediaService` + R2 copy)

**Files:** Modify `src/trpc/routers/projects.router/media.router.ts`; Create `import-from-proposal-dialog.tsx`; Modify `project-media-manager.tsx`

- [ ] **Step 1:** `listImportableProposalMedia({ projectId })` query — image-only proposal files on the project's meeting (`innerJoin meetings on meetings.projectId = projectId`), grouped by proposal, presigned via `resolveProposalMediaUrl`.
- [ ] **Step 2:** `importFromProposal({ projectId, proposalMediaFileIds })` — for each selected image: `r2Client.copyObject` (homeownerFiles → portfolioProjects, dest `projects/{projectId}/uncategorized/{uuid}{ext}`), then `mediaService.createRecord(projectMediaStore, { name, pathKey: destKey, bucket, mimeType, fileExtension, url: publicUrl, projectId, phase: 'uncategorized' })` (which dispatches optimize). Return `{ imported }`.
- [ ] **Step 3:** `ImportFromProposalDialog` (multi-select + "Select all") wired into `ProjectMediaManager`'s header (`onImported={onUpdate}`). As previously specified.
- [ ] **Step 4:** `pnpm tsc && pnpm lint`; manual end-to-end import verification; commit.

## Task E3: Docs + stale conversion-trigger fix
Update `proposals/DOCS.md` (proposal-media-visibility, copy-to-project), fix `#conversion-trigger` + cross-refs in `meetings/DOCS.md`/`projects/DOCS.md`; create `file-optimization/DOCS.md` and `src/shared/services/media/DOCS.md` (the `mediaService` + `MediaStore` contract, "media is a reusable service — invoke from any router with a store; never projects-only"). `pnpm lint`; commit.

---

## Project-Media Regression Checklist (run wherever referenced)

`pnpm dev`, on a real portfolio project's Photos tab: (1) upload JPG → `optimization_status` pending→processing→optimized, variants + blur set; (2) drag-reorder persists after refetch; (3) hero toggle sets hero + clears prior hero in the project; (4) move phase moves the item; (5) debounced rename persists; (6) delete removes row + R2 object + variants; (7) retry-optimization re-dispatches; (8) edit-view optimization polling clears when optimized. Any deviation = the generalization broke the incumbent — fix before proceeding.

---

## Self-Review

**Spec + directive coverage:**
- Media as a **service** invokable from many call-sites (`mediaService` + `MediaStore`; project + proposal routers are thin callers) → A6–A7, B2, C2, E2 ✅
- Generalized **UI area** in `src/shared/components/media/`; `portfolio/*` removed → D1–D2 ✅
- **Import direction** enforced (shared media = DI, no `@/features` imports; verified by grep) → constraints + A7/D1 ✅
- Shared base columns / no DB diff → A1, B1 ✅; shared optimizer core + generic setters + one job + registry → A3–A6 ✅
- Project path migrated onto service + engine (regression-gated) → B2, D2 ✅
- `r2Client.copyObject` → A2 ✅; proposal table (presigned-only, visibility, lock-exempt) → A1 ✅
- Proposal DAL/presign/scope + thin router via service → C1–C2 ✅; getFullView homeowner-only media → C3 ✅
- Reorder for both owners (shared grid) → D1–D3 ✅; Files tab → D3 ✅; homeowner gallery → E1 ✅; copy-to-project via service → E2 ✅; docs + stale-fix → E3 ✅

**Plan 1b (committed):** video transcode + poster (infra decision) + PDF first-page raster — land in the shared `optimizeFile`/strategies (markers in A4), so both owners benefit. Written next.

**Type consistency:** `baseMediaColumns`, `MediaStore`/`projectMediaStore`/`proposalMediaStore`, `mediaService`, `optimizeFile`, `optimizeMediaFile`, `optimizeMediaJob`, `ProposalMediaFile`/`ProposalMediaView`, `resolveProposalMediaUrl`, `MediaItem`/`MediaGroup`/`MediaManagerProps`, `MediaManager`/`MediaCard`/`MediaReorderGrid`, `createProposalMediaRouter`, `importFromProposal` — consistent. Proposal router at `proposalsRouter.media`.

**Risk controls:** live-path changes (B1/B2/D2) gated by the regression checklist; `media_files` refactor proven no-op via dry-run; D2 carries a split-to-Plan-1c valve; `mediaService`/`MediaManager` verified free of `@/features` imports.

**Implementer confirmations (inline):** `entity` param type (copy from `contracts.router.ts`); contained generic-table `as any` in `mediaService`/setters; `useInvalidation`/`OptimizedImage`/`useConfirm`/shadcn import paths; how `scope-of-work.tsx` reaches the proposal object.
