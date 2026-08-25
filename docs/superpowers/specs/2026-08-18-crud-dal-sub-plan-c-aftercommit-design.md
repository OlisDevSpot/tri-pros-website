# Sub-plan C · `afterCommit` phase — Design Spec

> ## ⏸️ DEFERRED (2026-08-19) — do NOT build from this spec as-is
>
> **Decision:** C is deferred indefinitely. This spec is preserved as the fully-grilled design to revive *if and when* a real need appears — it is **not** the current plan.
>
> **Why deferred (the north star that replaced it):** the `afterCommit` machinery here (self-wrapping engine, `txFrame`/task-list threading, per-entity slot choices) taxes **every** entity author to serve cross-entity atomicity that the codebase does not currently need. The three real orchestrations settle it: `ingestLead` and the customer delete-cascade *deliberately* want partial progress (atomicity unwanted); `setOutcomeWithReason` "should be atomic" but ships fine today with a `"saved but note failed"` 500. So the engine stays **naked + sequential**: a mutation is one autocommit write plus inline hooks, side-effects fire inline post-autocommit and are safe because no enclosing tx exists. New-entity setup is spec + crud (with hooks) + optional router — **zero tx ceremony** — which is what scales to 100 entities.
>
> **What ships instead of C:** nothing new. Sub-plan B already extended the crud handlers to *accept* a tx (`ctx.tx ?? db` + `withTx`). That is the "minimally required tx approach" — it unblocks **ad-hoc** tx threading for the rare orchestrator that genuinely needs atomicity. **Load-bearing caveat that replaces this spec:** with no `afterCommit` phase, a hooked mutation's external side-effects (QStash/Ably dispatches) run inside `after` = PRE-COMMIT under a threaded tx, and are **NOT rolled back** if the tx aborts. Any orchestrator that threads a tx must deal with those hooks at the call site. Canonical statement of the caveat lives in `withTx`'s JSDoc (`src/shared/dal/server/lib/helpers.ts`).
>
> **Revival trigger:** a genuine, *recurring* multi-write-atomic invariant (money, contracts, a hard cross-entity constraint) whose call sites can't cleanly handle their own hooks. `afterCommit` is a purely additive slot and B's substrate stays in place, so reviving this is low-regret and non-breaking — revisit this spec then. Downstream: epic §6-C, `project-crud-mutation-standardization` memory, and the two code caveats (`helpers.ts` `withTx`, `meetings/dal/server/crud.ts`) carry the deferral.
>
> ---

> **Epic:** [CRUD DAL Mutation-Interface Extension](../../plans/2026-08-12-crud-dal-mutation-interface-extension.md) · §6-C.
> **Inherits (settled, not relitigated here):** §3 layering model, §5.5 (`afterCommit` charter), §5.6 (`tx` on `ctx`), §5.14 (hook execution), §5.15 (delete gets the row). Sub-plan A shipped the config-factory + two-layer onion; Sub-plan B shipped `ctx.tx`, `withTx` (reuse-or-open), and the `dalVerifySuccess` rollback boundary.
> **Depends on:** B (the commit boundary must exist). **Feeds:** D (adoption of the remaining entities).

---

## 1. What C builds, in one paragraph

A third hook phase, `afterCommit`, that runs **only after the transaction that wrote the row has committed** — for post-commit side-effects (QStash job dispatches, Ably publishes) that must observe durably-committed state and must not fire on a rolled-back write. The phase is realized as the textbook **transaction after-commit callback list**: a mutation registers its `afterCommit` work as opaque thunks onto a list carried on `ctx`; the `withTx` that owns the commit boundary drains that list exactly once, after `db.transaction()` resolves. There is **one** concept (a task list owned by the tx boundary), **one** drain site, and **no** per-call tx flags.

---

## 2. The core design decision — the boundary is owned by the orchestrator, not the engine and not the call

Grilled and settled. Three candidate loci for "am I in a transaction / should afterCommit defer" were rejected, one accepted:

