# Media Service — Business Rules

**Media is a reusable service, not a projects-only feature.** Any owning entity (currently
`project`s and `proposal`s) attaches files by pairing this service with a `MediaStore` — the
service itself never hard-codes a table, bucket, or "projects" assumption. Adding a new media
owner (e.g. a future entity) means adding a store + a small DAL, and reusing the service + the
shared UI unchanged.

This directory holds the owner-agnostic file-operation core (`media.service.ts`), the owner
seam (`stores.ts`), and the optimize dispatch glue (`optimize-media.ts`,
`optimization-target.ts`). See `src/shared/lib/file-optimization/DOCS.md` for the pure
optimizer core this dispatches into, and `src/shared/entities/proposals/DOCS.md#proposal-media`
+ `src/shared/entities/projects/DOCS.md` for the two current consumers' entity-level rules.

## Rules

### media-service-is-owner-parameterized

`mediaService` (`media.service.ts`) exposes file operations — `buildUploadTarget`, `createRecord`,
`removeRecord`, `reorder`, `rename`, `list` — each taking a `MediaStore` as its first argument.
None of these functions reference a specific table, bucket, or owner concept directly; every
owner-specific decision (which table, which bucket, how to build the R2 path key) is read off
the passed-in store. A router for a new media owner calls these same functions with its own
store — it never needs a parallel implementation.

**Why**: the project media manager and the proposal Files tab are functionally identical file
CRUD with different storage/visibility rules. Parameterizing on the store means one implementation
serves both, and a third owner is a store + DAL away, not a service rewrite.
**Reference impl**: `media.service.ts`
**Enforced by**: convention — the service's public functions all take `store` as the first param; there is no owner-specific branch inside them

### media-store-is-the-owner-seam

`MediaStore` (`stores.ts`) is the single interface an owner must implement:

```ts
interface MediaStore {
  ownerKind: MediaOwnerKind        // 'project' | 'proposal'
  table: any                        // the owner's base-media Drizzle table
  ownerColumn: any                  // table.projectId | table.proposalId
  bucket: R2BucketName
  buildPathKey: (ownerId, fileId, ext, extra?) => string
}
```

Two stores exist today:

| Store | Owner table | Bucket | Path shape |
|---|---|---|---|
| `projectMediaStore` | `media_files` | `tpr-portfolio-projects` (public) | `projects/{projectId}/{phase}/{fileId}{ext}` |
| `proposalMediaStore` | `proposal_media_files` | `tpr-homeowner-files` (private) | `proposals/{proposalId}/{fileId}{ext}` |

