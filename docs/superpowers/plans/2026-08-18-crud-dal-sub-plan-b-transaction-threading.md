# Sub-plan B — Transaction Threading (`tx`-on-`ctx`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make atomicity a DAL-boundary capability — an optional `tx` rides on `ScopedContext`, every `createCrudDal` impl executes on `(ctx.tx ?? db)`, and a `withTx` helper lets an orchestrator open one transaction and thread it through many `crud.*` calls.

**Architecture:** Extend existing primitives, create nothing new beyond the one helper decision 5.6 already blessed. `ScopedContext` gains one optional field `tx?: Tx`; the four direct-`db` impls read `const exec = ctx.tx ?? db`; `withTx` reuses an ambient `ctx.tx` or opens a fresh `db.transaction` (never nests → no savepoints). The rollback boundary reuses `dalVerifySuccess` to re-throw a swallowed `DalError` inside the `withTx` callback so Drizzle aborts. B is **behaviorally inert on `main`** (tx always absent outside the throwaway proof) — it adds a capability and proves it; adoption is D.

**Tech Stack:** TypeScript, Drizzle ORM (node-postgres), Neon Postgres, tRPC, better-auth. No test runner in repo → verification is `pnpm tsc` + `pnpm lint` + a throwaway `pnpm tsx` proof script against the **dev DB**.

**Spec:** [docs/superpowers/specs/2026-08-18-crud-dal-sub-plan-b-transaction-threading-design.md](../specs/2026-08-18-crud-dal-sub-plan-b-transaction-threading-design.md)

## Global Constraints

Every task implicitly includes these (verbatim from the spec and repo conventions):

