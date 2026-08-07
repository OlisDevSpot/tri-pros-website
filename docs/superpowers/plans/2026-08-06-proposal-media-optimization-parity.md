# Proposal Media Optimization Parity + Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give proposal media the same optimization recovery + visibility affordances project media has (a Retry lever + status UI), route all optimization operations through the `mediaService` facade, and provide an operator-run backfill that re-optimizes the stuck proposal back-catalog.

**Architecture:** The `mediaService` facade becomes the single surface for every optimization operation — `createRecord` (auto async on upload, already exists), plus two new methods `retryOptimization(store, id)` (reset status → dispatch QStash job) and `optimizeNow(store, id)` (synchronous in-process optimize, no QStash). Both routers and the backfill call the facade; nothing touches the DAL setters or the QStash job directly. A table-parameterized `resetMediaOptimizationStatus(table, id)` DAL setter backs the facade, and the now-fully-dead legacy `media-files/dal/server/queries.ts` is deleted. The proposal render/status UI is entirely reused from the existing `OptimizedImage` component — passing one prop.

**Tech Stack:** Next.js 15 · tRPC · Drizzle (Postgres/Neon) · TanStack Query · Upstash QStash (background jobs) · Cloudflare R2 · `tsx` scripts.

## Global Constraints

- **All optimization operations route through the `mediaService` facade** — no router or script calls the DAL setters (`resetMediaOptimizationStatus`) or `optimizeMediaJob` directly. The facade is the single, extensible surface (matches `createRecord`'s existing dispatch ownership).
- **The new facade methods import zero `db`.** `retryOptimization` and `optimizeNow` compose only DAL (`resetMediaOptimizationStatus`), the orchestrator (`optimizeMediaFile`), and the job (`optimizeMediaJob`) — they add no `db.*` call to `media.service.ts`. All status writes flow through the parameterized DAL setters in `optimization.ts` (ADR-0003, `services-never-import-db`).
- **Do NOT touch or refactor the pre-existing `media.service.ts` sibling methods** (`createRecord` / `removeRecord` / `reorder` / `rename` / `list`). They import `db` directly — a known, separately-tracked violation of `services-never-import-db` that is deliberately **out of scope** for this sub-plan (user decision 2026-08-06). Flag it as out-of-scope, not a defect; do not extend or fix it here.
- **Do NOT modify the upload / `createRecord` / dispatch-on-create path, or `optimization-target.ts` / `VARIANT_REGISTRY`** — they are correct and symmetric across owners.
- **Never set `updatedAt` by hand** — `.$onUpdate()` handles it (`feedback-no-manual-updated-at`).
- **Backfill script DB access:** use the `@/shared/db` singleton (template `scripts/backfill-wave2-children.ts`), NOT a hand-rolled `drizzle(pg)` connection and NOT `import './lib/load-env'` — the singleton self-resolves `DRIZZLE_TARGET` and self-loads env, and sharing it with the optimizer guarantees the SELECT and the optimize step hit one DB target. `DRIZZLE_TARGET=prod` is the only prod-DB lever; `NODE_ENV` is never hand-set (`feedback-runtime-db-env`, `environment.md#environment-axes`).
- **Delete dead code** rather than leaving defensive back-compat; `@deprecated` only when a caller is outside our control. The whole legacy `media-files/dal/server/queries.ts` goes — every export is orphaned once the project router moves to the facade.
- **Media DOCS (`services/media/DOCS.md`) update ships in this change**, not as a follow-up (Sub-plan 2 ledger ruling).
- **No unit-test runner exists.** The verification gate for every task is `pnpm tsc` + `pnpm lint` clean (`feedback-verification-workflow`). Do NOT scaffold vitest/jest tests. NEVER run `pnpm build`. Backfill validation additionally uses `--dry-run`.
- **Work on main** (project convention, user-approved for this epic): stage explicitly by path, never `git add -A`. Commit messages end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/shared/entities/media-files/dal/server/optimization.ts` | Add `resetMediaOptimizationStatus` table-parameterized setter | 1 |
| `src/shared/services/media/media.service.ts` | Add facade methods `retryOptimization` + `optimizeNow` | 1 |
| `src/trpc/routers/projects.router/media.router.ts` | Migrate `retryOptimization` onto the facade; drop dead imports | 2 |
| `src/shared/entities/media-files/dal/server/queries.ts` | **Delete** (fully dead once project router migrates) | 2 |
| `src/trpc/routers/proposals.router/media.router.ts` | Add proposal `retryOptimization` procedure via the facade | 3 |
| `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts` | Add `retryOptimization` client mutation | 3 |
| `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` | Thread `onRetryOptimization` into `OptimizedImage` | 3 |
| `scripts/backfill-proposal-media-optimization.ts` | **New** one-time operator backfill via `mediaService.optimizeNow` | 4 |
| `src/shared/services/media/DOCS.md` | Document the recovery lever | 5 |

---

## Task 1: Facade recovery surface (DAL reset setter + `retryOptimization` / `optimizeNow`)

Additive only — no existing behavior changes, no imports removed. After this task the facade exposes the recovery surface but nothing calls it yet; tsc/lint stay green.

**Files:**
- Modify: `src/shared/entities/media-files/dal/server/optimization.ts` (append one function after `setMediaOptimizationFailed`, line 41)
- Modify: `src/shared/services/media/media.service.ts` (add two imports; add two methods to the `mediaService` object)

**Interfaces:**
- Consumes: `AnyMediaTable` (existing type alias in `optimization.ts`); `MediaStore` (from `./stores`, carries `ownerKind` + `table`); `optimizeMediaJob` (already imported in `media.service.ts`); `optimizeMediaFile({ ownerKind, mediaId }): Promise<void>` (from `./optimize-media`).
- Produces:
  - `resetMediaOptimizationStatus(table: AnyMediaTable, id: number): Promise<void>` — sets `optimizationStatus: 'pending'`.
  - `mediaService.retryOptimization(store: MediaStore, mediaId: number): Promise<void>` — reset then dispatch.
  - `mediaService.optimizeNow(store: MediaStore, mediaId: number): Promise<void>` — synchronous optimize, returns the orchestrator's promise.

- [ ] **Step 1: Add the parameterized reset setter to `optimization.ts`**

Append after line 41 (after `setMediaOptimizationFailed`):

```ts
export async function resetMediaOptimizationStatus(table: AnyMediaTable, id: number): Promise<void> {
  await db.update(table).set({ optimizationStatus: 'pending' }).where(eq(table.id, id))
}
```

`db` and `eq` are already imported at the top of the file. Follows the exact shape of the three existing setters.

- [ ] **Step 2: Add the two new imports to `media.service.ts`**

At the top of `src/shared/services/media/media.service.ts`, add these two imports alongside the existing ones (after line 6, the `optimizeMediaJob` import):

```ts
import { resetMediaOptimizationStatus } from '@/shared/entities/media-files/dal/server/optimization'
import { optimizeMediaFile } from './optimize-media'
```

No import cycle: `optimize-media.ts` does not import `media.service.ts` (verified — it imports only the DAL setters, the variant registry, the optimizer, `r2Client`, and `optimization-target`).

- [ ] **Step 3: Add `retryOptimization` and `optimizeNow` to the `mediaService` object**

Inside the `mediaService` object (`media.service.ts`), after the existing `list` method (line 53, before the closing `}`), add:

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

Do NOT modify `createRecord`, `removeRecord`, `reorder`, `rename`, or `list` — they are out of scope (see Global Constraints).

- [ ] **Step 4: Verify tsc + lint**

Run: `pnpm tsc`
Expected: clean (0 errors). The new setter and methods compile; no existing consumer touched.

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/media-files/dal/server/optimization.ts src/shared/services/media/media.service.ts
git commit -m "feat(media): add facade retryOptimization/optimizeNow + reset DAL setter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Migrate project router to the facade + delete dead legacy `queries.ts`

The project router's `retryOptimization` currently calls `resetOptimizationStatus` (from the legacy `queries.ts`) and dispatches `optimizeMediaJob` directly. Rewrite it to call the facade, then delete the legacy file. These MUST land together: deleting `queries.ts` breaks the project router's line-8 import until the migration removes it, and the migration removes the file's last consumer. tsc is green only after both.

**Blast radius (verified by project-wide sweep, 2026-08-06):** the only import from `media-files/dal/server/queries` anywhere is the project router (line 8). Every other export of that file (`getMediaFileById`, `setOptimizationProcessing/Complete/Failed`, the `MediaFile` re-export) has zero repo-wide consumers — superseded by the table-parameterized setters in `optimization.ts` that `optimize-media.ts` imports. No scripts, tests, or docs reference any of it.

**Files:**
- Modify: `src/trpc/routers/projects.router/media.router.ts` (rewrite `retryOptimization` body at lines 44-50; drop imports at lines 8 and 14)
- Delete: `src/shared/entities/media-files/dal/server/queries.ts` (whole file)

**Interfaces:**
- Consumes: `mediaService.retryOptimization(store, mediaId)` (Task 1); `projectMediaStore` (already imported in this router, line 11).
- Produces: no new exports. Behavior of the `retryOptimization` procedure is unchanged (reset → dispatch); only the layering moves behind the facade.

- [ ] **Step 1: Rewrite the project `retryOptimization` procedure body**

In `src/trpc/routers/projects.router/media.router.ts`, replace the current procedure (lines 44-50):

```ts
  retryOptimization: agentProcedure
    .input(z.object({ mediaFileId: z.number() }))
    .mutation(async ({ input }) => {
      await resetOptimizationStatus(input.mediaFileId)
      void optimizeMediaJob.dispatch({ ownerKind: 'project', mediaId: input.mediaFileId })
      return { success: true }
    }),