- **Rejected — a per-call flag on the crud handler** (`crud.update(ctx, input, { transactional: true })`). It is *structurally incapable* of the one thing tx threading exists for: cross-call atomicity. Two calls each flagged `transactional:true` open **two** transactions, not one shared unit — so a flag cannot make N calls atomic together. It also reintroduces the forgettable-trailing-param that §5.6 explicitly rejected (intermediate origin-agnostic services would have to *forward* it), and "whether an invariant `afterCommit` fires" is not a per-call choice (prohibit-by-inversion, §3.6).
- **Rejected — the engine unilaterally wraps every mutation** (app-wide mandatory tx). Wrong owner: it forces all 20 entities into transactions to serve the 2 that need it, and buries a composition decision inside a leaf.
- **Accepted — the orchestrator owns the boundary via `withTx`.** Crud is **never invoked naked**: every `crud.*` call receives a `ScopedContext` built by an entry point (tRPC middleware / `buildUserContext` / `SYSTEM_CONTEXT`), and cross-entity crud calls inside a hook inherit that same `ctx`. The orchestrator declares tx-mode by wrapping the atomic unit in `withTx` (or not = naked mode). `withTx(ctx, fn)` produces `{ ...ctx, tx, afterCommitTasks: [] }` — **that enriched context *is* the mode.** The engine and the hooks only *read* the mode off `ctx`; they never decide it.

**Critical constraint on that decision: the mode is per-*operation*, not per-*context***. "Orchestrator owns the mode" must NOT degrade into a `ctx.mode` flag stamped once at context construction. A single request routinely does a naked single-write in one branch and an atomic multi-write in another (same constructed context, different modes), and a transaction must scope *exactly* the statements that commit together — an operation-level fact knowable only at the composition point. `withTx` is therefore irreducible: the boundary *is* the mode, and it nests around the precise atomic unit. A bare context flag cannot replace it.

---

## 3. Type surface

`afterCommit` today is a hand-written stub on `CrudCallsiteHooks` only, typed `(row, ctx) => void` (sync, single-layer, never invoked). C moves it into the single source of truth so **both layers derive it** and the stub is deleted.

```ts
// types.ts

/** A registered post-commit side-effect. Opaque to the drain site. */
export type AfterCommitTask = () => void | Promise<void>

// ScopedContext gains the task list. Present ⇔ a withTx boundary is active.
// Set ONLY by withTx (never by hand), exactly like `tx`.
export interface ScopedContext {
  // …session, ability, scope, tx? …
  /** Post-commit task list for the active tx boundary. Drained by the owning withTx after COMMIT. */
  afterCommitTasks?: AfterCommitTask[]
}

// CrudSlotHookMap — add afterCommit per slot (mirrors `after`, returns void).
export interface CrudSlotHookMap<TTable extends PgTable, TId extends string | number> {
  create: {
    before?: (input: Insert<TTable>, ctx: ScopedContext) => MaybePromise<Insert<TTable>>
    after?:  (row: Row<TTable>, ctx: ScopedContext, meta: CreateAfterMeta<TTable>) => MaybePromise<Row<TTable> | void>
    afterCommit?: (row: Row<TTable>, ctx: ScopedContext, meta: CreateAfterMeta<TTable>) => MaybePromise<void>
  }
  update: {
    before?: (data: Update<TTable>, ctx: ScopedContext, meta: { id: TId }) => MaybePromise<Update<TTable>>
    after?:  (row: Row<TTable>, ctx: ScopedContext, meta: UpdateAfterMeta<TTable>) => MaybePromise<Row<TTable> | void>
    afterCommit?: (row: Row<TTable>, ctx: ScopedContext, meta: UpdateAfterMeta<TTable>) => MaybePromise<void>
  }
  delete: {
    before?: (row: Row<TTable>, ctx: ScopedContext) => MaybePromise<void>
    after?:  (row: Row<TTable>, ctx: ScopedContext) => MaybePromise<void>
    afterCommit?: (row: Row<TTable>, ctx: ScopedContext) => MaybePromise<void>
  }
}
```

