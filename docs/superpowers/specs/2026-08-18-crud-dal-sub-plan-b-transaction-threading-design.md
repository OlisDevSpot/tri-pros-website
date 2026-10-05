# Sub-plan B — Transaction threading (`tx`-on-`ctx`) (design)

> **What this is:** the design spec for **Sub-plan B** of the CRUD DAL Mutation-Interface Extension epic. B makes atomicity a **DAL-boundary capability**: an optional `tx` rides on `ScopedContext`, every impl executes on `(ctx.tx ?? db)`, and a `withTx` helper lets an orchestrator open one transaction and thread it through many DAL calls. B closes **G1** and supplies the in-tx mechanics **G3** (child-replace) and **G4** (delete reads its row in-tx) need. It builds on **A** (shipped); **C** (afterCommit) and **D** (adoption) build on it.
>
> **Parent line:** `memory/project-crud-mutation-standardization.md` → `docs/plans/2026-08-11-projects-standardization-epic.md` (Phase 2) → `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` (epic index, §6-B charter) → `docs/superpowers/specs/2026-08-13-crud-dal-sub-plan-a-factory-config-hooks-design.md` (A, shipped) → **this spec (Sub-plan B)**.
>
> **Inherits as settled** (do not re-litigate): epic index §3 (architectural model) and §5 (final decisions), esp. **5.6** (tx rides on ctx; orchestrator owns `db.transaction()`; factory/abstraction opens its own tx via `withTx` only when `ctx.tx` is absent; rejected: trailing `tx` param, global handler registry). Grill: 2026-08-18.
>
> **Governing principle reaffirmed this grill:** *extend existing primitives, don't create new.* B reuses `db.transaction` (Drizzle), `DbOrTx` (already in the db module), `dalVerifySuccess` + `dalDbOperation` (already built for DAL-to-DAL composition). The one genuinely-new helper — `withTx` — is the piece decision 5.6 already blessed.
>
> **⚠️ Coordination:** #285 (CASL scope-compiler) also edits `ScopedContext`/`EntityServerSpec` in `src/shared/dal/server/types.ts` — it strips `visibility`; B adds `tx?`. Disjoint fields, **mechanical merge conflict** whichever lands second (rebase). #285 never touches `tx` / `create-crud-dal.ts` / `withTx`. B stays actor-agnostic: it consumes `ctx.scope`, never resolves it.

---

## 1. Problem

`createCrudDal`'s five impls write on the module-level `db` singleton directly ([create-crud-dal.ts:46](src/shared/dal/server/lib/create-crud-dal.ts#L46)) — A deliberately deferred the `(ctx.tx ?? db)` seam to B (YAGNI, no speculative cast). `ScopedContext` has no `tx` field ([types.ts:31](src/shared/dal/server/types.ts#L31)). Consequences (epic §2.3, G1):

1. **No composable atomicity.** Every cross-entity write, cascade, or delete-then-insert commits statement-by-statement. A mid-cascade failure leaves partial state. Evidence: customers `delete.before` cascade runs "no transaction"; proposal duplicate+incentive-clone is non-atomic.
2. **7 transaction islands, none composable** (verified 2026-08-18 from code): `media-files/dal/server/media-ops.ts:53`, `projects.router/media.router.ts:72`, `applications/dal/server/mutations.ts:116`, `voip-dids/dal/server/mutations.ts:30` & `:71`, `push-subscriptions/dal/server/queries.ts:27`, `proposal-incentives/dal/server/mutations.ts:53`. Each opens its own `db.transaction` and does **raw** `tx.insert/update/delete` inside the callback — they work precisely because a raw throw inside the callback rolls back. None threads a `ctx`-bound tx through a `crud.*` handler.