```

with:

```ts
  retryOptimization: agentProcedure
    .input(z.object({ mediaFileId: z.number() }))
    .mutation(async ({ input }) => {
      await mediaService.retryOptimization(projectMediaStore, input.mediaFileId)
      return { success: true }
    }),
```

The input key stays `mediaFileId` (unchanged public contract — the client already sends it). `mediaService` and `projectMediaStore` are already imported (lines 10-11).

- [ ] **Step 2: Remove the two now-dead imports**

In the same file, delete line 8:

```ts
import { resetOptimizationStatus } from '@/shared/entities/media-files/dal/server/queries'
```

and delete line 14:

```ts
import { optimizeMediaJob } from '@/shared/services/providers/upstash/jobs/optimize-media'
```

Leave every other import untouched (`db`, schema, `deriveOriginalMediaUrl`/`getOptimizedSrc`, `mediaService`, `projectMediaStore`, `r2Client`, `R2_PUBLIC_DOMAINS` are all still used elsewhere in the file — confirm `optimizeMediaJob` had no other use before removing; the sweep confirms line 48 was its sole use).

- [ ] **Step 3: Delete the legacy `queries.ts` file**

```bash
git rm src/shared/entities/media-files/dal/server/queries.ts
```

- [ ] **Step 4: Verify tsc + lint**

Run: `pnpm tsc`
Expected: clean. If tsc reports an unresolved import of `.../media-files/dal/server/queries` anywhere, the sweep missed a consumer — STOP and report it (do not re-create the file); it means a hidden consumer exists that the plan must account for.

Run: `pnpm lint`
Expected: clean (no unused-import warnings for the two removed imports).

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/projects.router/media.router.ts src/shared/entities/media-files/dal/server/queries.ts
git commit -m "refactor(media): route project retryOptimization through facade; delete dead queries.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Proposal retry — procedure + client mutation + UI thread

The full proposal-side recovery affordance as one vertical slice: a `retryOptimization` tRPC procedure (facade-backed, with proposal authz), a client mutation wired to invalidate the media list, and the one-prop UI thread that lights up the existing `OptimizedImage` status badges + Retry button.

**Files:**
- Modify: `src/trpc/routers/proposals.router/media.router.ts` (add `retryOptimization` procedure inside `createProposalMediaRouter`)
- Modify: `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts` (add mutation + return it)
- Modify: `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` (add `onRetryOptimization` prop to `OptimizedImage`)

**Interfaces:**
- Consumes: `mediaService.retryOptimization(store, id)` (Task 1); `proposalMediaStore`, `assertCanUpdate`, `assertProposalMediaInScope` (all already imported/defined in the proposal router); `OptimizedImage`'s `onRetryOptimization?: (mediaFileId: number) => void` prop (already exists, `optimized-image.tsx:27`).
- Produces: `proposalsRouter.media.retryOptimization` procedure with input `{ id: number }` returning `{ success: true }`; `useProposalMedia(...).retryOptimization` mutation (call as `.mutate({ id })`).

- [ ] **Step 1: Add the proposal `retryOptimization` procedure**

In `src/trpc/routers/proposals.router/media.router.ts`, inside the `createTRPCRouter({ ... })` returned by `createProposalMediaRouter`, add this procedure after the existing `delete` procedure (after line 93):

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

No new imports needed — `mediaService`, `proposalMediaStore`, `assertCanUpdate` (local function), and `assertProposalMediaInScope` are all already present. The input key is `id` (proposal router convention), unlike the project router's `mediaFileId`.

- [ ] **Step 2: Verify the procedure typechecks**

Run: `pnpm tsc`
Expected: clean. The new procedure appears on `trpc.proposalsRouter.media.retryOptimization` for the client in the next step.

- [ ] **Step 3: Add the client mutation**

In `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts`, add the mutation after the `remove` mutation (line 17):

```ts
  const retryOptimization = useMutation(trpc.proposalsRouter.media.retryOptimization.mutationOptions({ onSuccess: invalidate }))