- `CrudHooks` (factory-invariant, `{ [S]?: CrudSlotHookMap[S] }`) gains `afterCommit` per slot automatically.
- `CrudCallsiteHooks = CrudSlotHookMap[S]` (the manual `& { afterCommit?: (row,ctx)=>void }` intersection is **deleted** — it now comes from the map).
- **What `afterCommit` receives:** the committed row **plus the same `meta` as `after`** (not the row alone). `meetings update.afterCommit` needs `meta.previousRow` (its `timeChanged` check) and `meta.input` (its `gcalFieldChanged` check). Return is `void` — post-commit there is nothing left to thread into the row.
- **`ctx` passed to the task is the base `ctx`, not the tx-bound one.** Post-commit the tx handle is dead; tasks must never touch it. Contract (same tier as "never set `ctx.tx` by hand"): **`afterCommit` bodies do not touch the DB** — by construction they are QStash/Ably dispatches only.

---

## 4. Engine mechanics

### 4.1 `withTx` owns commit + drain (helpers.ts)

```ts
export async function withTx<T>(ctx: ScopedContext, fn: (ctx: ScopedContext) => Promise<T>): Promise<T> {
  if (ctx.tx) return fn(ctx)                              // reuse ambient boundary → NOT the owner → do not drain
  const afterCommitTasks: AfterCommitTask[] = []
  const result = await db.transaction(tx => fn({ ...ctx, tx, afterCommitTasks }))
  //             ↑ throws ⇒ ROLLBACK ⇒ the lines below never run ⇒ tasks discarded
  await drainAfterCommit(afterCommitTasks)               // reached ONLY on COMMIT; connection already released
  return result
}

async function drainAfterCommit(tasks: AfterCommitTask[]): Promise<void> {
  for (const task of tasks) {
    try { await task() }
    catch (e) { /* structured log — write already committed, side-effect dropped */ }
  }
}
```

Nesting/flattening: a reused `withTx` returns `fn(ctx)` on the same `ctx`; spreads copy the array *reference*, so every nested registration lands in the **one** list the owner drains. Rollback discards the list for free (the drain line is never reached).

### 4.2 The impl boundary decision (create-crud-dal.ts)

