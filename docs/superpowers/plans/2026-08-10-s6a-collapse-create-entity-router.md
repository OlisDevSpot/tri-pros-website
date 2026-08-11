# S6a — Collapse `createEntityRouter` on proposals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the proposals tRPC router factory-free — a standalone `crud.router.ts` leaf driven by `procedures.ts` — by relaxing `createCrudRouter`'s procedure-param types, so S6b can replicate the clean shape onto the other four entities.

**Architecture:** Three edits to one router + one shared factory. (1) Generalize `createCrudRouter`'s two procedure params to be generic over the tRPC procedure-builder type — a backward-compatible widening that retires the `as typeof agentProcedure` cast. (2) Add `proposals.router/crud.router.ts`, a plain leaf importing the pre-scoped procedures from `./procedures` with no cast. (3) Reduce `proposals.router/index.ts` to pure `createTRPCRouter({...})`, dropping `createEntityRouter`.

**Tech Stack:** TypeScript, tRPC v11 (`@trpc/server` ^11.4.1), Zod, pnpm. Verification is `pnpm tsc` + `pnpm lint` (no router unit-test suite exists — this is the epic's established gate for router-shape slices).

**Spec:** `docs/superpowers/specs/2026-08-10-s6a-collapse-create-entity-router-design.md`

## Global Constraints

- **Behavior byte-for-byte identical.** No runtime logic changes; this is a typing + file-organization slice only.
- **tRPC paths unchanged.** `proposals.crud.getById|create|update|delete|duplicate` and every other `proposals.*` sub-path stay identical → zero client changes.
- **`pnpm tsc` + `pnpm lint` must be green.** NEVER run `pnpm build`. The only tolerated pre-existing failure is `src/trpc/server.ts:6` (trailing-space WIP, unrelated to this slice) — do not touch it, do not let any NEW error appear.
- **The four still-on-toolkit routers must compile UNCHANGED** — `customers`, `meetings`, `applications`, `customer-notes` still call `createEntityRouter` and pass `entity.authedProcedure` (typed `typeof agentProcedure`). The `createCrudRouter` change must be a widening they satisfy without edits. Do not modify them.
- **Do NOT delete `create-entity-router.ts` or `entity-registry.ts`.** They still have four consumers; deletion is S7.
- **Lint import ordering** is enforced by `perfectionist/sort-imports`; autofix with `npx eslint --fix <files>` on touched files.
- **Git discipline:** work on `main`, stage explicitly by path (never `git add -A`), never commit without the user's explicit go-ahead. Task "Verify" gates below run tsc/lint; whether to stage/commit is the user's call at execution handoff.

---

## File Structure

- `src/trpc/lib/create-crud-router.ts` — **modify.** Add two generic type params (`TAuthed`, `TShareable`) bounded by `AnyProcedureBuilder`, defaulting to `typeof agentProcedure` / `typeof baseProcedure`. Body unchanged.
- `src/trpc/routers/proposals.router/crud.router.ts` — **create.** Plain leaf: `export const crudRouter = createCrudRouter({...})` with the proposals spec/schemas/duplicate override, importing procedures from `./procedures`.
- `src/trpc/routers/proposals.router/index.ts` — **modify.** Drop `createEntityRouter` + the inline `createCrudRouter` call; become pure composition importing `crudRouter` from `./crud.router`.

---

### Task 1: Generalize `createCrudRouter` procedure-param types

**Files:**
- Modify: `src/trpc/lib/create-crud-router.ts` (imports ~line 9; interface `CreateCrudRouterConfig` lines 28-55; function signature lines 57-62)

**Interfaces:**
- Consumes: tRPC's `AnyProcedureBuilder` type (from `@trpc/server/unstable-core-do-not-import`); the existing `typeof agentProcedure` / `typeof baseProcedure` (from `@/trpc/init`).
- Produces: `createCrudRouter` now accepts `authedProcedure: TAuthed` / `shareableProcedure: TShareable` where `TAuthed extends AnyProcedureBuilder = typeof agentProcedure` and `TShareable extends AnyProcedureBuilder = typeof baseProcedure`. Callers passing either a cast `typeof agentProcedure` OR an inline-scoped `agentProcedure.use(...)` builder now type-check with no cast.

**Why this shape:** the two params are only ever used as `procedure.input(...).query|mutation(...)`. Widening them to a generic builder bound keeps the built router's IO types intact (those derive from the Zod input schemas and the concrete `CrudHandlers<TTable,TId>` handler returns, not from the procedure's context type), so the client contract is unchanged. `AnyProcedureBuilder` lives only in tRPC's `unstable-core-do-not-import` subpath — that is the sanctioned (if awkwardly named) alias; keep the import confined to this one file with an explanatory comment.