```

Then add `retryOptimization` to the returned object (line 19):

```ts
  return { getUploadUrl, create, setVisibility, reorder, rename, remove, retryOptimization, invalidate, listKey }
```

`invalidate` already targets the proposal media `list` query key.

- [ ] **Step 4: Thread the prop into `OptimizedImage`**

In `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx`, inside `renderThumbnail`, the image branch currently renders (lines 87-88):

```tsx
          if (item.mimeType.startsWith('image/') && row) {
            return <OptimizedImage file={row} alt={item.name} sizes="(max-width: 768px) 45vw, 220px" />
          }
```

Replace that `<OptimizedImage .../>` with:

```tsx
            return (
              <OptimizedImage
                file={row}
                alt={item.name}
                sizes="(max-width: 768px) 45vw, 220px"
                onRetryOptimization={id => media.retryOptimization.mutate({ id })}
              />
            )
```

`media` is the `useProposalMedia(proposalId)` return (line 39), now carrying `retryOptimization`. Passing the prop is the entire UI change — `OptimizedImage` renders the "Optimizing…" spinner while processing and the "Retry" button while failed, **only when `onRetryOptimization` is present** (`optimized-image.tsx:124-145`). No new markup.

- [ ] **Step 5: Verify tsc + lint**

Run: `pnpm tsc`
Expected: clean.

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/proposals.router/media.router.ts src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx
git commit -m "feat(proposal-media): retryOptimization procedure + mutation + manager UI thread

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backfill script — re-optimize the stuck proposal back-catalog

One-time, operator-run, idempotent, re-runnable. Selects stuck proposal media rows via the `@/shared/db` singleton and re-optimizes each synchronously through `mediaService.optimizeNow` (no QStash). Modeled on `scripts/backfill-wave2-children.ts` for DB access, `--dry-run`, and `DRIZZLE_TARGET` handling.

**Files:**
- Create: `scripts/backfill-proposal-media-optimization.ts`

**Interfaces:**
- Consumes: `db` (from `@/shared/db`); `proposalMediaFiles` (from `@/shared/db/schema`); `mediaService.optimizeNow` (Task 1); `proposalMediaStore` (from `@/shared/services/media/stores`); `describeTargetDb` (from `./lib/describe-target-db`, used by the template).
- Produces: an executable `tsx` script. No exports.

- [ ] **Step 1: Write the backfill script**

Create `scripts/backfill-proposal-media-optimization.ts`:

```ts
/* eslint-disable no-console */
// One-time backfill: re-optimize stuck proposal media (Sub-plan 2.1).
//
// Proposal images/PDFs whose optimize job never completed (dev-without-tunnel,
// a transient QStash/R2 error → 'failed', or rows predating the generic-dispatch
// refactor) sit at optimizationStatus <> 'optimized' with no responsive variants.
// This re-runs the SYNCHRONOUS optimizer (mediaService.optimizeNow → optimizeMediaFile)
// per row — no QStash callback, so it works from a plain operator machine.
//
// Idempotent: the orchestrator skips rows already 'optimized' and sets
// 'processing' → 'optimized'/'failed' itself. Re-run = verify/repair.
//
// DB target: DRIZZLE_TARGET=prod for prod; default = dev/worktree. Deliberately
// the app's `@/shared/db` singleton (self-resolves DRIZZLE_TARGET, self-loads
// .env.local) — sharing it with the optimizer guarantees the SELECT and the
// optimize step hit ONE database. NOT a hand-rolled connection, NOT load-env.
// see docs/codebase-conventions/environment.md#environment-axes
import process from 'node:process'
import { and, eq, isNotNull, like, ne, or } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema'
import { mediaService } from '@/shared/services/media/media.service'
import { proposalMediaStore } from '@/shared/services/media/stores'
import { describeTargetDb } from './lib/describe-target-db'