**Why**: the owner-specific facts (which table, which bucket, what the R2 key looks like — project
media buckets by portfolio *phase*, proposal media doesn't have phases) are exactly the facts that
differ per owner and nothing else. Isolating them in one small object per owner is what makes the
service itself owner-agnostic.
**Reference impl**: `stores.ts`
**Enforced by**: convention — `MediaStore` is the only shape `mediaService` functions accept

### provider-aware-base-columns

`baseMediaColumns()` (`src/shared/db/schema/lib/media-columns.ts`) is a **factory** (not a shared
object literal — see the file's header comment on why: sharing builder instances across two
`pgTable()` calls confuses drizzle-kit's live-DB diff into emitting a spurious cross-table rename)
that every media table spreads into its own `pgTable()` definition. It carries:

- `provider ∈ { r2, stream }`, default `r2`.
- Nullable `pathKey`/`bucket` (an R2-backed row has them; a Stream row doesn't) and nullable
  `externalId` (a Stream asset's Cloudflare Stream UID; null for `r2`).
- Optimization bookkeeping shared by every owner: `optimizationStatus`, `optimizationVariants`,
  `blurDataUrl`.

**Plan 1** (current) writes only the `r2` provider — every row is an object in an R2 bucket. The
`stream` provider (Cloudflare Stream video) and PDF first-page raster are Plan 1b work that lands
via the `file-optimization` strategy registry's `// PLAN 1b:` extension points (see
`src/shared/lib/file-optimization/DOCS.md#plan-1b-extension-point`) — the schema shape already
accommodates them so Plan 1b doesn't need a migration to add the concept.

**Why**: designing the nullable provider/coordinate split now means Plan 1b's video/PDF-thumbnail
work is additive (new provider value + new optimizer strategy), not a schema rewrite.
**Reference impl**: `src/shared/db/schema/lib/media-columns.ts`
**Enforced by**: convention (both `media_files` and `proposal_media_files` spread the same factory)

### optimize-dispatch-chain

`mediaService.createRecord` dispatches optimization automatically for image and PDF uploads
(`mimeType.startsWith('image/') || mimeType === 'application/pdf'`) via
`optimizeMediaJob.dispatch({ ownerKind, mediaId })` (Upstash QStash job). The chain is:

1. `optimizeMediaJob` (`services/providers/upstash/jobs/optimize-media.ts`) — job wrapper, owner-agnostic.
2. `optimizeMediaFile({ ownerKind, mediaId })` (`optimize-media.ts`) — owner-agnostic orchestrator.
   Looks up the owner's table + row via `getOptimizationTarget(ownerKind)` (`optimization-target.ts`,
   the parallel owner-lookup table to `stores.ts`, scoped to just what optimization needs: `table` +
   `getFile`). Skips already-`optimized` rows (idempotent) and any `provider === 'stream'` row (no
   fetchable R2 object) or a row missing `pathKey`/`bucket`.
3. `optimizeFile(buffer, mimeType)` (`src/shared/lib/file-optimization/optimize-file.ts`) — **pure**,
   no IO. Classifies the file and returns a `FileOptimizationResult` (variants to upload + scalar
   fields to persist).
4. Back in `optimizeMediaFile`: uploads any returned image variants to R2 alongside the original
   (`{basePath}-{suffix}.webp`), then writes status/fields via the table-parameterized setters
   (`setMediaOptimizationComplete`/`Failed`/`Processing` in
   `entities/media-files/dal/server/optimization.ts`) — parameterized on `table` so the same setters
   write either owner's table.

**Why**: keeping the pure classify/transform step (`optimizeFile`) separate from the IO orchestration
(`optimizeMediaFile`) means the optimizer core is unit-testable without R2/DB, and owner-agnostic by
construction — it never imports a specific table.
**Reference impl**: `optimize-media.ts`, `optimization-target.ts`, `services/providers/upstash/jobs/optimize-media.ts`
**Enforced by**: convention

### shared-ui-is-dependency-injected

`src/shared/components/media/*` (`MediaManager` + `MediaCard`, `MediaReorderGrid`,
`MediaUploadButton`, `PhotoDetailDialog`) is a DI area: it imports **no** router hooks, no
`OptimizedImage`, and no `mediaPhases` — every owner-specific rendering decision (thumbnail,
per-item controls/menu, preview, detail fields) is passed in as a render-prop by the consumer.
`MediaManager` itself is the simple "one header + upload button + reorder grid per group"
orchestrator used by the proposal Files tab; a richer consumer (the project photo manager) composes
`MediaCard`/`MediaReorderGrid`/`MediaUploadButton` directly for bulk/multi-select/hero-image needs
`MediaManager` doesn't support.

Project (`features/project-management/ui/components/form/project-media-manager.tsx`) and proposal
(`features/proposal-flow/ui/components/form/proposal-media-manager.tsx`) are the two consumers today.

**Why**: the components carry no opinion about what phase enums exist, what an "optimized image"
component looks like, or which router to call — those all belong to `@/features/**` call sites.
Keeping the shared layer ignorant of them is what lets both consumers (with different phase models,
different image-rendering primitives) share one implementation.
**Reference impl**: `src/shared/components/media/media-manager.tsx` + sibling files
**Enforced by**: convention (no `@/features` import in this directory)

### shared-layer-never-imports-features

`src/shared/services/media/**` and `src/shared/components/media/**` never import from
`@/features/**`. This is the general shared-vs-feature import-direction rule (features depend on
shared, never the reverse) applied to the media subsystem specifically, because it's the one shared
area two different features (`project-management`, `proposal-flow`) both depend on — any
feature-specific leak here would break the other consumer.

**Why**: `src/shared/**` is meant to be safely importable from any feature; a `@/features/**`
import here would create a cross-feature dependency through the back door.
**Reference impl**: n/a (absence of imports)
**Enforced by**: convention (no lint rule currently enforces this for this directory specifically)

## Anti-patterns

- **Adding a projects-only code path inside `mediaService` or `MediaManager`/`MediaCard`/etc.**
  Add a `MediaStore` (service side) or a render-prop (UI side) instead — see
  `#media-service-is-owner-parameterized` and `#shared-ui-is-dependency-injected`.
- **Importing `OptimizedImage`, `mediaPhases`, or a router hook into `src/shared/components/media/**`.**
  Breaks the DI contract; pass it in from the feature-level consumer instead.
- **Importing `@/features/**` from `src/shared/services/media/**` or `src/shared/components/media/**`.**
  See `#shared-layer-never-imports-features`.
- **Sharing a single `baseMediaColumns()` object literal across two `pgTable()` calls.** Call the
  factory once per table — see `#provider-aware-base-columns` and the header comment in
  `media-columns.ts` for the drizzle-kit diff bug this avoids.
- **Assuming every media row has a fetchable R2 object.** A `provider: 'stream'` row (Plan 1b) has
  null `pathKey`/`bucket` by design — guard before calling `r2Client.getObject`/presign helpers.
- **Doing IO (R2 fetch/upload, DB writes) inside `optimizeFile` or any `file-optimization/strategies/*`.**
  That layer is pure by contract — see `src/shared/lib/file-optimization/DOCS.md`.

## See also

- `src/shared/lib/file-optimization/DOCS.md` — the pure optimizer core dispatched by `optimizeMediaFile`
- [`../../entities/proposals/DOCS.md#proposal-media`](../../entities/proposals/DOCS.md) — proposal-side consumer rules (visibility, lock-exemption, copy-to-project)
- `../../entities/projects/DOCS.md` — project-side consumer (public gallery, phases)
- `docs/codebase-conventions/dal-conventions.md` — `DalReturn<T>` + `ScopedContext` pattern used by the owner DALs this service is invoked from

**Last updated**: 2026-08-05 (Task E3)
