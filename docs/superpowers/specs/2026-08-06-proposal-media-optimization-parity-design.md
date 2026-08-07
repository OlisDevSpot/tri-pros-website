# Sub-plan 2.1 — Proposal Media Optimization Parity + Backfill

**Epic:** Media Foundation (Plan 1.5). Follows Sub-plan 2 (proposal media goes public). Precedes Sub-plan 3 (lightbox) / Sub-plan 4 (multi-select).

**Status:** design.

## Problem

Proposal uploads land in `tpr-media/proposals/*` as originals with no responsive
variants, so the client renders full-size images and the manager UI is slow —
the exact problem the epic set out to kill.

Root-cause investigation (four parallel agents + code verification) established
that **optimization is already fully wired and symmetric with project media**:

- Proposal `create` (`proposals.router/media.router.ts:51`) routes through the
  same `mediaService.createRecord`, which fires
  `void optimizeMediaJob.dispatch({ ownerKind: 'proposal', mediaId })` for any
  image/pdf (`media.service.ts:22-23`). The `create` input carries `bucket` +
  `pathKey` (`:42-43`), so they are persisted on the row and the optimizer's
  null-guard does not trip.
- `proposal` is a registered owner in both `optimization-target.ts` and
  `VARIANT_REGISTRY.proposal = ['xs','sm','md','lg']` (`image-variants.ts:44`).
- The render path (`get-optimized-urls.ts`) gates on
  `optimizationStatus === 'optimized'`; a non-optimized row renders the original
  URL with **no `srcSet`** — no broken URLs, just un-optimized ones.

So the observed "no optimization" is a **symptom**: the optimize job never
*completed* for the affected rows. Two distinct causes:

1. **Environmental (not a bug).** The QStash dispatch publishes a callback to
   `publicUrl('/api/qstash-jobs')`, which resolves to
   `NGROK_URL ?? NEXT_PUBLIC_BASE_URL` (`public-url.ts:14`). In plain
   `pnpm dev` (no tunnel) that is `localhost`, which QStash's cloud cannot POST
   back to; the dispatch is best-effort and swallows the failure
   (`create-job.ts:43-45`), leaving the row at `pending`. Since the Sub-plan 2
   code is only on the local branch, all current testing is in dev — this fits.
2. **A real recovery gap.** Whatever the cause of a stuck row (dev-no-tunnel,
   a transient QStash/R2 error → `failed`, or a row predating the 2026-08-05
   generic-dispatch refactor), **proposals have no self-heal lever.** Projects
   expose `retryOptimization` (procedure + UI Retry button); proposals expose
   nothing. A stuck proposal row stays on originals forever.

## Goal

Give proposal media the recovery + visibility affordances project media already
has, and re-optimize the existing stuck back-catalog. Do **not** touch the
upload/dispatch path — it is already correct.

## Scope

In scope:

1. Media-service facade methods `retryOptimization(store, id)` +
   `optimizeNow(store, id)` — the single surface for optimization recovery. Both
   routers and the backfill call them; nothing touches the DAL setters or the
   QStash job directly.
2. A table-parameterized `resetMediaOptimizationStatus(table, id)` DAL setter
   (called by the facade), plus deletion of the now-fully-dead legacy
   `media-files/dal/server/queries.ts`.
3. Migrate the project `retryOptimization` procedure onto the facade.
4. A proposal `retryOptimization` tRPC procedure (via the facade) + client mutation.
5. Threading the (already-built) `onRetryOptimization` UI affordance into the
   proposal media manager.
6. A one-time, operator-run backfill script that re-optimizes stuck proposal
   rows via the facade (`mediaService.optimizeNow`, synchronous — no QStash).
7. A recovery-lever note in `services/media/DOCS.md`.

Out of scope (YAGNI):

- No bulk "retry all" button — the backfill script covers the mass case.
- No homeowner-side retry — the homeowner proposal view is read-only.
- No change to the upload → `createRecord` → dispatch path — already correct and
  symmetric with project media.