The engine self-establishes a boundary **only when the slot carries lifecycle work and no ambient boundary exists** — otherwise it runs directly on `exec = ctx.tx ?? db` (B's model, unchanged). This keeps pure entities/slots tx-free, gives side-effecting mutations a correct boundary in every mode, and **eliminates any inline-vs-defer branch** (afterCommit always drains through a real `withTx`).

```ts
async function createImpl(spec, cfg, ctx, input, callsite) {
  // `body` THROWS ThrowableDalError on failure (does NOT self-catch) — so when it
  // runs inside a tx, the throw propagates out and rolls back.
  const body = async (c: ScopedContext): Promise<Row<TTable>> => {
    const exec = c.tx ?? db
    // …before (factory→callsite, threaded) → validate → insert(exec) → after (callsite→factory, threaded)…
    // after-hook DB writes (e.g. addParticipant) run on `exec` → atomic with the insert when boundaried
    const meta: CreateAfterMeta<TTable> = { input }
    // register afterCommit thunks, onion order (callsite inner → factory outer), row+meta captured now.
    // c.afterCommitTasks is present whenever there is a boundary (self-wrap or ambient); the `?.` guard
    // is only ever skipped in the no-hook path, where these `if`s are false anyway.
    if (callsite?.afterCommit)          c.afterCommitTasks?.push(() => callsite.afterCommit!(result, ctx, meta))
    if (cfg.hooks?.create?.afterCommit) c.afterCommitTasks?.push(() => cfg.hooks!.create!.afterCommit!(result, ctx, meta))
    return result
  }

  const needsOwnBoundary = slotHasHook(cfg, callsite, 'create') && !ctx.afterCommitTasks
  // dalDbOperation OUTER, withTx INNER: a throw from `body` rolls back the inner tx AND
  // re-propagates to dalDbOperation, which converts it to DalReturn. Order is load-bearing.
  return dalDbOperation(() => (needsOwnBoundary ? withTx(ctx, body) : body(ctx)))
}
```

- **`dalDbOperation` is OUTER, `withTx` is INNER, and `body` throws.** If `dalDbOperation` were *inside* `withTx`, it would swallow the `ThrowableDalError`, `withTx`'s `db.transaction` callback would resolve normally, and the tx would **commit partial state** (e.g. the insert without its `addParticipant`) — the exact bug `withTx`'s docstring warns about. With this order: `body` throws → the inner `db.transaction` rolls back and re-throws → `withTx` propagates → `dalDbOperation` (outer) catches and returns `{success:false}`. Rollback and the never-throws DAL contract both hold.
- **Composition path (no self-wrap).** When an orchestrator owns the boundary, `ctx.afterCommitTasks` is present ⇒ `needsOwnBoundary` is false ⇒ `body` runs on the ambient tx and registers onto the ambient list. A failing `body` is caught by `dalDbOperation` → `{success:false}`; the orchestrator's `dalVerifySuccess(await crud.*)` **re-throws** it into the orchestrator's own `withTx` callback, rolling back the shared tx (B's mechanism, unchanged).
- **`slotHasHook(cfg, callsite, slot)`** = the slot has *any* lifecycle hook (`before` / `after` / `afterCommit`) on either layer. `before` counts because a `before` body may write (customers `delete.before` cascade); wrapping any hooked slot is correct (atomicity for hook-side writes) and cheap. Pure slots (no hooks) skip the tx entirely.
- When `ctx.afterCommitTasks` is already present (orchestrator opened the boundary), `body(ctx)` executes on the ambient tx and registers onto the ambient list — deferred to the orchestrator's single commit.
- `updateImpl` / `deleteImpl` follow the identical shape; `duplicateImpl` inherits via `createImpl`. `getByIdImpl` is unchanged (reads never open a tx).

### 4.3 Behavior across the four canonical flows

| Flow | Orchestrator mode | What happens |
|---|---|---|
| **Standalone reschedule** (`meetingCrud.update`, no wrap) | naked | slot is hooked + no ambient ⇒ engine self-wraps → write commits → drain fires syncGcal/notify/ably **post-commit** |
| **`setOutcomeWithReason`** (meeting update + customer note) | `withTx` | both reuse the boundary; `dalVerifySuccess` re-throw ⇒ rollback on either failure; on commit the shared list drains once |
| **`ingestLead`** (customer + meeting, partial-progress wanted) | naked | each `crud.*` is its own unit; the meeting call self-wraps (hooked) → its afterCommit drains independently; a meeting failure leaves the customer committed ✓ |
| **Customer delete-cascade** | `withTx` (or self-wrapped) | `db.delete(proposals)` + `meetingCrud.delete×N` thread the one tx; every `deleteMeetingEvent` registers on the shared list, drained once after the whole cascade commits |

---

## 5. Relocation surface — provably two entities

Two code sweeps (2026-08-18) establish the complete surface of side-effecting hooks:

1. **Dispatches / publishes inside any entity `crud.ts` / `server-spec.ts`:** `meetings/dal/server/crud.ts` and `customers/lib/server-spec.ts` — **only these two**.
2. **Raw DB writes / DAL-write calls inside hook bodies:** `addParticipant` (meetings create.after) and the customer delete-cascade (`db.delete(proposals)` + `meetingCrud.delete`) — **only these two**.

Every other `createCrudDal` entity (18 of 20) is hookless or its hooks are pure transform/compute — safe under a tx, nothing to relocate.

### 5.1 meetings ([dal/server/crud.ts](../../../src/shared/entities/meetings/dal/server/crud.ts))

- `create.after`: `addParticipant` **stays in `after`** (a DB write — now atomic with the insert via `exec = ctx.tx ?? db`; this is the "D executor" pulled into C so create is correct under the boundary). `syncMeetingToGcalJob` / `graduateFromCampaignJob` / `metaCapiEventJob` → **`create.afterCommit`**.
- `update.after`: `syncMeetingToGcalJob` / `notifyMeetingTimeChangedJob` / `ably.publish` → **`update.afterCommit`** (uses `meta.previousRow` + `meta.input`). `update.after` becomes empty → removed.
- `delete.before` `deleteMeetingEventJob` → **`delete.afterCommit`**. It sat in `before` only because the legacy `spec.hooks` had to read `gcalEventId` before the row vanished; the engine now prefetches the row and hands it to every delete hook (§5.15), so `afterCommit` gets `row.gcalEventId` for free. It **must** be post-commit — firing pre-commit would delete the calendar event while a rolled-back `DELETE` leaves the meeting alive. `delete.before` becomes empty → removed.
- Retire the `INTERIM(C):` marker block (crud.ts:22-30).

### 5.2 customers ([lib/server-spec.ts](../../../src/shared/entities/customers/lib/server-spec.ts) → new `dal/server/crud.ts`)

- **Migrate to a config factory.** `synthesizeFromSpec` has no `afterCommit` slot, so customers must move its hooks off `spec.hooks` into a `createCrudDal(customerServerSpec, () => ({ hooks, … }))` in `customers/dal/server/crud.ts`, exactly as meetings did in A. `customerServerSpec` becomes pure identity. (This is the one piece of D-style adoption C must pull forward; it is unavoidable and scoped to a single entity.)
- `update.after` `propagateCustomerChangeJob` → **`update.afterCommit`**.
- `delete.before` cascade **stays in `before`** but becomes tx-aware: `db.delete(proposals)` → `exec = ctx.tx ?? db`; `meetingCrud.delete(SYSTEM_CONTEXT, …)` → thread the ambient boundary (`{ ...SYSTEM_CONTEXT, tx: ctx.tx, afterCommitTasks: ctx.afterCommitTasks }`) so each meeting's `deleteMeetingEvent` registers on the shared list and the whole cascade is atomic.

### 5.3 The strict-dispatch → best-effort change is a *fix*, not a downgrade

The relocated dispatches use `dispatchOrThrow` today, whose throw currently fails the mutation. Inside `afterCommit`, a throw is logged-not-propagated. Reframe: **today, in the live standalone path, `dispatchOrThrow` already runs *after* the row autocommitted** — a failed enqueue 500s the caller *after the DB changed*, telling the client "failed" when it succeeded (the misleading-500 anti-pattern). Best-effort-post-commit fixes that: commit → return success → log the rare enqueue miss. QStash still retries *execution* once enqueued; the GCal orphan-sweeper is the residual backstop. Rewrite the "strict dispatch — silent loss is the bug class this refactor closed" comments accordingly.

---

## 6. Scope boundaries

- **Not the generic `createCrudRouter`.** With the engine self-wrapping hooked mutations, a single-mutation CRUD procedure already gets a boundary; the router needs no `withTx` wrap. Only bespoke *composing* procedures/services wrap (they already own their orchestration).
- **Not app-wide transactionality.** Only hooked slots open a tx; the 18 pure entities are untouched.
- **Not a transactional outbox.** Durability is best-effort (§5.5); the crash window (process dies after COMMIT, before drain) is accepted, mitigated by QStash retry + sweeper.
- **`ctx.tx ?? db` seam already exists (B).** C adds the `afterCommitTasks` list, the drain, the boundary decision, and the two-entity relocation. It does **not** rewrite B's exec seam.

---

## 7. Blast radius & sequencing — C is NOT inert (deliberately)

A and B were dormant (capability without a live behavior change). **C is not:** hooked mutations become transactional, and meetings/customers relocate their dispatches to best-effort `afterCommit`. This is inherent — you cannot leave a hooked entity's dispatch in `after` under the boundary model (it would fire pre-commit). The mandatory pieces **co-land in one PR**:

1. Engine: `afterCommit` list + `withTx` drain + the `slotHasHook` boundary decision.
2. Types: `afterCommit` into `CrudSlotHookMap`, `AfterCommitTask` + `afterCommitTasks?` on `ScopedContext`, delete the `CrudCallsiteHooks` stub.
3. meetings relocation + `addParticipant` tx-aware.
4. customers migration to a config factory + relocation + tx-aware cascade.

The pre-flight sweep (§5) is the gate and is **complete**: the relocation surface is exactly meetings + customers. Blast radius on the other 18 entities is a behavior-preserving BEGIN/COMMIT only when they carry hooks (most do not).

**Doc correction (staleness):** epic §6-C says C "Lands on `meetings/lib/server-spec.ts` (hook bodies)". A already relocated meetings' hooks into `meetings/dal/server/crud.ts`; `lib/server-spec.ts` is now pure identity. C edits `crud.ts`. Fix the epic index when marking C's grill complete.

---

## 8. Files touched

| File | Change |
|---|---|
| `src/shared/dal/server/types.ts` | `AfterCommitTask`; `afterCommitTasks?` on `ScopedContext`; `afterCommit` hook into `CrudSlotHookMap` (both layers derive); delete the manual `CrudCallsiteHooks` `afterCommit` intersection |
| `src/shared/dal/server/lib/helpers.ts` | `withTx` drains `afterCommit` on the owning branch; `drainAfterCommit` (swallow+log); retire the `INTERIM(C):` JSDoc |
| `src/shared/dal/server/lib/create-crud-dal.ts` | 4 mutation impls: `dalDbOperation(() => slotHasHook && !ctx.afterCommitTasks ? withTx(ctx, body) : body(ctx))`; register `afterCommit` thunks (onion, row+meta captured); `dalDbOperation` stays OUTER / `withTx` INNER / `body` throws |
| `src/shared/entities/meetings/dal/server/crud.ts` | relocate dispatches → `*.afterCommit`; empty `update.after`/`delete.before`; `deleteMeetingEvent` → `delete.afterCommit`; retire the `INTERIM(C):` block |
| `src/shared/entities/meetings/dal/server/participants.ts` | `addParticipant` tx-aware (`exec = ctx.tx ?? db`) |
| `src/shared/entities/customers/dal/server/crud.ts` (new) | config factory; hooks migrated off `spec.hooks`; `propagateCustomerChange` → `update.afterCommit`; cascade tx-aware |
| `src/shared/entities/customers/lib/server-spec.ts` | strip hooks → pure identity (like meetings post-A) |
| `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` | mark §6-C complete; fix the `lib/server-spec.ts` staleness; mirror the Cross-Phase Ledger |

Verification (no test runner): `pnpm tsc` + `pnpm lint`; runtime proof via throwaway `pnpm tsx scripts/tmp-verify-crud-c.ts` on the dev DB — afterCommit fires **after** commit, does **not** fire on rollback, and drains once for a composed cross-entity op. QStash/Ably side-effects need the tunnel (`pnpm dev:mobile`) if smoke-tested live.

---

## 9. Done-when

- The meetings/customers dispatches fire **only post-commit**; a thrown dispatch is logged and does not fail the committed mutation.
- A composed cross-entity op (customer delete-cascade) drains every relocated dispatch **once**, after the single commit; a forced mid-cascade failure rolls back and fires **none**.
- `grep -rn "INTERIM(C)"` is empty.
- Green `pnpm tsc` + `pnpm lint`; the throwaway proof passes on the dev DB.

---

## 10. Cross-Phase Ledger (C's rows)

- **Retires (from B):** `INTERIM(C):` ×2 (`helpers.ts` `withTx` JSDoc; `meetings/dal/server/crud.ts` dispatch-site block) — both removed once dispatches live in `afterCommit`.
- **Hands to D:** the `withTx` *first live composing caller* pattern is now exercisable; D adopts it across the remaining bypass sites and routes projects/lead-sources through CRUD. C leaves no `INTERIM(D):` markers of its own — its two-entity relocation is complete, not deferred.
- **Coordinates with #285:** C adds `afterCommit?`/`AfterCommitTask` to `ScopedContext` — disjoint from #285's `visibility` strip; mechanical merge conflict only, whichever lands second rebases.