- **Extend, don't create.** Reuse `db.transaction` (Drizzle), `DbOrTx` (already in `src/shared/db/index.ts`), `dalVerifySuccess` + `dalDbOperation` (already built for DAL-to-DAL composition). The only new symbol is `withTx`.
- **No savepoints.** `withTx` REUSES `ctx.tx` when present (never calls `tx.transaction()`). The whole cascade is one flat atomic unit. Savepoints/partial-rollback are YAGNI.
- **Behavioral inertness.** With `ctx.tx` absent on every shipped path, `exec = ctx.tx ?? db` is always `db`. No runtime behavior changes. Do not introduce any live `withTx` caller in B (first lands in D).
- **`dalDbOperation` is UNCHANGED.** Its swallow-and-return logic stays exactly as-is; the rollback boundary is built on top of it via `dalVerifySuccess`, not by modifying it.
- **Interim/deferred pieces carry markers.** Every temporary or deferred artifact gets a `TEMPORARY UNTIL <phase>` annotation on its plan task and an in-code `INTERIM(C):` marker where the spec's §5 ledger says so. After B, `grep -rn "INTERIM(C)"` returns exactly two locations: `withTx`'s JSDoc and `meetings/dal/server/crud.ts`.
- **Dev DB only.** The throwaway proof script starts with `import './lib/load-env'` and runs against the dev DB. NEVER `DRIZZLE_TARGET=prod`. It has no QStash side-effects, so plain `pnpm tsx` suffices (no tunnel).
- **Verification, never build.** Verify with `pnpm tsc` + `pnpm lint`. NEVER `pnpm build`.
- **Staging discipline.** Work on `main`. Stage explicitly by path. NEVER `git add -A`. The throwaway proof script is never committed (it stays untracked like the repo's other `scripts/tmp-*.ts`, and is deleted at the end of B).
- **⚠️ #285 coordination.** #285 (CASL scope-compiler) also edits `ScopedContext`/`EntityServerSpec` in `src/shared/dal/server/types.ts` (it strips `visibility`; B adds `tx?`). Disjoint fields, mechanical merge conflict for whichever lands second — rebase the loser. #285 never touches `tx` / `create-crud-dal.ts` / `withTx`.

---

### Task 1: `Tx` type export + `ScopedContext.tx?`

Add the transaction-arm type and thread it onto the context. This is the type surface every other task consumes.

**Files:**
- Modify: `src/shared/db/index.ts:35` (add `Tx` export beside `DbOrTx`)
- Modify: `src/shared/dal/server/types.ts:12` (import `Tx`), `:31-35` (add field to `ScopedContext`)

**Interfaces:**
- Produces: `export type Tx` from `@/shared/db` — the transaction-callback arm, `Parameters<Parameters<DB['transaction']>[0]>[0]`.
- Produces: `ScopedContext.tx?: Tx` — present ⇒ run on the caller's ambient tx; absent ⇒ autocommit on `db`. `SYSTEM_CONTEXT` is unchanged (field simply absent).

- [ ] **Step 1: Add the `Tx` export**

In `src/shared/db/index.ts`, immediately after the `DbOrTx` line (`export type DbOrTx = ...`), add:

```ts
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
```

(`DbOrTx` already spells this same arm inline — `Tx` names it so `ScopedContext` and `create-crud-dal` can refer to it directly.)

- [ ] **Step 2: Import `Tx` into the DAL types module**

In `src/shared/dal/server/types.ts`, add a type-only import (keep it erasable — no runtime cycle into `@/shared/db`'s Pool/drizzle):

```ts
import type { Insert, Row, Update } from '@/shared/db/types'
import type { Tx } from '@/shared/db'
```

- [ ] **Step 3: Add `tx?` to `ScopedContext`**

Replace the `ScopedContext` interface body so it gains the optional field (keep the existing doc comment above it):

```ts
export interface ScopedContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  scope: SQL | null
  /** Present ⇒ run on the caller's ambient transaction (composed atomicity). Absent ⇒ autocommit on `db`. Threaded via `withTx` (see dal/server/lib/helpers.ts). */
  tx?: Tx
}
```

Leave `SYSTEM_CONTEXT` (just below) untouched — `tx` is optional, so `{ session: null, ability: null, scope: null }` still satisfies it.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc`
Expected: PASS — `Tx` resolves; every existing `ScopedContext` literal (including `SYSTEM_CONTEXT` and `buildUserContext`) still compiles because `tx` is optional.

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/index.ts src/shared/dal/server/types.ts
git commit -m "feat(dal): Tx type + optional ScopedContext.tx (crud-dal sub-plan B)"
```

---

### Task 2: `withTx` reuse-or-open helper

Add the one new primitive: the threading vehicle. Reuse-or-open by construction (no savepoints), thin passthrough (does not wrap in `dalDbOperation` — that stays the caller's boundary).

**Files:**
- Modify: `src/shared/dal/server/lib/helpers.ts` (add `db` import; add `withTx` beside `dalDbOperation`)

**Interfaces:**
- Consumes: `ScopedContext` (already imported in this module), `db` from `@/shared/db`.
- Produces: `export async function withTx<T>(ctx: ScopedContext, fn: (ctx: ScopedContext) => Promise<T>): Promise<T>` — runs `fn` on the ambient tx if `ctx.tx` is present, else opens a fresh `db.transaction` and hands `fn` a tx-bound ctx.

- [ ] **Step 1: Add the `db` runtime import**

In `src/shared/dal/server/lib/helpers.ts`, add to the import block (this module currently imports only types + `resolveEffectiveScope`; `@/shared/db` imports schema+env, not helpers — no cycle):

```ts
import { db } from '@/shared/db'
```

- [ ] **Step 2: Add `withTx` beside `dalDbOperation`**

Immediately after the `dalDbOperation` function (before the `// ── Context Builders ──` banner), add:

```ts
// ── withTx ────────────────────────────────────────────────────────────────

/**
 * Run `fn` inside a transaction. If `ctx` already carries an ambient tx, REUSE
 * it (no nesting, no savepoint) — the callback runs on the same tx so the whole
 * composed operation is one atomic unit. Otherwise open a fresh tx and hand the
 * callback a tx-bound ctx.
 *
 * Ownership (epic §5.6): the OUTERMOST caller (tRPC procedure / service / job)
 * owns the transaction; nested `withTx` calls flatten onto it. Compose failing
 * `crud.*` calls with `dalVerifySuccess` so a failure aborts the tx — a bare
 * `await crud.*` swallows its DalError (dalDbOperation catches it) and the tx
 * would commit partial state on the business-precondition (not-found) case.
 *
 * ⚠️ INTERIM(C): until `afterCommit` lands (sub-plan C), do NOT thread this tx
 * into a `crud.*` whose `after` hook dispatches a QStash/Ably job — the dispatch
 * would run PRE-COMMIT. C relocates those dispatches to `afterCommit`. See the
 * Cross-Phase Ledger in the sub-plan B design spec.
 */
export async function withTx<T>(
  ctx: ScopedContext,
  fn: (ctx: ScopedContext) => Promise<T>,
): Promise<T> {
  if (ctx.tx)
    return fn(ctx)
  return db.transaction(tx => fn({ ...ctx, tx }))
}
```

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc`
Expected: PASS — `db.transaction`'s callback param type matches `Tx`; `{ ...ctx, tx }` satisfies `ScopedContext`. No import cycle.

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Confirm the `INTERIM(C)` marker is grep-visible**

Run: `grep -rn "INTERIM(C)" src/`
Expected: exactly one hit so far — the `withTx` JSDoc line. (The second location, meetings, is added in Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/lib/helpers.ts
git commit -m "feat(dal): withTx reuse-or-open helper, no savepoints (crud-dal sub-plan B)"
```

---

### Task 3: `exec = ctx.tx ?? db` across the four direct-`db` impls

Swap the module-level `db` singleton for `const exec = ctx.tx ?? db` in every impl that touches `db` directly — the write AND every internal read-prefetch, so a prefetched row is read inside the same tx as the write it guards. `duplicateImpl` is intentionally NOT edited (it has no direct `db` call — it composes `getByIdImpl` + `createImpl`, both of which already read `ctx.tx ?? db`; it inherits the seam through the shared `ctx`).

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts` — `getByIdImpl` (~line 116), `createImpl` (~line 136), `updateImpl` (~line 169), `deleteImpl` (~line 240)

**Interfaces:**
- Consumes: `ScopedContext.tx?: Tx` (Task 1). `db` is already imported at `create-crud-dal.ts:46`.
- Produces: no signature change. All five `crud.*` handlers now execute on `ctx.tx ?? db`; `getByIdImpl` reading the seam is what makes `updateImpl`/`deleteImpl`/`duplicateImpl` prefetches join the tx automatically.

- [ ] **Step 1: Thread `exec` in `getByIdImpl`**

Replace the `dalDbOperation` body (lines ~116-124) so the read runs on `exec`:

```ts
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [row] = await exec
      .select()
      .from(spec.table as PgTable)
      .where(where)
      .limit(1)
    return row as Row<TTable> | undefined
  })
```

- [ ] **Step 2: Thread `exec` in `createImpl`**

Inside `createImpl`'s `dalDbOperation` callback, add `const exec = ctx.tx ?? db` as the first line, then change the insert (line ~144) from `db.insert(...)` to `exec.insert(...)`:

```ts
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    let data = input
    // ...existing before-hook + validate lines unchanged...
    const [inserted] = await exec.insert(spec.table as PgTable).values(validated).returning()
    // ...rest unchanged...
```

- [ ] **Step 3: Thread `exec` in `updateImpl`**

Inside `updateImpl`'s `dalDbOperation` callback, add `const exec = ctx.tx ?? db` as the first line, then change the real write (line ~214) from `db.update(...)` to `exec.update(...)`:

```ts
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    // before-hooks, validate, G7 empty-case getById, previousRow prefetch — ALL unchanged
    // (the internal getByIdImpl calls read ctx.tx ?? db themselves, so they join the tx)
    // ...
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [updated] = await exec.update(spec.table as PgTable).set(validated as Record<string, unknown>).where(where).returning()
    // ...rest unchanged...
```

Do NOT alter the two `getByIdImpl(spec, pkColumn, ctx, { id: input.id })` calls (G7 empty-case at ~184, previousRow prefetch at ~198) — they pass `ctx` down and inherit `exec` through Step 1.

- [ ] **Step 4: Thread `exec` in `deleteImpl`**

Inside `deleteImpl`'s `dalDbOperation` callback, add `const exec = ctx.tx ?? db` as the first line, then change the delete (line ~265) from `db.delete(...)` to `exec.delete(...)`:

```ts
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    // needsRow prefetch via getByIdImpl(spec, pkColumn, ctx, ...) — unchanged, inherits exec
    // before-hooks — unchanged
    // ...
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const deleted = await exec.delete(spec.table as PgTable).where(where).returning({ id: pkColumn })
    // ...rest unchanged...
```

Leave the `getByIdImpl(...)` prefetch (~246) as-is (inherits `exec` via Step 1). Leave `duplicateImpl` entirely unchanged — verify it still has zero `db.` references after this task.

- [ ] **Step 5: Confirm no stray `db.` write/read remains in the impls**

Run: `grep -n "db\.\(select\|insert\|update\|delete\)" src/shared/dal/server/lib/create-crud-dal.ts`
Expected: **no matches** (every impl now uses `exec.`; `synthesizeFromSpec` has no `db.*` calls; `duplicateImpl` composes other impls).

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc`
Expected: PASS — `exec` is `Tx | DB` (= `DbOrTx`), and `.select/.insert/.update/.delete` exist on both arms (proven by `participants.ts:172`).

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "feat(dal): exec = ctx.tx ?? db across crud impls + prefetches (crud-dal sub-plan B)"
```

---

### Task 4: Meetings `INTERIM(C):` dispatch-site markers (comment-only, TEMPORARY UNTIL C)

**TEMPORARY UNTIL C.** Comment-only breadcrumb, ZERO behavior change. Registers the meetings `after`-hook job/realtime dispatch sites that must move to `afterCommit` in Sub-plan C, and the `addParticipant` off-tx write that D must thread. This is the second (and final) `INTERIM(C):` location — C's done-when asserts `grep -rn "INTERIM(C)"` is empty after it relocates these.

> Note on spec §6: the "Files touched" list omits this file and says "no service touched" — meaning no *behavioral* change. The §5 ledger, §7 done-when(4), and §9(4) require this comment-only marker; those win. If you also want the spec tightened, that's a one-line clarification to §6, not a code change.

**Files:**
- Modify: `src/shared/entities/meetings/dal/server/crud.ts` (add one block comment inside the `create` hook group; no code moves)

**Interfaces:**
- Consumes: nothing. Produces: nothing executable — a grep-able marker only.

- [ ] **Step 1: Add the `INTERIM(C):` block comment**

In `src/shared/entities/meetings/dal/server/crud.ts`, immediately inside the `hooks:` object (just above `create: {` at line ~22), insert a single consolidated marker so one grep hit covers every deferred site:

```ts
    // ── INTERIM(C): pre-commit side-effects to relocate to `afterCommit` ──────
    // These `after`-hook dispatches currently run inline (fine today: no crud.*
    // call threads a tx into meetings). When D adopts a tx-carrying ctx here,
    // they would fire PRE-COMMIT. Sub-plan C moves them to `afterCommit`; D then
    // threads `ctx.tx ?? db` into the off-tx writes below. Sites:
    //   • create.after: syncMeetingToGcalJob, graduateFromCampaignJob, metaCapiEventJob
    //   • create.after: addParticipant(...) — writes OFF-tx (needs executor in D)
    //   • update.after: syncMeetingToGcalJob, notifyMeetingTimeChangedJob, ably.publish
    // Retired by C (dispatches) + D (addParticipant executor). See sub-plan B ledger.
```

Change nothing else in the file — every dispatch and the `addParticipant` call stay exactly where they are.

- [ ] **Step 2: Confirm both `INTERIM(C)` locations are present, and only those two**

Run: `grep -rln "INTERIM(C)" src/`
Expected: exactly two files — `src/shared/dal/server/lib/helpers.ts` (Task 2) and `src/shared/entities/meetings/dal/server/crud.ts` (this task).

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (comment-only edit).

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/dal/server/crud.ts
git commit -m "docs(meetings): INTERIM(C) markers for pre-commit dispatch sites (crud-dal sub-plan B)"
```

---

### Task 5: Prove the mechanism (throwaway script) + full green + dispose

Prove all three guarantees on the dev DB with a throwaway script, then delete it. The script is NEVER committed (untracked, like the repo's other `scripts/tmp-*.ts`) and is disposed at the end of B per the spec's cleanup ledger.

**Files:**
- Create (throwaway, uncommitted): `scripts/tmp-verify-crud-b.ts`
- Delete at end of task: `scripts/tmp-verify-crud-b.ts`

**Interfaces:**
- Consumes: `withTx`, `dalVerifySuccess` (helpers), `SYSTEM_CONTEXT` (types), `voipDidCrud` (`src/shared/entities/voip-dids/dal/server/crud.ts` — hook-free, job-free), `db` + `voipDids` schema for out-of-band assertions.

- [ ] **Step 1: Write the throwaway proof script**

Create `scripts/tmp-verify-crud-b.ts` (note: `load-env` import MUST be first; runs against dev DB; unique `e164`/`providerDidId` per run; cleans up committed rows in `finally`):

```ts
import './lib/load-env'

import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema'
import { dalDbOperation, dalVerifySuccess, withTx } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { voipDidCrud } from '@/shared/entities/voip-dids/dal/server/crud'

const stamp = Date.now()
const tag = (n: string) => `crud-b-${stamp}-${n}`
const rowByE164 = (e164: string) => db.select().from(voipDids).where(eq(voipDids.e164, e164))

async function main() {
  // ── 1. Rollback under forced mid-cascade failure (the done-when) ──────────
  // create A (succeeds) then delete a nonexistent id (business-precondition
  // not-found — Postgres does NOT self-abort on it). dalVerifySuccess re-throws
  // the swallowed DalError inside the withTx callback → Drizzle rolls back A.
  const e164A = tag('rollbackA')
  const result = await dalDbOperation(() =>
    withTx(SYSTEM_CONTEXT, async (txCtx) => {
      dalVerifySuccess(await voipDidCrud.create(txCtx, { e164: e164A, providerDidId: tag('rollbackA-pid') }))
      dalVerifySuccess(await voipDidCrud.delete(txCtx, { id: '00000000-0000-0000-0000-000000000000' }))
      return 'unreachable'
    }),
  )
  const rolledBack = (await rowByE164(e164A)).length === 0
  console.log('[1] rollback: result.success =', result.success, '(expect false);  row A absent =', rolledBack, '(expect true)')
  if (result.success || !rolledBack)
    throw new Error('ROLLBACK PROOF FAILED — partial state committed')

  // ── 2. Happy-path reuse + flat nesting ────────────────────────────────────
  const e164B = tag('happyB')
  const e164C = tag('happyC')
  const happy = await dalDbOperation(() =>
    withTx(SYSTEM_CONTEXT, async (txCtx) => {
      dalVerifySuccess(await voipDidCrud.create(txCtx, { e164: e164B, providerDidId: tag('happyB-pid') }))
      // nested withTx REUSES txCtx.tx — same tx, no savepoint
      await withTx(txCtx, async (inner) => {
        if (inner.tx !== txCtx.tx)
          throw new Error('nested withTx did NOT reuse the ambient tx')
        dalVerifySuccess(await voipDidCrud.create(inner, { e164: e164C, providerDidId: tag('happyC-pid') }))
      })
      return 'ok'
    }),
  )
  const bothPersist = (await rowByE164(e164B)).length === 1 && (await rowByE164(e164C)).length === 1
  console.log('[2] happy-path: success =', happy.success, '(expect true);  both rows persist =', bothPersist, '(expect true)')
  if (!happy.success || !bothPersist)
    throw new Error('HAPPY-PATH PROOF FAILED')

  // ── 3. Standalone (tx absent) still autocommits ───────────────────────────
  const e164D = tag('standaloneD')
  const standalone = await voipDidCrud.create(SYSTEM_CONTEXT, { e164: e164D, providerDidId: tag('standaloneD-pid') })
  const persists = (await rowByE164(e164D)).length === 1
  console.log('[3] standalone: success =', standalone.success, '(expect true);  row persists =', persists, '(expect true)')
  if (!standalone.success || !persists)
    throw new Error('STANDALONE PROOF FAILED')

  console.log('\nALL PROOFS PASSED ✅')
}

main()
  .catch((e) => {
    console.error('PROOF SCRIPT FAILED ❌', e)
    process.exitCode = 1
  })
  .finally(async () => {
    // Dispose every committed test row (rollback row A never persisted).
    await db.delete(voipDids).where(eq(voipDids.e164, tag('happyB')))
    await db.delete(voipDids).where(eq(voipDids.e164, tag('happyC')))
    await db.delete(voipDids).where(eq(voipDids.e164, tag('standaloneD')))
  })
```

- [ ] **Step 2: Run the proof against the dev DB**

Run: `pnpm tsx scripts/tmp-verify-crud-b.ts`
Expected: three `[n] …` lines all showing the `(expect …)` values met, then `ALL PROOFS PASSED ✅`, exit 0. If it fails, fix Tasks 1-3 before proceeding — this is the rollback done-when.

- [ ] **Step 3: Full type-check and lint (whole tree)**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Dispose the throwaway script**

Run: `rm scripts/tmp-verify-crud-b.ts`

Then confirm the working tree carries no `tmp-verify-crud-b` residue and nothing is staged:

Run: `git status --porcelain | grep -i "tmp-verify-crud-b" || echo "clean — script disposed"`
Expected: `clean — script disposed`.

- [ ] **Step 5: No commit**

Nothing to commit — Tasks 1-4 already committed the code; the proof script was throwaway and is deleted. Verify: `git status` shows no new tracked changes from this task.

---

### Task 6: Mirror the Cross-Phase Ledger into the epic index + mark B grill done

Close the loop the spec's §5 requires ("mirrored as one line in the epic index") and record B's completion so the epic index and epic memory stay the single source of truth for what shipped and what remains interim.

**Files:**
- Modify: `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` (§6-B: mark grill/spec/plan done + point to this plan and the spec; add the one-line ledger mirror)

**Interfaces:**
- Consumes: the spec's §5 ledger rows. Produces: the epic index's authoritative record of B's interim markers and their retirement phases.

- [ ] **Step 1: Update the epic index §6-B**

In `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md`, in the Sub-plan B section (§6-B), mark the grill ✅ complete, link the spec and this plan, and add a single ledger-mirror line naming the two `INTERIM(C):` locations (helpers `withTx` JSDoc + meetings `crud.ts`) retired by C, and the `withTx`-first-live-caller + hook off-tx threading retired by D. Match the surrounding heading/reference style already used for Sub-plan A.

- [ ] **Step 2: Type-check and lint (docs-only, still confirm nothing else drifted)**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (no code touched this task).

- [ ] **Step 3: Commit**

```bash
git add docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md
git commit -m "docs(crud-dal): mark sub-plan B done + mirror cross-phase ledger (epic index)"
```

- [ ] **Step 4: Update session memory (operational, not a commit)**

Update `memory/project-crud-mutation-standardization.md`: mark Sub-plan B SHIPPED with the ledger of interim markers (`INTERIM(C):` × 2 → retired by C; `withTx` first live caller + hook off-tx threading → D; throwaway script disposed). This keeps future sessions from rebuilding on B's inert seam or losing the interim breadcrumbs.

---

## Self-Review

**1. Spec coverage** (each spec section → task):
- §2.1 `ScopedContext.tx` + `Tx` export → **Task 1**. `exec` seam across all impls + prefetches → **Task 3** (getById/create/update/delete edited; duplicate inherits via shared `ctx` — verified zero direct `db.` in duplicateImpl).
- §2.2 rollback boundary via `dalVerifySuccess` (dalDbOperation unchanged) → proven in **Task 5** step 1-2; contract documented in `withTx` JSDoc (**Task 2**).
- §2.3 `withTx` reuse-or-open, no savepoints → **Task 2**.
- §2.4 threading contract (tx via `ctx` only; raw executors need explicit `ctx.tx ?? db`) → documented via meetings marker (**Task 4**); applying per-entity is D (out of scope, noted).
- §2.5 behavioral inertness → Global Constraints + no live caller introduced (enforced across Tasks 2-3).
- §3 scope boundaries (no duplicateImpl wrap, no island rewiring, no cascade adoption, no afterCommit, no #285) → honored; duplicateImpl explicitly left unedited (Task 3 step 4).
- §4 proof (rollback via not-found / happy reuse+nesting / standalone) → **Task 5** (all three, on dev DB, script disposed).
- §5 ledger + `INTERIM(C):` × 2 + `TEMPORARY UNTIL` annotations → **Task 2** (helpers marker), **Task 4** (meetings marker, TEMPORARY UNTIL C), **Task 6** (epic-index mirror). Throwaway disposal → Task 5 step 4.
- §6 files touched → Tasks 1-5 cover db/index.ts, types.ts, helpers.ts, create-crud-dal.ts, tmp script; meetings marker reconciled in Task 4 note.
- §7 done-when (1-5) → Task 1 (compile), Task 2-3 (`withTx` + `exec`), Task 5 (proof + green), Task 4/6 (markers+ledger), Task 5 step 3 (`tsc`+`lint`).

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Every code step carries the actual edit. Task 6 step 1 is prose-instructed (a doc edit whose exact wording depends on the epic index's current §6-B formatting) rather than a verbatim block — acceptable for a docs-mirror task; the content it must contain (two INTERIM(C) locations + retirement phases) is fully specified.

**3. Type consistency:** `Tx` (Task 1) is the type `withTx` (Task 2) and `exec` (Task 3) rely on; `ctx.tx ?? db` yields `Tx | DB` = `DbOrTx`, whose builder methods exist on both arms (verified via `participants.ts:172`). `dalVerifySuccess` / `dalDbOperation` / `withTx` names match `helpers.ts`. `voipDidCrud` name verified against `voip-dids/dal/server/crud.ts`. Minimal insert (`e164`, `providerDidId`) verified against `voip-dids.ts` schema.