const DRY_RUN = process.argv.includes('--dry-run')

async function selectStuck() {
  return db
    .select({ id: proposalMediaFiles.id, optimizationStatus: proposalMediaFiles.optimizationStatus })
    .from(proposalMediaFiles)
    .where(and(
      or(like(proposalMediaFiles.mimeType, 'image/%'), eq(proposalMediaFiles.mimeType, 'application/pdf')),
      ne(proposalMediaFiles.optimizationStatus, 'optimized'),
      isNotNull(proposalMediaFiles.pathKey),
      isNotNull(proposalMediaFiles.bucket),
    ))
}

async function main() {
  const { env, host } = describeTargetDb()
  console.log(`[backfill-proposal-media-optimization] ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`DB target: ${env}`)
  console.log(`DB host:  ${host}`)

  const stuck = await selectStuck()

  if (DRY_RUN) {
    const byStatus = stuck.reduce<Record<string, number>>((acc, r) => {
      acc[r.optimizationStatus] = (acc[r.optimizationStatus] ?? 0) + 1
      return acc
    }, {})
    console.log(`stuck rows: ${stuck.length}`)
    for (const [status, count] of Object.entries(byStatus))
      console.log(`  ${status}: ${count}`)
    process.exit(0)
  }

  let optimized = 0
  let failed = 0
  for (const row of stuck) {
    try {
      await mediaService.optimizeNow(proposalMediaStore, row.id)
      optimized++
    }
    catch (err) {
      failed++
      console.error(`✗ proposal media ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`done: optimized=${optimized} failed=${failed} (of ${stuck.length})`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Note: `optimizeMediaFile` self-contains its own errors and sets `optimizationStatus: 'failed'` — the try/catch here is a belt-and-suspenders guard for unexpected throws so one bad row never aborts the run; a caught row still counts as `failed`.

- [ ] **Step 2: Verify tsc + lint**

Run: `pnpm tsc`
Expected: clean.

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Verify the dry-run executes and reports (against dev)**

Run: `pnpm tsx scripts/backfill-proposal-media-optimization.ts --dry-run`
Expected: prints `DRY RUN`, the dev DB target/host, a `stuck rows: <n>` line, and a per-status breakdown, then exits 0 **without mutating**. This is the diagnostic that reveals whether a real backlog exists. (Zero stuck rows is a valid, passing result — it exits 0 with `stuck rows: 0`.)

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-proposal-media-optimization.ts
git commit -m "feat(scripts): backfill re-optimizes stuck proposal media via facade optimizeNow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Operator note (NOT part of the implementation gate):** the live backfill is run by the operator, not the implementer. Live run against dev: `pnpm tsx scripts/backfill-proposal-media-optimization.ts`. Against prod (only when explicitly intended): `DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-proposal-media-optimization.ts`. The implementer stops at the passing `--dry-run`.

---

## Task 5: Document the recovery lever in `services/media/DOCS.md`

The `#optimize-dispatch-chain` section documents create→dispatch but has no entry for the recovery surface. Add a short note documenting the facade's two recovery entrypoints and that all optimization operations route through `mediaService`. This also back-fills the previously-undocumented project retry. Ships in this change (Sub-plan 2 ledger ruling), not as a follow-up.

**Files:**
- Modify: `src/shared/services/media/DOCS.md` (add a subsection near `#optimize-dispatch-chain`)

**Interfaces:**
- Consumes: nothing (documentation).
- Produces: nothing (documentation).

- [ ] **Step 1: Read the current DOCS to find the anchor**

Run: `grep -n "optimize-dispatch-chain" src/shared/services/media/DOCS.md`
Expected: locates the `#optimize-dispatch-chain` heading. Read the surrounding section so the new note matches the file's heading style and anchor conventions.

- [ ] **Step 2: Add the recovery-lever note**

Immediately after the `#optimize-dispatch-chain` section's body, add:

```markdown
### Optimization recovery lever {#optimize-recovery-lever}

All optimization operations route through the `mediaService` facade — there are
three coherent entrypoints on one object, and no router or script touches the
DAL setters or `optimizeMediaJob` directly:

- `createRecord(store, values)` — auto-dispatches the optimize job for a new
  image/pdf upload (async, via QStash).
- `retryOptimization(store, mediaId)` — resets the row to `pending` (via the
  `resetMediaOptimizationStatus` DAL setter) and re-dispatches the job. Backs the
  interactive **Retry** button on both project and proposal media managers.
- `optimizeNow(store, mediaId)` — runs `optimizeMediaFile` **synchronously**,
  in-process, with no QStash callback. Used by the operator backfill
  (`scripts/backfill-proposal-media-optimization.ts`) and dev, where a QStash
  callback to `localhost` cannot be delivered.

The async paths (`createRecord`, `retryOptimization`) rely on a QStash-reachable
callback URL; in plain `pnpm dev` (no tunnel) the callback targets `localhost`
and the row stays `pending`. `optimizeNow` is the dev/operator-safe path.
```

- [ ] **Step 3: Verify no build tooling is needed (docs only)**

Run: `pnpm lint`
Expected: clean (lint does not fail on Markdown, but confirms nothing else regressed). No `pnpm tsc` change expected — no code touched.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/media/DOCS.md
git commit -m "docs(media): document facade optimization recovery lever

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (spec Units 1–8 → tasks):
- Unit 1 (reset DAL setter + delete `queries.ts`) → Task 1 (setter) + Task 2 (delete, sequenced after the project-router migration that frees it). ✓
- Unit 2 (facade `retryOptimization` + `optimizeNow`) → Task 1. ✓
- Unit 3 (project router → facade) → Task 2. ✓
- Unit 4 (proposal procedure) → Task 3 Step 1. ✓
- Unit 5 (client mutation) → Task 3 Step 3. ✓
- Unit 6 (UI thread) → Task 3 Step 4. ✓
- Unit 7 (backfill script) → Task 4. ✓
- Unit 8 (DOCS note) → Task 5. ✓

**Placeholder scan:** no TBD/TODO/"handle edge cases"/"similar to Task N" — every code step carries the literal code. ✓

**Type consistency:** `resetMediaOptimizationStatus(table, id)` defined in Task 1, consumed by the facade in Task 1 and (transitively) the routers in Tasks 2–3. Facade `retryOptimization(store, mediaId)` / `optimizeNow(store, mediaId)` defined Task 1, consumed Tasks 2 (`projectMediaStore`, `mediaFileId`), 3 (`proposalMediaStore`, `id`), 4 (`optimizeNow`). Project procedure input key `mediaFileId` (unchanged) vs proposal input key `id` — intentional per each router's existing convention, verified against both files. `onRetryOptimization: (mediaFileId: number) => void` matches the existing `OptimizedImage` prop signature. ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-06-proposal-media-optimization-parity.md`.
