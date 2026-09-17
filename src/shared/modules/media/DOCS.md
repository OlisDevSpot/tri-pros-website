# Media Module — Business Rules

`src/shared/modules/media/` is a **capability module** (`docs/codebase-conventions/service-architecture.md#modules`): it owns no table of its own and is generic over whichever table an owner hands it. `project`s and `proposal`s are the two owners today; a third owner is a store + a small DAL away, not a rewrite of this module.

This directory holds the owner-agnostic orchestrator (`service.ts`), the open owner contract (`core/types.ts`), the table-generic DAL (`core/dal/server/{media-ops,optimization}.ts`), the pure optimizer pieces (`core/lib/{image-variants,process-image-variants,optimize-media,purge}.ts`) and this file.

## Rules

### media-module-takes-no-direct-owner-dependency

No file under `modules/media/**` directly imports an owner's table, CRUD, server-spec, or an owner-kind union — an owner hands its store in; the module never reaches for one. Grep for a literal `from '@/shared/db/schema/project-media-files'` (or `proposal-media-files`) under `modules/media/` and you get nothing.

**This is not a claim that the import graph is acyclic.** `modules/media/service.ts` imports the optimize job (`services/providers/upstash/jobs/optimize-media.ts`), and that job *value*-imports both owner stores, which in turn import both owner CRUDs — so there **is** a transitive owner edge, just not a direct one from anything under `modules/media/`. A module-graph tool that walks transitive imports will show it; a grep for a direct owner import under this directory will not. See `#the-import-cycle-and-why-three-things-defer` below for the shape of that edge and why it's safe.

**Why**: the media service's pre-module `stores.ts` (deleted with this restructure) had a closed `MediaOwnerKind = 'project' | 'proposal'` union and imported both owners' tables and CRUD directly — a new owner meant editing the media layer. `MediaStore` inverts that: the owner is generic, so a new owner never touches this directory.
**Reference impl**: `core/types.ts` (no owner import); `service.ts` (only ever takes `store: MediaStore` as a parameter)
**Enforced by**: convention — no lint rule walks the transitive graph today

### media-store-is-the-owner-seam

`MediaStore` (`core/types.ts`) is the one contract an owner implements:

```ts
export interface MediaStore {
  ownerKind: string                                    // free-form label, carried in the job payload — the module never branches on it
  table: any                                           // the owner's base-media Drizzle table
  ownerColumn: PgColumn                                // table.projectId | table.proposalId — typed, not `any`
  bucket: R2BucketName
  readonly crud: CrudHandlers<any, number>              // GETTER, not a plain property — see below
  buildPathKey: (ownerId, fileId, ext, extra?) => string
  variants: readonly VariantSuffix[]                    // which variants THIS owner's optimizer writes
}
```

Two stores exist today, each on the owning unit, not in this module:

| Store | Owner table | Bucket | Path shape |
|---|---|---|---|
| `projectMediaStore` (`modules/projects/media/store.ts`) | `projectMediaFiles` (SQL table still named `media_files` — no rename this round) | `tpr-media` (public) | `projects/{projectId}/{phase}/{fileId}{ext}` |
| `proposalMediaStore` (`modules/proposals/media/store.ts`) | `proposalMediaFiles` (`proposal_media_files`) | `tpr-media` (public) | `proposals/{proposalId}/{fileId}{ext}` |

**`crud` is a getter, not a top-level property value — see `#the-import-cycle-and-why-three-things-defer`.** `ownerColumn` is typed `PgColumn` (not `any`): the module never calls anything owner-specific on it beyond what Drizzle's column type already gives it (used as a `WHERE`/`ON` operand).

**Why**: the owner-specific facts — which table, which bucket, what the R2 key looks like, which variants get written and therefore must get deleted — are exactly the facts that differ per owner and nothing else. Isolating them in one small object per owner is what keeps the module itself owner-agnostic.
**Reference impl**: `core/types.ts`; `modules/projects/media/store.ts`; `modules/proposals/media/store.ts`
**Enforced by**: convention — `MediaStore` is the only shape `mediaService` functions accept

### adding-a-new-media-owner

Adding a new owner is exactly:

1. A `store.ts` on the new unit implementing `MediaStore` (table, `ownerColumn`, bucket, `buildPathKey`, `variants`, and a `get crud()` getter).
2. A leaf constants module (the `PROJECT_MEDIA`-style shape: `{ ownerKind, variants }` as `const`) — read by BOTH the store and the unit's CRUD hooks, so neither has to import the other.
3. The two CRUD hooks on the unit's `createCrudDal` call: `create.after` dispatches the optimize job when the row is optimizable; `delete.before` purges the R2 object (+ variants) before the row is deleted.
4. One line in the optimize job's `STORES` map (`services/providers/upstash/jobs/optimize-media.ts`) — `newOwner: () => newOwnerStore`.

No DAL change, no service change, no owner-kind union to extend. (An earlier version of this doc said "store + DAL" — that undercounted: the hooks and the job-map line are part of the recipe too, and skipping either one means optimize dispatch or R2 cleanup silently doesn't happen for the new owner's rows.)

**Reference impl**: `modules/projects/media/{store,lib/constants,dal/server/crud}.ts` + the `project` line in `optimize-media.ts`'s `STORES`

### media-service-surface

`mediaService` (`service.ts`) exposes exactly five methods, each taking a `MediaStore` as its first argument: **`buildUploadTarget` · `list` · `reorder` · `retryOptimization` · `optimizeNow`**. None of them touch `db` — they ring the table-generic DAL (`core/dal/server/media-ops.ts`, `.../optimization.ts`) and the R2 client.

`createRecord` and `removeRecord` are **gone**, and with them the project-media `create`/`delete` overrides and the proposal `delete` override that used to call them. The row lifecycle they carried — optimize-on-create, purge-on-delete — moved onto each owner unit's own `createCrudDal` hooks (`create.after` / `delete.before` on `modules/{projects,proposals}/media/dal/server/crud.ts`), because a hook fires for **every** origin — a tRPC mutation, the optimize job's retry path, a bare `crud.create` from a script — while a service method only fired for callers that happened to go through the service. See `docs/codebase-conventions/service-architecture.md#row-lifecycle-vs-orchestration`.

The proposal media unit's `create` **override survives** — it holds only the parent-visibility probe (`assertParentVisible`), which is authorization, a service concern, not a row-lifecycle side effect. Its `delete` override is gone; deletion now runs on the plain spread `...proposalMediaCrud`, whose `delete.before` hook does the purge.