- [ ] **Step 1: Record the baseline — the four toolkit routers + client currently compile**

Run: `pnpm tsc 2>&1 | grep -E "create-crud-router|customers.router|meetings.router|applications.router|customer-notes.router" || echo "NO PRE-EXISTING ERRORS IN SCOPE"`
Expected: `NO PRE-EXISTING ERRORS IN SCOPE` (baseline is clean for the files this task must not regress).

- [ ] **Step 2: Add the `AnyProcedureBuilder` import**

In `src/trpc/lib/create-crud-router.ts`, add to the type-import group (near the existing `import type { agentProcedure, baseProcedure } from '@/trpc/init'` at line 9):

```ts
// tRPC does not publicly re-export its procedure-builder type outside the
// `unstable-core-do-not-import` subpath. It is the correct alias for "a
// procedure builder of any middleware depth" — needed so this factory accepts
// both the cast `typeof agentProcedure` (toolkit callers) and the inline-scoped
// `agentProcedure.use(...)` builders from an entity's procedures.ts, with no cast.
import type { AnyProcedureBuilder } from '@trpc/server/unstable-core-do-not-import'
```

Keep the existing `import type { agentProcedure, baseProcedure } from '@/trpc/init'` — the generic defaults still reference `typeof agentProcedure` / `typeof baseProcedure`.

- [ ] **Step 3: Add the two generic params to the config interface**

In `CreateCrudRouterConfig` (lines 28-33), append two type params after `TUpdate`:

```ts
export interface CreateCrudRouterConfig<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
  TAuthed extends AnyProcedureBuilder = typeof agentProcedure,
  TShareable extends AnyProcedureBuilder = typeof baseProcedure,
> {
```

Then change the two procedure fields (lines 43-46) from the concrete types to the generic params:

```ts
  /** Pre-scoped agent procedure — any middleware-depth builder (was `typeof agentProcedure`). */
  authedProcedure: TAuthed
  /** Pre-scoped shareable procedure — any middleware-depth builder (was `typeof baseProcedure`). */
  shareableProcedure: TShareable
```

- [ ] **Step 4: Thread the two generic params through the function signature**

In `createCrudRouter` (lines 57-62), mirror the interface's type params so they are inferred from the `config` argument:

```ts
export function createCrudRouter<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
  TAuthed extends AnyProcedureBuilder = typeof agentProcedure,
  TShareable extends AnyProcedureBuilder = typeof baseProcedure,
>(config: CreateCrudRouterConfig<TTable, TId, TInsert, TUpdate, TAuthed, TShareable>) {
```

Leave the function body (lines 63-142) untouched — `config.authedProcedure` / `config.shareableProcedure` are still only used via `.input().query()/.mutation()`.

- [ ] **Step 5: Verify — no new errors, four toolkit routers unchanged**

Run: `npx eslint --fix src/trpc/lib/create-crud-router.ts && pnpm lint 2>&1 | grep -v "server.ts" | grep -E "error|warning" || echo "LINT CLEAN"`
Then: `pnpm tsc 2>&1 | grep -v "src/trpc/server.ts(6" | grep -E "error TS" || echo "TSC CLEAN"`
Expected: `LINT CLEAN` and `TSC CLEAN`. In particular there must be zero new errors in `create-crud-router.ts`, `customers.router`, `meetings.router`, `applications.router`, `customer-notes.router` (they must still pass with their existing `entity.authedProcedure` cast — this proves the widening is backward-compatible).