B introduces the seam and the threading vehicle. It does **not** adopt the real cascades (that's D) — see §3.

### 1.1 The load-bearing hazard B must design around

Every `crud.*` impl is wrapped in `dalDbOperation`, which **catches `ThrowableDalError` and returns `{ success:false }` instead of re-throwing** ([helpers.ts:43](src/shared/dal/server/lib/helpers.ts#L43)). Drizzle rolls a `db.transaction` back **only if the callback throws**. So the naive composition —

```ts
db.transaction(async (tx) => {
  await crud.update(ctxTx, …)   // fails internally → DalError SWALLOWED, no throw
  await crud.delete(ctxTx, …)   // runs anyway
})                              // callback never threw → Postgres COMMITS partial state
```

— silently commits a partial cascade. Worse: most `ThrowableDalError`s are **business preconditions** (0-row `not-found`), *not* Postgres errors — so Postgres does **not** put the tx in aborted state on its own; subsequent statements happily run and commit. We cannot lean on "PG aborts for us." The rollback boundary must be designed explicitly (§2.2).

---

## 2. The design

### 2.1 `ScopedContext.tx` + the `exec` seam

```ts
// src/shared/db/index.ts — expose the tx arm as a named type (DbOrTx already lives here)
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

// src/shared/dal/server/types.ts — ScopedContext gains ONE optional field
export interface ScopedContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  scope: SQL | null
  tx?: Tx                    // present ⇒ run on the caller's ambient tx; absent ⇒ autocommit on `db`
}
```

`SYSTEM_CONTEXT` is unchanged (`tx` simply absent). Every impl changes exactly one thing:

```ts
const exec = ctx.tx ?? db    // typed DbOrTx — the union the codebase already uses (participants.ts:172)
```

`exec` replaces `db` for the write **and** for every internal read-prefetch, so a prefetched row is read inside the same tx as the write it guards:

| Impl | `exec` sites |
|---|---|
| `getByIdImpl` | the `select` |
| `createImpl` | the `insert` |
| `updateImpl` | the empty-case `getById`, the `previousRow` prefetch, the `update` |
| `deleteImpl` | the G4 row prefetch, the `delete` |
| `duplicateImpl` | the source `getById`, then `createImpl` (inherits via the shared `ctx`) |

The internal prefetches call `getByIdImpl(spec, pk, ctx, …)`; since `getByIdImpl` reads `ctx.tx ?? db`, passing the same `ctx` down is sufficient — no separate plumbing.

### 2.2 The rollback boundary — reuse `dalVerifySuccess` (Approach A)

Composition is built entirely from existing primitives; **`dalDbOperation`'s swallow/catch logic is unchanged**:

```ts
return dalDbOperation(() =>                          // existing: catches the re-thrown DalError → DalReturn
  withTx(ctx, async (txCtx) => {                     // 5.6-sanctioned helper (§2.3)
    dalVerifySuccess(await crud.update(txCtx, …))     // existing: throws ThrowableDalError on {success:false}
    dalVerifySuccess(await crud.delete(txCtx, …))     // → aborts the tx → Drizzle rolls back
    return …
  }),
)
```

`dalVerifySuccess` ([helpers.ts:98](src/shared/dal/server/lib/helpers.ts#L98)) is documented for *exactly* this — *"convert any DalError into a thrown error (for DAL-to-DAL composition)."* When an inner `crud.*` fails, its `dalDbOperation` swallows the error and returns `{success:false}`; `dalVerifySuccess` immediately re-throws it; the throw inside the `withTx` callback aborts the tx; `db.transaction` re-throws after rollback; the outer `dalDbOperation` catches and re-wraps to `DalReturn`. The inner handler's already-executed statements ran on the same tx, so they roll back too.

The precedent already exists in-tree: proposal-incentives does `dalVerifySuccess(await recomputeProposalFinancials(...))` and `dalVerifySuccess(await listProposalIncentives(...))` ([proposal-incentives/dal/server/mutations.ts:62-63](src/shared/entities/proposal-incentives/dal/server/mutations.ts#L62)).

**Accepted cost — caller discipline.** Approach A's contract is *"unwrap every composed `crud.*` with `dalVerifySuccess` inside a `withTx`."* Forget one and its `DalError` is swallowed → the tx continues and may commit partial state (the business-precondition case, where PG doesn't self-abort). This is the same "forgettable" class the trailing-`tx` param was rejected for (5.6). It was chosen deliberately: it adds **zero** new machinery and reuses a primitive built for the job. Approaches that removed the discipline (a tx-aware `dalDbOperation`, a new re-throwing wrapper) were rejected against the *extend-don't-create* principle.

### 2.3 `withTx` — the reuse-or-open helper (nesting policy by construction)

```ts
// src/shared/dal/server/lib/helpers.ts — next to dalDbOperation
/**
 * Run `fn` inside a transaction. If `ctx` already carries an ambient tx, REUSE
 * it (no nesting, no savepoint) — the callback runs on the same tx so the whole
 * composed operation is one atomic unit. Otherwise open a fresh tx and hand the
 * callback a tx-bound ctx.
 *
 * Ownership (epic §5.6): the OUTERMOST caller (tRPC procedure / service / job)
 * owns the transaction; nested `withTx` calls flatten onto it. Compose failing
 * `crud.*` calls with `dalVerifySuccess` so a failure aborts the tx (§2.2).
 *
 * ⚠️ INTERIM(C): until `afterCommit` lands (sub-plan C), do NOT thread this tx
 * into a `crud.*` whose `after` hook dispatches a QStash/Ably job — the dispatch
 * would run PRE-COMMIT. C relocates those dispatches to `afterCommit`. See the
 * Cross-Phase Ledger in this spec.
 */
export async function withTx<T>(
  ctx: ScopedContext,
  fn: (ctx: ScopedContext) => Promise<T>,
): Promise<T> {
  if (ctx.tx) return fn(ctx)
  return db.transaction(tx => fn({ ...ctx, tx }))
}
```

`withTx` **reuses** `ctx.tx` rather than calling `tx.transaction()`, so B **never creates a Postgres savepoint**. The whole cross-entity cascade is one flat atomic unit with no partial-rollback sub-scopes. Savepoints / partial rollback are **YAGNI** — addable later without breaking this shape.

`withTx` is a thin passthrough: it does **not** wrap in `dalDbOperation` itself (that stays the caller's boundary, consistent with every other DAL function). This keeps it minimal and composable.

### 2.4 The threading contract — tx propagates only via `ctx`

- A `crud.*` handler **auto-joins** the ambient tx: it receives `ctx` and reads `ctx.tx`. Threading one tx through many entities = the orchestrator passes the *same* `txCtx` into each handler.
- A **raw executor-style helper** (`addParticipant(meetingId, userId, role, executor)` — [participants.ts:172](src/shared/entities/meetings/dal/server/participants.ts#L172)) or an **inline `db.*`** written directly in a hook body does **not** auto-join. It must be handed `ctx.tx ?? db` explicitly.
- **B states this contract; applying it per-entity is D.** Concretely: today meetings `create.after` calls `addParticipant(row.id, row.ownerId, 'owner')` with no executor (crud.ts:52), and publishes to Ably inline — both would run outside the tx. Correcting those to thread `ctx.tx ?? db` is D's adoption work, entangled with C's dispatch relocation. (This is also why B does not wrap `duplicateImpl` — see §3.)

### 2.5 Behavioral inertness on `main`

With `ctx.tx` **always absent** outside the throwaway proof script, `exec = ctx.tx ?? db` is always `db` — every runtime path behaves byte-for-byte as today. B **adds a capability and proves it**; it changes no shipped behavior. The first tx-carrying `ctx` is introduced by D's adoptions (after C).

---

## 3. Scope boundaries — what B does NOT do

- **Does not wrap `duplicateImpl` in `withTx`.** Retracted mid-grill after verification: `duplicateImpl` → `createImpl` → `create.after`, and meetings' `create.after` dispatches `syncMeetingToGcalJob` / `graduateFromCampaignJob` / `metaCapiEventJob` (crud.ts:47-75). Wrapping duplicate in a tx would fire those **pre-commit** — the C hazard **live, not latent** — and would expose that `addParticipant` writes off-tx. Duplicate's own atomicity lands in D, after C.
- **Does not touch the 7 islands.** They already throw-inside-callback correctly. Rewiring them through `crud`+`withTx` is D adoption.
- **Does not adopt the real cascades.** customers delete-cascade atomicity, proposal duplicate+incentive-clone atomicity, per-entity hook threading — all D. B proves the *mechanism* via a throwaway script (§4).
- **Does not wire `afterCommit` (C)** or move any dispatch off `after`.
- **Does not resolve permissions (#285)** — consumes `ctx.scope` as-is.
- **No savepoints** — reuse-don't-nest (§2.3).

---

## 4. Proof (no test runner in repo)

A throwaway `scripts/tmp-verify-crud-b.ts` (starts with `import './lib/load-env'`; runs against the **dev DB**; QStash side-effects not involved so plain `tsx` suffices):

1. **Rollback under forced mid-cascade failure (the done-when).** Under `withTx(SYSTEM_CONTEXT, …)`, compose two writes on an entity with no job-dispatching `after` (e.g. `voip-dids` — used for A's G7 proof): `dalVerifySuccess(await xCrud.create(txCtx, A))` then force a **business-precondition** `ThrowableDalError` on a second step — e.g. `dalVerifySuccess(await xCrud.delete(txCtx, { id: '<nonexistent>' }))`, which returns `{ type: 'not-found' }`. The `not-found` case is deliberate: Postgres does **not** self-abort on it (no SQL error), so committing row `A` would be the exact silent-partial-commit failure §1.1 describes — proving the design closes it. Assert row `A` is **absent** afterward (rolled back by the `dalVerifySuccess` re-throw, not by PG).
2. **Happy-path reuse.** Two successful composed writes under one `withTx` both persist; a nested `withTx(txCtx, …)` runs on the same tx (no error, no savepoint).
3. **Standalone still works.** A single `xCrud.create(SYSTEM_CONTEXT, …)` (tx absent) commits as today.

The script is **disposed in the epic's cleanup** (see ledger). Verified alongside `pnpm tsc` + `pnpm lint`.

---

## 5. Cross-Phase Dependency & Cleanup Ledger

Because A→{B,C}→D interlock tightly, every piece B ships that is temporary or deferred carries a **`TEMPORARY UNTIL <phase>`** annotation on its plan task and is registered here (mirrored as one line in the epic index). This ledger is the single place to prove nothing rotted.

| Item | Location | Marker | Retired by | Retirement check |
|---|---|---|---|---|
| `withTx` "don't thread job-dispatching `crud.*` into a tx yet" | `withTx` JSDoc | `INTERIM(C):` | **C** | comment deleted when dispatches move to `afterCommit` |
| Meetings `after` job-dispatch sites (syncGcal / notifyTimeChanged / metaCapi / graduateFromCampaign / Ably) | `meetings/dal/server/crud.ts` | `INTERIM(C):` | **C** | `grep -rn "INTERIM(C)"` empty after C |
| `afterCommit?` declared-not-invoked (inherited from A) | [types.ts:110](src/shared/dal/server/types.ts#L110) | inherited | **C** | field is invoked |
| `withTx` first *live* caller | (none in B) | ledger note | **D** | a real orchestrator/abstraction calls `withTx` |
| Raw-executor / inline-`db` writes in hooks need `ctx.tx ?? db` threading | meetings `create.after` `addParticipant` + Ably; per-entity in D | ledger note | **D** | every in-hook write joins the tx |
| Throwaway `scripts/tmp-verify-crud-b.ts` | scripts/ | ledger note | **B cleanup** | file deleted |

`grep -rn "INTERIM(C)"` returns exactly the two `INTERIM(C):` rows above → C's done-when can assert the grep is empty.

---

## 6. Files touched (small)

- `src/shared/db/index.ts` — export `Tx` (alongside `DbOrTx`).
- `src/shared/dal/server/types.ts` — add `tx?: Tx` to `ScopedContext`. **⚠️ merge-conflict surface with #285** (disjoint `visibility` strip — rebase the loser).
- `src/shared/dal/server/lib/helpers.ts` — add `withTx`; import `db`.
- `src/shared/dal/server/lib/create-crud-dal.ts` — `const exec = ctx.tx ?? db` in all 5 impls incl. every internal prefetch. No change to `dalDbOperation`, hooks, or slot semantics.
- `scripts/tmp-verify-crud-b.ts` — throwaway proof (disposed in cleanup).

No entity spec, no router, no service touched. `withTx` has no live caller in B (first lands in D).

---

## 7. Done-when

1. `ScopedContext.tx?: Tx` and the `Tx` export compile; `EntityServerSpec` still `satisfies` on all specs (B doesn't touch it beyond the shared file).
2. `withTx` present in `helpers.ts`; all 5 impls (and their internal prefetches) run on `ctx.tx ?? db`.
3. The throwaway script proves: rollback under forced mid-cascade failure; happy-path reuse + flat nesting; standalone autocommit unchanged — on the dev DB.
4. Every `INTERIM(C):` marker and ledger row is in place; the plan tasks carry `TEMPORARY UNTIL <phase>` annotations.
5. Green `pnpm tsc` + `pnpm lint`.

*(Adoption of real cascades, wrapping `duplicateImpl`, wiring `afterCommit`, and per-hook `ctx.tx ?? db` threading are later-sub-plan done-whens, not B's.)*

---

## 8. Risks & watch-items

- **⚠️ Caller-discipline footgun (Approach A).** A composed `crud.*` not unwrapped with `dalVerifySuccess` swallows its failure → partial commit in the business-precondition case. Mitigation: the contract is stated in `withTx`'s JSDoc and B's docs; D's adoptions follow it; a future lint/convention could enforce "no bare `await crud.* ` inside a `withTx` callback."
- **⚠️ `types.ts` merge conflict with #285** — coordinate landing order; rebase the loser (mechanical).
- **⚠️ Latent off-tx writes in hooks (surfaced, deferred).** Raw `db.*` inside hook bodies (meetings `addParticipant`, Ably) won't join the tx until D threads `ctx.tx ?? db`. Registered in the ledger; B does not fix (would drag D's adoption + C's dispatch relocation into B).
- **`helpers.ts` importing `db`** — helpers.ts currently imports only types + `scope`; adding `db` (which imports schema + env, not helpers) introduces no cycle. Verify with `tsc`.

---

## 9. Open questions for writing-plans

None architectural — the mechanism is settled and inherits epic §3/§5 + A. The plan sequences: (1) `db/index.ts` `Tx` export + `types.ts` `ScopedContext.tx?`; (2) `helpers.ts` `withTx` (with `INTERIM(C)` JSDoc); (3) `create-crud-dal.ts` `exec = ctx.tx ?? db` across all impls + prefetches; (4) meetings `INTERIM(C):` dispatch-site markers; (5) throwaway proof script → `tsc`/`lint` + dev-DB rollback verification. Each interim/deferred task carries its `TEMPORARY UNTIL <phase>` annotation feeding the §5 ledger.