- No re-optimization of the project/portfolio back catalog — unrelated to this
  sub-plan.
- **No fix of the standing `media.service.ts` DAL violation.** The existing
  `createRecord` / `removeRecord` / `reorder` / `rename` / `list` methods import
  `db` and issue `db.insert/select/delete/update/transaction` directly —
  a pre-existing breach of `services-never-import-db`
  ([service-architecture.md#services-never-import-db](../../codebase-conventions/service-architecture.md)).
  This sub-plan deliberately does **not** touch those methods (user decision
  2026-08-06: keep 2.1 minimal). The db-extraction — moving those five
  operations into table-parameterized `media-files` DAL functions (matching the
  `optimization.ts` shape) so `mediaService` becomes a pure orchestrator — is
  tracked as its own follow-up. Implementers and reviewers of 2.1 must **not**
  refactor the sibling methods here; flag it as out-of-scope, not a defect.

## Architecture

Eight units, each with a clear boundary. **The media-service facade
(`mediaService`) is the single surface for all optimization operations** — both
routers and the backfill call it, never the DAL setters or the QStash job
directly. This mirrors the proven pattern already in the facade (`createRecord`
already owns dispatch-on-create) and keeps the layering tRPC → Service → DAL. The
render/status UI is entirely reused from `OptimizedImage` — no new components.

### Unit 1 — DAL: parameterized reset setter + delete the dead legacy file

**Add** a sibling to the table-parameterized setters in
`src/shared/entities/media-files/dal/server/optimization.ts` (which
already holds `setMediaOptimization{Processing,Complete,Failed}`):

```ts
export async function resetMediaOptimizationStatus(table: AnyMediaTable, id: number): Promise<void> {
  await db.update(table).set({ optimizationStatus: 'pending' }).where(eq(table.id, id))
}
```

**Delete** the entire legacy file `src/shared/entities/media-files/dal/server/queries.ts`.
A project-wide sweep (2026-08-06) proved it is dead once the project router
migrates to the facade (Unit 3): its only external consumer is the project
router's `resetOptimizationStatus` import. Every other export
(`getMediaFileById`, the non-parameterized `setOptimizationProcessing/Complete/Failed`,
the `MediaFile` type re-export) already has **zero** consumers repo-wide,
superseded by the table-parameterized setters in `optimization.ts` that
`optimize-media.ts` actually imports. Deleting the whole file (not just the reset
function) is the honest dead-code conclusion — leaving the orphaned siblings
would itself violate the delete-dead-code rule.

Boundary: one owner-agnostic setter, keyed on the passed Drizzle table. Same
contained-`any` pattern already documented at the top of `optimization.ts`.

**Blast radius (verified by project-wide sweep, 2026-08-06).** The contract
change — reset moves behind the facade, and the legacy `queries.ts` is deleted —
touches exactly these sites, all **rewritten/deleted** (zero tallied, no
dual-shape tolerance):

| Site | Disposition |
| --- | --- |
| `media-files/dal/server/queries.ts` (whole file: `getMediaFileById`, 3 legacy setters, `resetOptimizationStatus`, `MediaFile` re-export) | deleted — verified zero remaining consumers |
| `projects.router/media.router.ts:8` (`resetOptimizationStatus` import) | deleted — no longer needed (facade owns reset) |
| `projects.router/media.router.ts:14` (`optimizeMediaJob` import) | deleted — sole use was the retry dispatch, now behind the facade |
| `projects.router/media.router.ts:44-50` (retry body) | rewritten → `mediaService.retryOptimization(projectMediaStore, input.mediaFileId)` |

Sweep evidence: the only import from `media-files/dal/server/queries` anywhere is
the project router line 8; the three legacy setters and `getMediaFileById` return
only their own definitions. `optimizeMediaJob` in the project router is used only
at line 48. No scripts, tests, or docs reference any of it.

### Unit 2 — Media-service facade: `retryOptimization` + `optimizeNow`

`src/shared/services/media/media.service.ts`. Add two methods to the existing
`mediaService` object. Both take a `MediaStore` (which already carries
`ownerKind` + `table`) so they are owner-agnostic and reused by every media
owner — the extensible pattern the user directed:

```ts
// async retry — resets status then queues optimization (interactive Retry button)
async retryOptimization(store: MediaStore, mediaId: number) {
  await resetMediaOptimizationStatus(store.table, mediaId)
  void optimizeMediaJob.dispatch({ ownerKind: store.ownerKind, mediaId })
},

// synchronous, in-process optimize — no QStash (backfill scripts / dev)
async optimizeNow(store: MediaStore, mediaId: number) {
  return optimizeMediaFile({ ownerKind: store.ownerKind, mediaId })
},
```

New imports in `media.service.ts`: `resetMediaOptimizationStatus` (from
`@/shared/entities/media-files/dal/server/optimization`) and `optimizeMediaFile`
(from `./optimize-media`). `optimizeMediaJob` and `MediaStore` are already
imported. No import cycle: `optimize-media.ts` does not import `media.service.ts`.

Boundary: the facade is the only surface callers touch. `retryOptimization`
composes reset + dispatch; `optimizeNow` wraps the synchronous orchestrator.
Three optimization entrypoints now live coherently on one object: `createRecord`
(auto async on upload), `retryOptimization` (manual async), `optimizeNow`
(manual sync).

### Unit 3 — Project router migrates to the facade

`src/trpc/routers/projects.router/media.router.ts`. Rewrite the existing
`retryOptimization` procedure body to call the facade, and drop the now-unused
`resetOptimizationStatus` (Unit 1, deleted) and `optimizeMediaJob` imports:

```ts
retryOptimization: agentProcedure
  .input(z.object({ mediaFileId: z.number() }))
  .mutation(async ({ input }) => {
    await mediaService.retryOptimization(projectMediaStore, input.mediaFileId)
    return { success: true }
  }),
```

Behavior is identical to today (reset → dispatch); only the layering changes
(now via the facade). `mediaService` and `projectMediaStore` are already imported
in this file.

### Unit 4 — Proposal `retryOptimization` procedure (via the facade)

`src/trpc/routers/proposals.router/media.router.ts`. Add the procedure, using the
proposal router's local authz + `id` conventions, delegating to the same facade
method:

```ts
retryOptimization: entity.authedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    assertCanUpdate(ctx)
    await assertProposalMediaInScope(ctx, input.id)
    await mediaService.retryOptimization(proposalMediaStore, input.id)
    return { success: true }
  }),
```

No new DAL or job imports in the router — the facade owns that. `mediaService`,
`proposalMediaStore`, `assertProposalMediaInScope`, and `assertCanUpdate` are all
already imported/defined in this file.

Boundary: authorize → delegate to facade. The only differences from the project
procedure are the authz guards and the store passed in.

### Unit 5 — Client mutation

`src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts`. Add:

```ts
const retryOptimization = useMutation(trpc.proposalsRouter.media.retryOptimization.mutationOptions({ onSuccess: invalidate }))
```

and include `retryOptimization` in the returned object. `invalidate` already
exists and points at the proposal media `list` query key.

### Unit 6 — UI thread (one line)

`src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`. In
`renderThumbnail`, the image branch already renders
`<OptimizedImage file={row} … />`. Add the prop:

```tsx
<OptimizedImage
  file={row}
  alt={item.name}
  sizes="(max-width: 768px) 45vw, 220px"
  onRetryOptimization={id => media.retryOptimization.mutate({ id })}
/>
```

`OptimizedImage` (`optimized-image.tsx:124-145`) already renders the
"Optimizing…" spinner while `isProcessing` and the "Retry" button while
`isFailed` — **only when `onRetryOptimization` is present**. Passing the prop is
the entire UI change; no new markup.

### Unit 7 — Backfill script

`scripts/backfill-proposal-media-optimization.ts`. One-time, operator-run,
idempotent, re-runnable.

- **DB access via the `@/shared/db` singleton** — NOT a hand-rolled `drizzle(pg)`
  connection. Template: `scripts/backfill-wave2-children.ts`. This matters for
  correctness: `optimizeNow` → `optimizeMediaFile` reads/writes through
  `@/shared/db`, which self-resolves `DRIZZLE_TARGET` (and self-loads
  `.env.local` via `server-env`). If the stuck-row SELECT used a second
  hand-picked connection, the SELECT and the optimize step could target
  *different* databases whenever the hand-picked URL and `DRIZZLE_TARGET`
  disagree. Using the singleton for the SELECT guarantees one shared target. No
  `import './lib/load-env'` — it is redundant (and not the convention) for
  `@/shared/db`-based scripts.
- Select stuck rows through the singleton: `proposal_media_files` where
  `mimeType` is `image/%` or `application/pdf`, `optimizationStatus <> 'optimized'`,
  and `pathKey`/`bucket` are non-null.
- `--dry-run`: print the count grouped by `optimizationStatus` (this is the
  diagnostic that tells us whether a real backlog exists) and exit without
  mutating.
- Live run: for each row, `await mediaService.optimizeNow(proposalMediaStore, row.id)`
  inside a try/catch; tally `{ optimized, failed }`; print a summary. The
  orchestrator sets `processing` → `optimized`/`failed` itself and skips rows
  already `optimized`, so re-runs are safe.
- `DRIZZLE_TARGET`-guarded via the singleton: defaults to dev; prod requires
  explicit `DRIZZLE_TARGET=prod` (per `feedback-runtime-db-env`). `NODE_ENV` is
  never hand-set.

Boundary: pure operator tool. It calls the facade (`optimizeNow`); it contains no
sharp/optimization/dispatch logic of its own.

### Unit 8 — DOCS: recovery-lever note

`src/shared/services/media/DOCS.md`. The `#optimize-dispatch-chain` section
documents create→dispatch but has no entry for the recovery lever. Add a short
note documenting the facade's recovery surface: `retryOptimization(store, id)`
(reset → dispatch) and `optimizeNow(store, id)` (synchronous), and that all
optimization entrypoints route through `mediaService`. This also back-fills the
previously-undocumented project retry. Per the Sub-plan 2 ledger ruling, media
DOCS edits ship in the same change, not as a follow-up.

## Data Flow

**Interactive retry** (prod / `pnpm dev:mobile`):
`OptimizedImage` Retry → `onRetryOptimization(id)` → `retryOptimization.mutate({ id })`
→ procedure: scope assert → `mediaService.retryOptimization(proposalMediaStore, id)`
→ facade: `resetMediaOptimizationStatus(store.table, id)` (status → `pending`; UI
immediately shows "Optimizing…") + `optimizeMediaJob.dispatch({ ownerKind, mediaId })`
→ QStash callback → `optimizeMediaFile` writes `-xs/-sm/-md/-lg.webp` + status
`optimized` → `invalidate()` refetches → `srcSet` renders.

**Backfill** (one-time, from operator machine against prod DB/R2):
script → SELECT stuck rows via `@/shared/db` → per row
`mediaService.optimizeNow(proposalMediaStore, row.id)` → facade →
`optimizeMediaFile()` inline → variants + status → summary. No QStash involved.

## Error Handling

- **Authorization:** `assertCanUpdate` → FORBIDDEN when the caller cannot update
  proposals; `assertProposalMediaInScope` blocks retrying media on an
  out-of-scope proposal id.
- **Optimization failure:** `optimizeMediaFile` self-contains errors and sets
  `optimizationStatus: 'failed'`. The backfill wraps each row in try/catch, logs
  the failing `mediaId`, continues, and reports `{ optimized, failed }`.
- **Idempotency:** the orchestrator's `status === 'optimized'` guard makes both
  the retry button and a backfill re-run safe no-ops on healthy rows.
- **Dev-without-tunnel:** the interactive retry's dispatch callback cannot reach
  `localhost`; the row stays `pending`. This is the same constraint as every
  QStash job and is documented, not fixed here. The backfill is the dev-safe
  path (direct call, no callback).

## Testing / Validation

Repo has no unit-test runner; the gate is `pnpm tsc` + `pnpm lint` (per
`feedback-verification-workflow`). Validation steps:

1. `pnpm tsc` and `pnpm lint` clean.
2. `pnpm tsx scripts/backfill-proposal-media-optimization.ts --dry-run` prints
   the stuck-row count (diagnostic).
3. Live backfill against **dev** → stuck rows flip to `optimized`;
   `-xs/-sm/-md/-lg.webp` appear in `tpr-media/proposals/*`.
4. In a QStash-reachable env (`pnpm dev:mobile` or a deploy): a fresh proposal
   image auto-optimizes; a forced `failed` row flips to `optimized` via the
   Retry button.
5. Dashboard manager shows the spinner while processing; the homeowner gallery
   emits `srcSet` (Network shows a sized `-md.webp`, not the original).

## Files

- `src/shared/entities/media-files/dal/server/optimization.ts` — add `resetMediaOptimizationStatus`.
- `src/shared/entities/media-files/dal/server/queries.ts` — **delete the whole file** (verified dead once the project router moves to the facade).
- `src/shared/services/media/media.service.ts` — add facade methods `retryOptimization` + `optimizeNow`.
- `src/trpc/routers/projects.router/media.router.ts` — migrate `retryOptimization` to the facade; drop `resetOptimizationStatus` + `optimizeMediaJob` imports.
- `src/trpc/routers/proposals.router/media.router.ts` — add `retryOptimization` (delegates to the facade).
- `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts` — add client mutation.
- `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` — thread `onRetryOptimization`.
- `scripts/backfill-proposal-media-optimization.ts` — new backfill script (`@/shared/db` singleton + `mediaService.optimizeNow`).
- `src/shared/services/media/DOCS.md` — document the recovery lever (`#optimize-dispatch-chain`).

## Global Constraints

- **All optimization operations route through the `mediaService` facade** — no
  router or script calls the DAL setters or `optimizeMediaJob` directly. The
  facade is the single, extensible surface (user direction; matches
  `createRecord`'s existing dispatch ownership).
- **The new facade methods import zero `db`.** `retryOptimization` and
  `optimizeNow` compose only DAL (`resetMediaOptimizationStatus`), the
  orchestrator (`optimizeMediaFile`), and the job (`optimizeMediaJob`) — they add
  no `db.*` call to `media.service.ts`. All status writes flow through the
  parameterized DAL setters in `optimization.ts` (ADR-0003,
  `services-never-import-db`). The service continuing to import `db` for its
  pre-existing sibling methods is a known, separately-tracked violation (see
  "Out of scope") — this sub-plan neither extends nor fixes it.
- Never set `updatedAt` by hand — `.$onUpdate()` handles it
  (`feedback-no-manual-updated-at`).
- Backfill script: use the `@/shared/db` singleton (template
  `scripts/backfill-wave2-children.ts`), NOT a hand-rolled connection and NOT
  `import './lib/load-env'` — the singleton self-resolves `DRIZZLE_TARGET` and
  self-loads env, and sharing it with the optimizer guarantees one DB target.
  `DRIZZLE_TARGET=prod` is the only prod-DB lever; `NODE_ENV` is never hand-set
  (`feedback-runtime-db-env`, `environment.md#environment-axes`).
- Delete dead code rather than leaving defensive back-compat; `@deprecated` only
  when a caller is outside our control (ubiquitous-language: blast radius). The
  whole legacy `media-files/dal/server/queries.ts` goes — not just the one
  function — because the sweep proved every export is orphaned.
- Media DOCS (`services/media/DOCS.md`) update ships in this change, not as a
  follow-up (Sub-plan 2 ledger ruling).
- Do not modify the upload/`createRecord`/dispatch-on-create path or
  `optimization-target.ts` / `VARIANT_REGISTRY` — they are correct.
