# Sub-plan A — Factory config-factory + hook relocation & update-impl hardening (design)

> **What this is:** the design spec for **Sub-plan A** of the CRUD DAL Mutation-Interface Extension epic. A is the **enabling** infrastructure change — it inverts entity lifecycle hooks off `EntityServerSpec` onto the `createCrudDal` invocation, establishes the two-layer hook execution model, and hardens the update/delete impls (G7, G4). B (tx threading) and C (afterCommit) build on it; D (adoption) wires it into the entities.
>
> **Parent line:** `memory/project-crud-mutation-standardization.md` → `docs/plans/2026-08-11-projects-standardization-epic.md` (Phase 2) → `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` (epic index) → **this spec (Sub-plan A)**.
>
> **Inherits as settled** (do not re-litigate): the epic index §3 (architectural model) and §5 (final decisions). This spec only makes A's concrete mechanics precise. Grill: 2026-08-12→13.
>
> **⚠️ Coordination:** #285 (CASL scope-compiler) also purifies `EntityServerSpec` — it strips `visibility` while A strips `hooks` + `duplicate`. Disjoint fields, **same interface in `src/shared/dal/server/types.ts`** → mechanical merge conflict whichever lands second (rebase). #285 never touches hooks / `createCrudDal` / the config factory. #285's shipped scope helpers are `resolveActorScope` (DAL) / `resolveTrpcActorScope` (tRPC) / `canAccess` — A consumes resolved scope, never resolves it.

---

## 1. Problem

`createCrudDal(spec)` today reads hooks from `spec.hooks` ([create-crud-dal.ts:73,85,102,136,156,169](src/shared/dal/server/lib/create-crud-dal.ts)). That shape is the root cause of the epic's central failure:

1. **Circular barrier.** A hook defined *inside* a spec cannot reference the handlers that spec produces (`meetingCrud = createCrudDal(meetingServerSpec)` — the spec is the factory's input, so a spec-hook can't call `meetingCrud`). Hooks that need a DAL read reach for raw `db` instead (meetings `delete.before`), or the entity abandons CRUD entirely (projects, lead-sources).
2. **Hookless-rebuild.** `createCrudRouter` rebuilds a *second* instance via `createCrudDal(config.spec)` ([create-crud-router.ts:70](src/trpc/lib/create-crud-router.ts#L70)). Once hooks move off the spec, a spec-only rebuild silently produces **un-hooked** handlers — re-introducing "spec hooks never fire" through the back door.
3. **empty-`.set()` throws (G7).** `updateImpl` calls `.set(validated)` unconditionally; Drizzle's `mapUpdateSet` throws "No values to set" *before* `$onUpdate` is consulted ([create-crud-dal.ts:127](src/shared/dal/server/lib/create-crud-dal.ts#L127)). Only `updateProject` hand-guards it.
4. **Delete hooks get only `id` (G4).** Forces manual re-reads for `gcalEventId` (meetings) and R2 media cleanup (projects).

A fixes 1–4.

---

## 2. The design

### 2.1 Spec identity + `configFactory` — and the A/D purity boundary

**Target end-state (reached in D):** `EntityServerSpec` is pure declarative identity — no `hooks`, no `duplicate`:

```ts
interface EntityServerSpec<TTable, TId = string> {
  entityName; caslSubject; table: TTable; schemas: { insert; update; select }
  primaryKey?; shareable?; parent?
  // visibility? — removed by #285 (not A)
}
```

**What A actually does (backward-compatible, minimal blast radius).** A cannot *remove* `hooks`/`duplicate` from the type, because 4 specs declare `hooks` (proposals, customers, customer-notes, meetings) and 2 declare `duplicate` (proposals, meetings) — a pure type would fail `satisfies` on all of them, forcing every entity to migrate at once (dragging proposals' financial recompute and customers' cross-entity cascade — both explicitly D — into A). Instead A leaves the type **structurally unchanged**, adds the new config surface alongside it, and relocates **only meetings**:

- A **keeps `hooks?` + `duplicate?` on `EntityServerSpec` exactly as they are today**, adding only an `@deprecated` JSDoc tag. **No signature retype.** The other three hook specs (proposals, customers, customer-notes) are **not touched at all** — zero-diff.
- A **relocates only the one proof entity's hooks (meetings)** off the spec into a `configFactory` in `dal/server/crud.ts`. The other three hook specs are **zero-diff**.
- `createCrudDal` reads a **uniform `cfg`** (§2.3): `configFactory ? configFactory(crudHandlers) : synthesizeFromSpec(spec)`. No factory ⇒ the `@deprecated` adapter rebuilds a `CrudConfig` from the deprecated `spec.hooks`/`spec.duplicate` ⇒ **identical behavior** for unmigrated entities.
- The only signature gap between the deprecated `spec.hooks` and the new `CrudConfig` is **delete** (`id` → `row`, §2.2/§2.6). `create`/`update` afters return `void`, which is directly assignable to the new `Row | void` return, so they pass through un-bridged. `synthesizeFromSpec` therefore only **bridges delete**: it wraps `spec.hooks.delete.before/after` so a `(row)`-signature call forwards `row[pk]` to the legacy `(id)` hook. This adapter is **throwaway** — deleted in D when `spec.hooks` is removed.
- **`createCrudRouter.crud` is made required in A** (§2.8) — the internal rebuild is deleted and all 5 call sites pass their existing `*Crud`. This is a *router-wiring* change, not a hook relocation, so it doesn't drag the unmigrated entities' hooks into A; it does close the hookless-rebuild back door immediately.

**Deferred to D** (kept out of A to preserve "one proof entity" of hook *relocation*): removing `hooks`/`duplicate` from the type + deleting `synthesizeFromSpec`, migrating the other three specs' hooks into config factories, and the bivariance-disable removal (§2.9 — the disables can't drop while the bivariant hook methods still live on the spec). **Also deferred to B:** the `ctx.tx ?? db` execution seam (A calls `db` directly).

`createCrudDal` gains an optional second argument, the **config factory**:

```ts
type CrudConfigFactory<TTable, TId> =
  (crudHandlers: CrudHandlers<TTable, TId>) => CrudConfig<TTable, TId>

export function createCrudDal<TTable extends PgTable, TId extends string | number = string>(
  spec: EntityServerSpec<TTable, TId>,
  configFactory?: CrudConfigFactory<TTable, TId>,
): CrudHandlers<TTable, TId>
```

- Named **`configFactory`** (its parameter is **`crudHandlers`**). "builder" was rejected as semantically vague.
- `tx` is **not** a parameter, and **A does not add a `ctx.tx ?? db` seam either** — in A the impls call `db` directly, exactly as today. Sub-plan **B** introduces `ScopedContext.tx` and the `exec = ctx.tx ?? db` seam together, so A carries no cast asserting a field that doesn't yet exist. (Convention: no speculative forward-compat scaffolding.)

### 2.2 `CrudConfig` shape — single-sourced via a per-slot lookup map

Per-slot hook signatures are authored **once**, in a lookup map; `CrudConfig`, the call-site option types, and `CrudHandlers` all derive from it — no hand-mirrored copies (`feedback-typing-priority.md`). `after` returns `Row | void` in A (deprecated void hooks stay assignable; the engine coalesces `?? row`; D tightens to strict `Row`). `delete` hooks take the **row** (G4).

```ts
// THE single source of truth for per-slot hook signatures.
interface CrudSlotHookMap<TTable, TId> {
  create: {
    before?(input: Insert<TTable>, ctx: ScopedContext): MaybePromise<Insert<TTable>>
    after?(row: Row<TTable>, ctx: ScopedContext, meta: CreateAfterMeta<TTable>): MaybePromise<Row<TTable> | void>
  }
  update: {
    before?(data: Update<TTable>, ctx: ScopedContext, meta: { id: TId }): MaybePromise<Update<TTable>>
    after?(row: Row<TTable>, ctx: ScopedContext, meta: UpdateAfterMeta<TTable>): MaybePromise<Row<TTable> | void>
  }
  delete: {
    before?(row: Row<TTable>, ctx: ScopedContext): MaybePromise<void>
    after?(row: Row<TTable>, ctx: ScopedContext): MaybePromise<void>
  }
}
type CrudMutationSlot = keyof CrudSlotHookMap<PgTable, string>              // 'create' | 'update' | 'delete'
type CrudHooks<TTable, TId> = { [S in CrudMutationSlot]?: CrudSlotHookMap<TTable, TId>[S] }
// call-site hooks for one slot = that slot's before/after + a C-era afterCommit
type CrudCallsiteHooks<TTable, TId, S extends CrudMutationSlot>
  = CrudSlotHookMap<TTable, TId>[S] & { afterCommit?(row: Row<TTable>, ctx: ScopedContext): void }

interface CrudConfig<TTable, TId> {
  hooks?: CrudHooks<TTable, TId>            // ← derived, not re-declared
  duplicate?: {
    exclude?: readonly string[]
    overrides?(source: Row<TTable>, ctx: ScopedContext): Partial<Insert<TTable>>
  }
}
```

Changes from today's spec-hook signatures:
- `create.after` / `update.after`: `Row → void` **→** `Row → MaybePromise<Row | void>` (return-value threading, §2.4). **A relaxes to `Row | void`** so the deprecated void-returning specs are directly assignable (fewer params + `void ⊆ Row | void`); the impl coalesces `(await after(...)) ?? row`. **D tightens to strict `Row`** once the deprecated path is gone.
- `delete.before` / `delete.after`: `(id) → void` **→** `(row) → void` (G4, §2.6). This is the **only** signature the deprecated `spec.hooks` can't satisfy directly, so `synthesizeFromSpec` bridges just this one (§2.1).
- The **whole** `duplicate` config (both `exclude` and `overrides`) lives here (for meetings); unmigrated `spec.duplicate` passes through the adapter unchanged.

These are the **factory-invariant** hooks — they fire on every invocation of the slot, every origin. `EntityServerSpec.hooks`/`duplicate` are **not** retyped — they keep today's signatures under an `@deprecated` tag; the adapter bridges the gap.

### 2.3 Late-bound factory internals

`crudHandlers` is the factory's own return value, so it is built first, then handed to `configFactory`:

```ts
export function createCrudDal(spec, configFactory) {
  const pkColumn = getPkColumn(spec)
  const crudHandlers = {} as CrudHandlers<TTable, TId>   // ← the ONE bootstrap cast
  // Uniform cfg: a config factory OWNS the hooks; absent one, synthesize from
  // the DEPRECATED spec fields so unmigrated entities keep firing unchanged.
  const cfg: CrudConfig<TTable, TId> = configFactory
    ? configFactory(crudHandlers)
    : synthesizeFromSpec(spec, pkColumn)   // ← throwaway adapter, deleted in D
  Object.assign(crudHandlers, {
    getById:   (ctx, input) => getByIdImpl(spec, pkColumn, ctx, input),
    create:    (ctx, input, opts) => createImpl(spec, cfg, ctx, input, opts),
    update:    (ctx, input, opts) => updateImpl(spec, cfg, pkColumn, ctx, input, opts),
    delete:    (ctx, input, opts) => deleteImpl(spec, cfg, pkColumn, ctx, input, opts),
    duplicate: (ctx, input, opts) => duplicateImpl(spec, cfg, pkColumn, ctx, input, opts),
  })
  return crudHandlers
}
```

The hook closures inside `cfg` capture `crudHandlers`; they resolve `crudHandlers.getById(...)` etc. only when a slot is *called* — long after `Object.assign`. This is what kills the circular barrier: a same-entity read in a hook goes through `crudHandlers`, not raw `db`.

### 2.4 Hook execution model (two-layer onion + threading)

Each mutating slot runs **factory-invariant** hooks (from `cfg`) and **call-site** hooks (from the slot's optional `options` arg), onion-ordered, factory outer:

```
factory.before → callsite.before → [validate → write] → callsite.after → factory.after
```

`update` (representative). A calls `db` directly (no `ctx.tx` seam — that's B):

```ts
async function updateImpl(spec, cfg, pk, ctx, input, callsite) {
  return dalDbOperation(async () => {
    // before: factory (outer) → callsite (inner), THREADED
    let data = input.data
    if (cfg.hooks?.update?.before) data = await cfg.hooks.update.before(data, ctx, { id: input.id })
    if (callsite?.before)          data = await callsite.before(data, ctx, { id: input.id })
    const validated = spec.schemas.update.parse(data)          // the THREADED value is validated

    // G7: empty (no defined business cols, even after before) = NO-OP — return the
    // current row, no write, no updatedAt bump, no after-hooks (§2.5).
    if (!hasDefinedValues(validated)) return currentRowOrNotFound()

    // prefetch previousRow if EITHER layer has an after (loud-abort, as today)
    const needsPrev = cfg.hooks?.update?.after || callsite?.after
    const previousRow = needsPrev ? loudPrefetch() : undefined

    // real write — .set(validated); Drizzle appends $onUpdate (updatedAt bumps on a genuine change)
    const row = await writeUpdate(db, spec, pk, validated, ctx)

    // after: callsite (inner) → factory (outer), THREADED via `?? result`
    // coalesce (a void-returning deprecated hook keeps the prior row).
    let result = row
    const meta = { previousRow, input: input.data }            // input = ORIGINAL
    if (callsite?.after)          result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.update?.after) result = (await cfg.hooks.update.after(result, ctx, meta)) ?? result
    return result
  })
}
```

Rules:
- **`before` threads the payload** (`Insert`/`Update`); the *threaded* value is what `schema.parse`'s and writes — never the original input.
- **`after` is a return-value transform** (`Row<T> → Row<T> | void`): it enriches *fresher column values* into the returned row (e.g. proposals' recompute writes `finalTcpCents` via its own statement, then the hook merges `{ finalTcpCents }` into the returned row so the caller sees it fresh with no re-read). It is **not** a second `UPDATE` of the main row, and it **cannot widen past `Row<T>`** (preserves the `CrudHandlers` return contract). A void return (deprecated hooks, and meetings' side-effect afters) is coalesced back to the prior row via `?? result`; the first *meaningful* transform (proposals `finalTcp`) lands in D.
- **`meta.input`** is the original `input.data`, so a hook can compare requested-vs-enriched.
- **Default** (no `options`) = only factory invariants fire.

### 2.5 Empty-update semantics (G7) — graceful no-op

`crud.update(ctx, { id, data: {} })` is a **graceful no-op**, not a throw: when there is no defined business data (even after before-hooks run), the handler writes nothing, `updatedAt` does **not** move, no after-hooks fire, and it returns the current row. Rule: *"no data changed → nothing is written → `updatedAt` stays put."* `updatedAt` means "when the row's data last changed"; an empty update changes nothing.

- **Why (verified against drizzle-orm 0.45.1):** the throw is `mapUpdateSet` (`utils.js:92`), invoked by `.set()` — it filters `values` to the defined entries and `throw new Error("No values to set")` when **zero** remain, *before* any SQL is built. Rather than force a write past that guard (which would require reaching into Drizzle's private `onUpdateFn`), the handler **detects the empty case first** (`Object.values(validated).some(v => v !== undefined)`) and short-circuits to a `getById`-and-return. A real (non-empty) update calls `.set(validated)` exactly as today, and Drizzle's `buildUpdateSet` auto-appends `$onUpdate` columns — so `updatedAt` bumps **only on a genuine change**. No `getTableColumns`, no `onUpdateFn` cast, no re-implementation of Drizzle internals (audit F5 dissolved).
- **This generalizes existing behavior, changes nothing:** `updateProject`'s `hasFields` guard ([mutations.ts:65](src/shared/entities/projects/dal/server/mutations.ts#L65)) already SELECTs-and-returns on empty, deliberately not bumping `updatedAt`. A folds that same behavior into the shared handler, so when projects route through CRUD in D the hand-guard is deleted with **zero** business-rule change. (An earlier draft proposed flipping projects to *bump* on scopes-only edits — rejected: if a scopes edit should reflect on the project, the orchestrator that writes the scopes touches `updatedAt` **explicitly**, not via implicit empty-update magic. YAGNI until a real touch-need appears.)

### 2.6 Delete gets the row (G4)

Prefetch the target row **once** (loud-abort like `update`'s `previousRow`; in-tx once B lands), pass the **same pre-delete snapshot** to both `delete.before(row, ctx)` and `delete.after(row, ctx)`:

```ts
async function deleteImpl(spec, cfg, pk, ctx, input, callsite) {
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    const needsRow = cfg.hooks?.delete?.before || cfg.hooks?.delete?.after || callsite?.before || callsite?.after
    const row = needsRow ? loudPrefetch() : undefined

    if (cfg.hooks?.delete?.before) await cfg.hooks.delete.before(row!, ctx)   // pre-DELETE
    if (callsite?.before)          await callsite.before(row!, ctx)
    await writeDelete(exec, spec, pk, ctx)                                     // not-found guard as today
    if (callsite?.after)          await callsite.after(row!, ctx)
    if (cfg.hooks?.delete?.after) await cfg.hooks.delete.after(row!, ctx)
  })
}
```

- Delete hooks stay **`void`** (handler returns `DalReturn<void>` — nothing to thread); the row *is* the payload (no carry object).
- `before` runs **before** the `DELETE`, so R2-before-cascade (projects) and `gcalEventId` capture (meetings) land before the DB cascade wipes related rows.

### 2.7 Call-site options (derived, not re-declared)

Each mutating slot accepts an optional trailing `options` arg — **additive-only** hooks that add behavior, never remove an invariant. The type is the **derived** `CrudCallsiteHooks<TTable, TId, S>` from §2.2 (that slot's before/after looked up from `CrudSlotHookMap`, plus `afterCommit`). No separate `CreateCallsiteHooks`/`UpdateCallsiteHooks`/`DeleteCallsiteHooks` interfaces — that was rejected as a hand-mirrored copy of the same signatures.

`afterCommit` is present in the type in A (stable option surface) but **not executed** until C adds the commit boundary. A must not invent commit semantics.

### 2.8 `createCrudRouter` consolidation — `crud` REQUIRED in A

`createCrudRouter` consumes an entity's single `crud` instance instead of rebuilding one. **A makes this airtight immediately** — no optional/fallback dead weight (convention: no defensive backwards-compat).

- Add `crud: CrudHandlers<TTable, TId>` as a **required** config field: `const handlers = { ...config.crud, ...config.handlers }`. **Delete** the internal `const defaults = createCrudDal(config.spec)` rebuild and its `createCrudDal` import.
- All **5** `createCrudRouter` call sites (meetings, applications, customers, proposals, customer-notes) pass their **already-existing** `*Crud` export (e.g. `crud: customerCrud`). Zero behavior change: an unmigrated entity's `createCrudDal(spec)` synthesizes hooks identically to the deleted fallback. Overrides still compose (`handlers` merges over `crud`).
- This **eliminates the hookless-rebuild failure mode by construction in A** (no code path can produce un-hooked handlers) — a win the earlier draft deferred to D, now pulled forward at ~5 lines' cost (audit F2).
- The router is otherwise a pure procedure-wrapper (CASL gate + Zod + `dalToTrpc`) over the given handlers.

Each entity's `dal/server/crud.ts` is the single home. In A **only meetings** gains a config factory; the other four keep their bare `createCrudDal(spec)` (hooks stay on their `@deprecated` spec, synthesized) and are relocated in D:

```ts
export const meetingCrud = createCrudDal(meetingServerSpec, () => ({ hooks, duplicate })) // A
export const customerCrud = createCrudDal(customerServerSpec)                             // unchanged until D
```

### 2.9 Typing story

- **New casts (two, both localized to `create-crud-dal.ts`):** (1) the `{} as CrudHandlers<TTable, TId>` bootstrap (§2.3); (2) `synthesizeFromSpec` reads `(row as Record<string, unknown>)[pkName]` to forward the pk to the legacy `(id)` delete hook. Both are internal to the factory file; no cast leaks to call sites or entity specs. (The earlier Drizzle-internal `onUpdateFn` cast is gone — G7 is now a no-op, §2.5.)
- **`satisfies EntityServerSpec<typeof table>`** still holds on the slimmed spec.
- **Bivariance cleanup → deferred to D.** The `ts/method-signature-style` bivariant-method eslint-disables ([types.ts:120](src/shared/dal/server/types.ts#L120)) exist because hooks ride the spec that erases to `EntityServerSpec<PgTable>` at the `createCrudRouter` boundary. Since A **keeps** `hooks` on the (deprecated) spec, that erasure still happens — the disables **cannot** drop in A. They drop in D when hooks leave the type entirely. A's new `CrudConfig` hooks are consumed at the concrete table type (never erased), so they use strict `(fn) => U` signatures from the start; only the legacy spec-resident copies keep the disables.
- **Zod↔Drizzle boundary cast** (`input as Insert<TTable>` at the router) is unchanged. The "insert schema strips server-derived columns a `before` hook added" problem is **not** A's — it's D's two-schema split (5.2).

---

## 3. Scope boundaries — what A does NOT do

- **Transaction execution (B).** A does **not** add the `ctx.tx ?? db` seam — impls call `db` directly, as today. `ScopedContext.tx`, the seam, and orchestrator-owned `db.transaction()` all arrive together in **B**. (Audit F4: no speculative forward-compat cast in A.)
- **`afterCommit` execution (C).** A includes the `afterCommit?` option field but never invokes it. No commit boundary in A.
- **Two-schema split / server-only columns / side-channel modeling (D).** A keeps input strictly `Insert`/`Update`; it does not add per-entity permissive/CRUD schema pairs.
- **Per-entity hook relocation & bypass elimination (D).** A relocates **one** entity's hooks (meetings); it does not migrate the other three hook specs or empty the bypass register. (Note: A *does* wire `crud` into all 5 routers — that's router wiring, not hook relocation.)
- **Type purification (D).** A keeps `hooks?`/`duplicate?` on `EntityServerSpec` (unchanged signatures, `@deprecated`). Removing them + `synthesizeFromSpec`, migrating the other three hook specs, and dropping the bivariance disables are **D**.
- **`after`-return tightening (D).** A relaxes `after` to `Row | void`; D tightens to strict `Row`.
- **Permissions (#285).** A stays actor-agnostic.

---

## 4. Files touched

**A is nine files. No unmigrated entity *spec* is touched (their routers each gain one `crud:` line).**

- `src/shared/dal/server/types.ts` — add `MaybePromise`, the `CrudSlotHookMap` lookup + derived `CrudHooks`/`CrudCallsiteHooks`, `CrudConfig`, `CrudConfigFactory`, meta types; widen `CrudHandlers` slots with the optional `options` arg. **Do not retype** `EntityServerSpec.hooks`/`duplicate` — only add an `@deprecated` JSDoc tag. Bivariance disables **stay** (→ D). **⚠️ merge-conflict surface with #285.**
- `src/shared/dal/server/lib/create-crud-dal.ts` — `configFactory` second arg, late-bound bootstrap, uniform `cfg` via `@deprecated synthesizeFromSpec` (throwaway delete-bridging adapter), two-layer hook execution, empty-update G7 (inline no-op), delete-row G4. Impls call `db` directly (no tx seam).
- `src/trpc/lib/create-crud-router.ts` — make `crud` a **required** config field; delete the internal `createCrudDal(config.spec)` rebuild + import.
- **5 router call sites** pass their existing `*Crud`: `applications`, `customers`, `proposals`, `customer-notes`, `meetings` `.router` — one import + one `crud:` line each. Unmigrated specs stay zero-diff (hooks on the `@deprecated` spec, synthesized).
- **Proof entity = meetings** (2 more files): `lib/server-spec.ts` (delete hooks + `duplicate` → pure identity) + `dal/server/crud.ts` (add the config factory to the already-present `meetingCrud`; `delete.before` rewritten to take the row). Its router `crud:` line is already covered above.

---

## 5. Done-when

1. `createCrudDal(spec, configFactory?)` compiles; `EntityServerSpec` (unchanged signatures, `hooks`/`duplicate` now `@deprecated`) still `satisfies` on all 16 specs; the 3 unmigrated hook specs are **zero-diff** and fire identically via `synthesizeFromSpec`.
2. **Meetings** fully runs on the config factory: hooks + duplicate live in `dal/server/crud.ts`, `lib/server-spec.ts` is pure identity, `meetings.router/crud.router.ts` passes `crud: meetingCrud`, and its invariants fire with **no raw `db`** in any hook (the `delete.before` gcalEventId read is gone — G4 supplies the row).
3. `crud.update(ctx, { id, data: {} })` bumps `updatedAt` and returns the row (G7 — verified by a temporary `tsx` script against dev DB); meetings' `delete` hook receives the row (G4).
4. `createCrudRouter.crud` is **required**; the internal `createCrudDal` rebuild is gone; all 5 call sites pass their `*Crud`. No code path yields un-hooked handlers.
5. Green `pnpm tsc` + `pnpm lint`.

*(Bivariance-disable drop, type purification + `synthesizeFromSpec` deletion, `after`→strict-`Row`, and the `ctx.tx` seam are later-sub-plan done-whens, not A's.)*

---

## 6. Risks & watch-items

- **⚠️ Import cycles.** Concentrating hooks in `crud.ts` pulls services + other-entity cruds into it; a cross-entity hook read (proposals `crud.ts` → `meetingCrud`) risks a cycle if reciprocal. Mitigate with `import type` / lazy import at the hook boundary; verify with `tsc` + a cycle check. This is the one place the relocation can bite.
- **⚠️ `types.ts` merge conflict with #285** — coordinate landing order; rebase the loser.
- **empty-`.set()` handling** — ✅ resolved as a **no-op** (§2.5): detect empty-after-before-hooks, `getById`-and-return, no write. No Drizzle-internal introspection, no `updatedAt` bump. Matches `updateProject`'s existing guard — no business-rule change, nothing downstream to re-confirm.

---

## 7. Open questions for writing-plans

None architectural — the model is locked, and the A/D purity boundary is now settled (§2.1: A keeps `hooks`/`duplicate` deprecated + retyped and relocates meetings only; D purifies). The plan (`docs/superpowers/plans/2026-08-16-crud-dal-sub-plan-a-factory-config-hooks.md`) sequences: (1) `types.ts` single-sourced hook surface + `@deprecated` tags, (2) `create-crud-dal.ts` internals incl. `@deprecated synthesizeFromSpec` + G7 no-op, (3) `create-crud-router.ts` **required-`crud`** + wire all 5 call sites, (4) meetings relocation, then tsc/lint + G7/G4 runtime verification. Meetings is the proof over proposals — proposals exercises threaded `after` (finalTcp merge); meetings exercises delete-row (G4) + more invariants. **Recommend meetings** — three converging reasons now verified:
1. Its `crud.ts` **already exists** as the bare `createCrudDal(meetingServerSpec)` ([meetings/dal/server/crud.ts](src/shared/entities/meetings/dal/server/crud.ts)) — A's proof work is literally "add the config-factory second arg + move hooks off the spec into this file," the minimal true demonstration.
2. `lib/server-spec.ts` currently `import { db } from '@/shared/db'` for a raw read inside a hook — **exactly** the circular-barrier smell (§1.1). G4 (delete gets the row) makes `gcalEventId` available in the prefetched snapshot, **deleting that raw-`db` read** — a concrete before/after win the spec can point at.
3. Rich invariants (create.before owner-resolution, create.after participant+gcal+graduation+capi, update.before pipeline-derivation, update.after gcal+notify) prove the two-layer onion without dragging in proposals' financial recompute (D/5.3).
- **Accepted trade-off:** meetings' `after` hooks are side-effects that return void (coalesced back to the row via `?? result`), so the return-value **threading** (§2.4) is compile-exercised but not behavior-exercised. The first *meaningful* threaded `after` (proposals' `finalTcp` merge) lands in D. Acceptable — A proves the mechanism type-checks and fires; D proves the transform does work.