> If `tsc` reports inference failures on the four toolkit callers or on the widened `.query/.mutation` resolvers: the generic bound is the known-fiddly part of this slice. Adjust the bound (e.g. confirm `AnyProcedureBuilder` is imported as a *type*, confirm the defaults still read `typeof agentProcedure`/`typeof baseProcedure`) and re-run. Do NOT fall back to re-adding a cast at the param type — that reintroduces exactly what this slice removes. The success condition is: no cast in `createCrudRouter`'s signature AND all existing callers + client compile.

---

### Task 2: Standalone `crud.router.ts` + pure `index.ts` on proposals

**Files:**
- Create: `src/trpc/routers/proposals.router/crud.router.ts`
- Modify: `src/trpc/routers/proposals.router/index.ts` (full rewrite to composition)

**Interfaces:**
- Consumes: `createCrudRouter` (now generic, from Task 1); `proposalProcedure`, `proposalShareableProcedure` from `./procedures`; `proposalServerSpec`, `proposalSchemas` from `@/shared/entities/proposals/lib/server-spec`; `duplicateProposalWithIncentives` from `@/shared/entities/proposals/dal/server/duplicate`.
- Produces: `export const crudRouter` (a tRPC router with the 5 CRUD slots), composed by `index.ts` under the `crud` key. tRPC path `proposals.crud.*` unchanged.

- [ ] **Step 1: Create `crud.router.ts` as a plain leaf**

Create `src/trpc/routers/proposals.router/crud.router.ts` with the crud config lifted out of `index.ts`, importing pre-scoped procedures from `./procedures` (no cast). Carry the load-bearing comments (getById phone-gate/row-shape note; the `crud.duplicate` override rationale) that currently annotate the crud block in `index.ts`:

```ts
// ─── Proposals CRUD Router ──────────────────────────────────────────────────
// The 5 single-row operations (createCrudRouter). Plain leaf: imports its
// pre-scoped procedures directly from ./procedures — no `createEntityRouter`
// factory, no `as typeof agentProcedure` cast (createCrudRouter's procedure
// params are generic over the builder type as of epic S6a).
// see ../../DOCS.md#crud-five-slots-fixed
//
// crud.duplicate is overridden — the generic duplicateImpl only copies the
// parent row, never `proposal_incentives` (a Wave-2 child table), which would
// silently drop discounts/exclusive-offers on the copy. Create enrichment (kind
// derivation, token gen, SOW snapshot) and duplicate config (field exclusion,
// status reset) live on proposalServerSpec.hooks and .duplicate.
// see ../../../shared/entities/proposals/DOCS.md#duplicate-resets-and-redrives

import z from 'zod'

import { duplicateProposalWithIncentives } from '@/shared/entities/proposals/dal/server/duplicate'
import { proposalSchemas, proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'
import { proposalProcedure, proposalShareableProcedure } from './procedures'

export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { ...proposalSchemas, id: z.string().uuid() },
  authedProcedure: proposalProcedure,
  shareableProcedure: proposalShareableProcedure,
  handlers: {
    duplicate: duplicateProposalWithIncentives,
  },
})
```

- [ ] **Step 2: Rewrite `index.ts` to pure composition**

Replace the entire contents of `src/trpc/routers/proposals.router/index.ts` with imports + one `createTRPCRouter`. Drop `createEntityRouter`, the `(entity) =>` factory, the inline `createCrudRouter` call, and the now-unused `z` / `duplicateProposalWithIncentives` / `proposalSchemas` / `proposalServerSpec` / `createCrudRouter` imports:

```ts
// Proposals router — pure composition. Every leaf lives in its own file and
// imports its pre-scoped procedures from ./procedures. No `createEntityRouter`
// factory: the scoped procedures are defined once in ./procedures, and `crud`
// is a standalone leaf (createCrudRouter's params are generic over the builder
// type — epic S6a). see ../../DOCS.md#entity-router-via-factory (rewritten in S7)

import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { contractsRouter } from './contracts.router'
import { crudRouter } from './crud.router'
import { deliveryRouter } from './delivery.router'
import { fundingRouter } from './funding.router'
import { incentivesRouter } from './incentives.router'
import { proposalMediaRouter } from './media.router'
import { viewsRouter } from './views.router'

export const proposalsRouter = createTRPCRouter({
  crud: crudRouter, // 5 single-row operations
  business: businessRouter, // enriched reads + list
  incentives: incentivesRouter, // proposal_incentives replace-all
  funding: fundingRouter, // narrow blob-scalar writes
  delivery: deliveryRouter, // send email, request-to-move-forward
  views: viewsRouter, // proposal_views: recordView (public) + getProposalViews
  contracts: contractsRouter, // envelope lifecycle + agreement context
  media: proposalMediaRouter, // child-scoped via proposalMediaProcedure
})
```

- [ ] **Step 3: Verify — lint + tsc clean, no `createEntityRouter` in proposals**

Run: `npx eslint --fix src/trpc/routers/proposals.router/crud.router.ts src/trpc/routers/proposals.router/index.ts`
Then: `pnpm lint 2>&1 | grep -v "server.ts" | grep -E "error|warning" || echo "LINT CLEAN"`
Then: `pnpm tsc 2>&1 | grep -v "src/trpc/server.ts(6" | grep -E "error TS" || echo "TSC CLEAN"`
Expected: `LINT CLEAN` and `TSC CLEAN`.

- [ ] **Step 4: Confirm the factory is gone from proposals and paths are stable**

Run: `grep -rn "createEntityRouter" src/trpc/routers/proposals.router/ | grep -v "// " || echo "NO createEntityRouter CALLS IN PROPOSALS"`
Expected: `NO createEntityRouter CALLS IN PROPOSALS` (only comment mentions may remain).

Run: `grep -rn "createEntityRouter" src/trpc/lib/create-entity-router.ts src/trpc/lib/entity-registry.ts | head -1 && echo "FACTORY FILES STILL PRESENT (correct — deleted in S7)"`
Expected: the factory + registry files still exist (they serve the four other routers until S6b/S7).

Path stability is guaranteed structurally: the composition keys (`crud`, `business`, `incentives`, `funding`, `delivery`, `views`, `contracts`, `media`) are unchanged from the pre-rewrite `index.ts`, and `crud.router.ts` re-uses the same `createCrudRouter` slots — so `proposals.*` client paths are identical. `pnpm tsc` passing on the whole repo (including client callers of `trpc.proposals.*`) confirms no path/type drift.

---

## Self-Review

**Spec coverage:**
- Spec Change 1 (generalize `createCrudRouter` params) → Task 1. ✅
- Spec Change 2 (`crud.router.ts` leaf) → Task 2 Step 1. ✅
- Spec Change 3 (pure `index.ts`) → Task 2 Step 2. ✅
- Spec "known tricky bit" (generic bound) → Task 1 Step 5 guard note. ✅
- Spec Testing (tsc + lint + four-routers-unchanged + path stability) → Task 1 Step 5, Task 2 Steps 3-4. ✅
- Spec "out of scope: do not delete factory/registry files" → Global Constraints + Task 2 Step 4 assertion. ✅

**Placeholder scan:** No TBD/TODO; every code step carries the actual code. The one iteration-against-compiler note (Task 1 Step 5) is a real, bounded risk with a concrete success condition, not a placeholder.

**Type consistency:** `crudRouter` (exported by `crud.router.ts`) is imported under the same name in `index.ts` and wired as `crud`. `proposalProcedure` / `proposalShareableProcedure` match the exports verified in `procedures.ts`. `TAuthed`/`TShareable` names are identical across the interface and function signature in Task 1.