**Consequence**: deleting an already-deleted media row now returns `not-found` instead of succeeding silently (the engine's `delete` probes the row first); `bulkDelete` call sites must tolerate `not-found` per id rather than treating it as a hard failure.

**Reference impl**: `service.ts`; `modules/projects/media/dal/server/crud.ts`; `modules/proposals/media/dal/server/crud.ts`
**Enforced by**: convention + the deleted methods no longer existing (`tsc` catches a caller still reaching for `createRecord`/`removeRecord`)

### the-import-cycle-and-why-three-things-defer

There is a real import cycle through this module, and it is **defused by deferred reads, not avoided**:

```
owner CRUD  →  optimize job  →  STORES map  →  owner store  →  owner CRUD
```

Each owner unit's CRUD (`modules/{projects,proposals}/media/dal/server/crud.ts`) imports the optimize job to dispatch on create. The job (`services/providers/upstash/jobs/optimize-media.ts`) imports both owner stores to resolve `ownerKind` → store. Each store imports its own unit's CRUD (to expose the `crud` getter). That closes the loop.

ES module bindings are live — a reference resolved at **call time** is always initialised by the time it's read, however the cycle was entered. A reference resolved **at module-evaluation time** (a plain object property, a module-scope map literal) is not: on whichever import order loads a module second, the binding it needs from the module still mid-evaluating is in its temporal dead zone. Three things on this cycle read another module's exported value and all three defer that read to call time:

1. **`MediaStore.crud`** — a getter (`get crud() { return projectMediaCrud }`), not `crud: projectMediaCrud`.
2. **The job's `STORES` map** — entries are thunks (`project: () => projectMediaStore`), not `project: projectMediaStore`.
3. **The module-service getters above the job** — `mediaService`, `projectMediaService`, `proposalMediaService` and `projectsService` (`get media() { return projectMediaService }`) all reach this cycle through an import, and each one that re-exposes a value on this chain does so through a getter or a method body, never a top-level property.

**This rule exists because of a real, proven failure, not a hypothetical one.** Task 5 of this restructure shipped the job's `STORES` map as an eager object (`project: projectMediaStore`). `pnpm tsc` and `pnpm lint` were green the whole time — nothing about the type checker or the linter sees a module-evaluation-order bug. In production the shipped routers enter this graph **store-first** (`projects.router/media.router.ts` and `google-drive.router.ts` import the store before the service), and that entry order threw `ReferenceError: Cannot access 'projectMediaStore' before initialization` while evaluating `import('src/trpc/routers/projects.router/index')` — taking the **entire projects router** down at boot. Deferring the `STORES` read into a function body fixed it, matching the rule `MediaStore.crud` already followed for the identical reason.

**Do not "simplify" a getter or a thunk on this cycle back into a plain value** — it will type-check and lint clean, and it can still crash the app depending on which module happens to load first.

**Verifying a change here**: a proof that only exercises one or two entry points is not sufficient — the original proof for this cycle tested crud-first and job-first, both of which passed while the shipped store-first path was still broken. Cover **every** module on the cycle as an entry point: both stores, both media CRUDs, the job itself, the four module services (`mediaService`, `projectMediaService`, `proposalMediaService`, `projectsService`), both project-media routers (`media.router.ts`, `google-drive.router.ts`), and the projects router `index.ts`.

**Reference impl**: `core/types.ts` (`MediaStore.crud`); `services/providers/upstash/jobs/optimize-media.ts` (`STORES`); `modules/projects/service.ts` / `modules/proposals/service.ts` (`get media()`)
**Enforced by**: convention + the header comments on each of the three deferral points; no automated cycle check exists

### raw-db-stays-inside-the-dal

`core/dal/server/media-ops.ts` and `core/dal/server/optimization.ts` still import `db` — legitimately, as table-parameterized DAL (`db` is allowed inside any `dal/server/` directory per `docs/codebase-conventions/dal-conventions.md#only-dal-imports-db`). This restructure did **not** remove "the last raw `db` import from the media layer" — it removed the last raw `db` read on the media **service/optimizer** path: the pre-module `optimization-target.ts` (deleted with this restructure), which forced the service layer to hard-code each owner's table behind a closed `MediaOwnerKind` union. `db` access is now confined to the DAL, same as every other module.

**Reference impl**: `core/dal/server/media-ops.ts`, `core/dal/server/optimization.ts`
**Enforced by**: `dal-conventions.md#only-dal-imports-db`

### optimize-dispatch-chain

The optimize job (`services/providers/upstash/jobs/optimize-media.ts`) is the **composition root** for media owners: `ownerKind` resolves to a store here and nowhere else, so a new owner is one line in `STORES` plus its own store — `modules/media` itself never sees an owner union. The chain from a create hook to a persisted optimization result:

1. `optimizeMediaJob.dispatch({ ownerKind, mediaId })` (from a unit's `create.after` hook, or `mediaService.retryOptimization`) — owner-agnostic job wrapper.
2. The job resolves `store = STORES[ownerKind]?.()` and calls `optimizeMediaFile({ store, mediaId })` (`core/lib/optimize-media.ts`) — looks up the row via `store.crud.getById`, skips already-`optimized` rows and any `provider === 'stream'` row or a row missing `pathKey`/`bucket`.
3. `optimizeFile(buffer, mimeType, variants)` (`src/shared/lib/file-optimization/optimize-file.ts`) — **pure**, no IO — classifies the file and returns variants to upload + scalar fields to persist. The third argument is the owner's `store.variants` list.
4. Back in `optimizeMediaFile`: uploads any returned image variants to R2 alongside the original, then writes status/fields via the table-parameterized setters in `core/dal/server/optimization.ts`, parameterized on `store.table` so the same setters write either owner's table.

**`mediaService.optimizeNow(store, mediaId)`** runs this synchronously, in-process, with no QStash round-trip — used by dev and operator backfills where a QStash callback to `localhost` can't be delivered.

**Reference impl**: `core/lib/optimize-media.ts`; `services/providers/upstash/jobs/optimize-media.ts`; `core/dal/server/optimization.ts`
**Enforced by**: convention

### provider-aware-base-columns

`baseMediaColumns()` (`src/shared/db/schema/lib/media-columns.ts`) is a **factory** (not a shared object literal — sharing builder instances across two `pgTable()` calls confuses drizzle-kit's live-DB diff into emitting a spurious cross-table rename; see the file's header comment) that every media table spreads into its own `pgTable()` definition. It carries `provider ∈ { r2, stream }` (default `r2`), nullable `pathKey`/`bucket`/`externalId`, and the optimization bookkeeping columns (`optimizationStatus`, `optimizationVariants`, `blurDataUrl`) shared by every owner.

**Plan 1** (current) writes only the `r2` provider. The `stream` provider (Cloudflare Stream video) and a PDF first-page raster are Plan 1b work via the `file-optimization` strategy registry's extension points — the schema shape already accommodates them.

**Reference impl**: `src/shared/db/schema/lib/media-columns.ts`
**Enforced by**: convention (both `media_files` — the project media table, `projectMediaFiles` in code — and `proposal_media_files` spread the same factory)

### the-r2-purge-path

`purgeMediaObject(row, variants)` (`core/lib/purge.ts`) is the single R2 delete path for media. It is a **leaf** — it imports only the R2 client, so a DAL hook can call it without a DAL ever importing a service. It deletes the row's original plus the union of `variants` (the owner's write-time list) and whatever `row.optimizationVariants` actually recorded, so a shortened variant list doesn't orphan objects from rows written under a longer one. Rows with null coordinates (a Cloudflare Stream row, Plan 1b) are skipped — nothing to delete.

Its callers today are the two media units' `delete.before` hooks (`modules/{projects,proposals}/media/dal/server/crud.ts`) and the project entity's own `delete.before` hook (project delete purges the project's media rows through the media module's table-generic DAL, then this helper — never through the media service, since a DAL may not import one).

**Reference impl**: `core/lib/purge.ts`
**Enforced by**: convention — no other file calls `r2Client.deleteMediaWithVariants` for a media row

### shared-ui-is-dependency-injected

`src/shared/components/media/*` (`MediaManager` + `MediaCard`, `MediaReorderGrid`, `MediaUploadButton`, `PhotoDetailDialog`) is a DI area: it imports **no** router hooks, no `OptimizedImage`, and no phase enum — every owner-specific rendering decision (thumbnail, per-item controls, preview, detail fields) is passed in as a render-prop by the consumer. Project (`features/project-management/...`) and proposal (`features/proposal-flow/...`) media managers are the two consumers today.

**Why**: the components carry no opinion about what phase enums exist, what an "optimized image" component looks like, or which router to call — that stays in `@/features/**`. Keeping the shared layer ignorant of it is what lets both consumers, with different phase models and image-rendering primitives, share one implementation.
**Reference impl**: `src/shared/components/media/media-manager.tsx` + sibling files
**Enforced by**: convention (no `@/features` import in this directory)

## Anti-patterns

- **Adding an owner-specific branch inside `mediaService` or `MediaManager`/`MediaCard`/etc.** Add a `MediaStore` field (service side) or a render-prop (UI side) instead.
- **Turning `MediaStore.crud`, the job's `STORES` entries, or a module-service child getter back into a plain top-level value.** `tsc`/`lint` stay green; the app can still throw a `ReferenceError` at boot on the wrong import order. See `#the-import-cycle-and-why-three-things-defer`.
- **Putting a row-lifecycle side effect (optimize dispatch, R2 purge) back into a service method.** It only fires for callers that go through the service. Use a `createCrudDal` hook — see `#media-service-surface`.
- **Importing an owner's table, CRUD, server-spec, or an owner-kind union anywhere under `modules/media/`.** See `#media-module-takes-no-direct-owner-dependency`.
- **Assuming every media row has a fetchable R2 object.** A `provider: 'stream'` row (Plan 1b) has null `pathKey`/`bucket` by design — guard before calling an R2 client method.
- **Doing IO (R2 fetch/upload, DB writes) inside `optimizeFile` or any `file-optimization/strategies/*`.** That layer is pure by contract — see `src/shared/lib/file-optimization/DOCS.md`.
- **Sharing a single `baseMediaColumns()` object literal across two `pgTable()` calls.** Call the factory once per table.

## See also

- `docs/codebase-conventions/service-architecture.md#modules` — what a module is, root-vs-unit `service.ts`, the getter rule
- `docs/codebase-conventions/dal-conventions.md#only-dal-imports-db` — the `db` allowlist this module's DAL sits on
- `src/shared/lib/file-optimization/DOCS.md` — the pure optimizer core dispatched by `optimizeMediaFile`
- [`../proposals/core/DOCS.md#proposal-media`](../proposals/core/DOCS.md) — proposal-side consumer rules (visibility, lock-exemption, copy-to-project)
- [`../projects/core/DOCS.md`](../projects/core/DOCS.md) — project-side consumer (public gallery, phases)

**Last updated**: 2026-09-17 (projects/media modules restructure, task 6)
