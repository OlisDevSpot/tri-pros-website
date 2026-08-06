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

1. A table-parameterized `resetMediaOptimizationStatus(table, id)` setter; the
   project router migrates to it and the hardcoded project-only reset is deleted.
2. A proposal `retryOptimization` tRPC procedure + client mutation.
3. Threading the (already-built) `onRetryOptimization` UI affordance into the
   proposal media manager.
4. A one-time, operator-run backfill script that re-optimizes stuck proposal
   rows via a direct synchronous `optimizeMediaFile()` call (no QStash).

Out of scope (YAGNI):

- No bulk "retry all" button — the backfill script covers the mass case.
- No homeowner-side retry — the homeowner proposal view is read-only.
- No change to the upload → `createRecord` → dispatch path — already correct and
  symmetric with project media.
- No re-optimization of the project/portfolio back catalog — unrelated to this
  sub-plan.

## Architecture

Five units, each with a clear boundary. The render/status UI is entirely reused
from `OptimizedImage` — no new components.

### Unit 1 — `resetMediaOptimizationStatus(table, id)` (shared DAL)

`src/shared/entities/media-files/dal/server/optimization.ts` already holds the
table-parameterized setters (`setMediaOptimization{Processing,Complete,Failed}`).
Add a sibling:

```ts
export async function resetMediaOptimizationStatus(table: AnyMediaTable, id: number): Promise<void> {
  await db.update(table).set({ optimizationStatus: 'pending' }).where(eq(table.id, id))
}
```

Then:

- **Migrate** the project router: `projects.router/media.router.ts` currently
  imports `resetOptimizationStatus` from `media-files/dal/server/queries.ts`
  (hardcoded to `mediaFiles`). Switch it to
  `resetMediaOptimizationStatus(mediaFiles, input.mediaFileId)`.
- **Delete** the now-dead `resetOptimizationStatus` from
  `media-files/dal/server/queries.ts` (`:50-55`) and its `export`. Dead-code
  deletion — no `@deprecated` shim, because both call sites are in this repo and
  are updated in the same change.

Boundary: one setter, owner-agnostic, keyed on the passed Drizzle table. Same
contained-`any` pattern already documented at the top of `optimization.ts`.

### Unit 2 — Proposal `retryOptimization` procedure

`src/trpc/routers/proposals.router/media.router.ts`. Mirrors the project
procedure, using the proposal router's local authz + `id` conventions:

```ts
retryOptimization: entity.authedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    assertCanUpdate(ctx)
    await assertProposalMediaInScope(ctx, input.id)
    await resetMediaOptimizationStatus(proposalMediaFiles, input.id)
    void optimizeMediaJob.dispatch({ ownerKind: 'proposal', mediaId: input.id })
    return { success: true }
  }),
```

New imports in that file: `resetMediaOptimizationStatus` (from
`media-files/dal/server/optimization`) and `optimizeMediaJob` (from
`providers/upstash/jobs/optimize-media`). `proposalMediaFiles` is already
imported.

Boundary: authorize → reset → dispatch. Same shape as project
`retryOptimization` (`projects.router/media.router.ts:44-50`); the only
differences are the authz guards and `ownerKind: 'proposal'`.

### Unit 3 — Client mutation

`src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts`. Add:

```ts
const retryOptimization = useMutation(trpc.proposalsRouter.media.retryOptimization.mutationOptions({ onSuccess: invalidate }))
```

and include `retryOptimization` in the returned object. `invalidate` already
exists and points at the proposal media `list` query key.

### Unit 4 — UI thread (one line)

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

### Unit 5 — Backfill script

`scripts/backfill-proposal-media-optimization.ts`. One-time, operator-run,
idempotent, re-runnable.

- `import './lib/load-env'` (per repo scripts convention — never `dotenv/config`).
- Select stuck rows: `proposal_media_files` where `mimeType` is `image/%` or
  `application/pdf`, `optimizationStatus <> 'optimized'`, and `pathKey`/`bucket`
  are non-null.
- `--dry-run`: print the count grouped by `optimizationStatus` (this is the
  diagnostic that tells us whether a real backlog exists) and exit without
  mutating.
- Live run: for each row, `await optimizeMediaFile({ ownerKind: 'proposal', mediaId: row.id })`
  inside a try/catch; tally `{ optimized, failed }`; print a summary. The
  orchestrator sets `processing` → `optimized`/`failed` itself and skips rows
  already `optimized`, so re-runs are safe.
- `DRIZZLE_TARGET`-guarded: defaults to dev; prod requires explicit
  `DRIZZLE_TARGET=prod` (per `feedback-runtime-db-env`). Reads/writes R2 via the
  same `r2Client` the orchestrator uses.

Boundary: pure operator tool. It calls the existing orchestrator; it contains no
sharp/optimization logic of its own.

## Data Flow

**Interactive retry** (prod / `pnpm dev:mobile`):
`OptimizedImage` Retry → `onRetryOptimization(id)` → `retryOptimization.mutate({ id })`
→ procedure: scope assert → `resetMediaOptimizationStatus(proposalMediaFiles, id)`
(status → `pending`; UI immediately shows "Optimizing…") →
`optimizeMediaJob.dispatch({ ownerKind: 'proposal', mediaId: id })` → QStash
callback → `optimizeMediaFile` writes `-xs/-sm/-md/-lg.webp` + status `optimized`
→ `invalidate()` refetches → `srcSet` renders.

**Backfill** (one-time, from operator machine against prod DB/R2):
script → select stuck rows → per row `optimizeMediaFile()` inline → variants +
status → summary. No QStash involved.

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
- `src/shared/entities/media-files/dal/server/queries.ts` — delete hardcoded `resetOptimizationStatus`.
- `src/trpc/routers/projects.router/media.router.ts` — migrate to the parameterized reset.
- `src/trpc/routers/proposals.router/media.router.ts` — add `retryOptimization`.
- `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts` — add client mutation.
- `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` — thread `onRetryOptimization`.
- `scripts/backfill-proposal-media-optimization.ts` — new backfill script.

## Global Constraints

- Route all writes through the DAL/service layer; no raw `db.update` for
  optimization status outside the parameterized setters (ADR-0003).
- Never set `updatedAt` by hand — `.$onUpdate()` handles it
  (`feedback-no-manual-updated-at`).
- Scripts: `import './lib/load-env'`; `DRIZZLE_TARGET=prod` is the only prod-DB
  lever; `NODE_ENV` is never hand-set (`feedback-runtime-db-env`).
- Delete dead code rather than leaving defensive back-compat; `@deprecated` only
  when a caller is outside our control (ubiquitous-language: blast radius).
- Do not modify the upload/dispatch path or `optimization-target.ts` /
  `VARIANT_REGISTRY` — they are correct.
