# S6a — Collapse `createEntityRouter` (crud builds procedures inline) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `createCrudRouter` builds its scoped procedures inline from `config.spec` instead of taking them as params, so proposals' `crud` becomes a standalone leaf and `createEntityRouter` collapses — no cast, no added generics.

**Architecture:** The scoped agent/shareable procedures move *inside* `createCrudRouter`, built with the cast-free inline `.use()` pattern (the same `resolveVisibilityScope` + `shareableMiddleware` the toolkit uses). Removing the two params changes the factory's interface, so all five crud call sites drop those args (behavior-identical). Entities whose `entity` toolkit arg becomes unused (proposals, customer-notes) shed `createEntityRouter`; the other three keep it for their non-crud leaves (→ S6b).

**Tech Stack:** TypeScript, tRPC v11, Zod, pnpm. Verification is `pnpm tsc` + `pnpm lint` + path stability (no router unit-test suite — epic convention).

**Spec:** `docs/superpowers/specs/2026-08-10-s6a-collapse-create-entity-router-design.md`

## Global Constraints

- **Behavior byte-for-byte identical.** Each entity's inline-built procedure must equal what the toolkit built from the same spec (`agentProcedure.use(scopeMiddleware(spec))` + `baseProcedure.use(shareableMiddleware(spec))`). No runtime logic change.
- **No cast, no `@ts-` suppression, no added generics** on `createCrudRouter`. Its signature returns to exactly its original four generics (`TTable, TId, TInsert, TUpdate`). If you reach for a cast or a `ProcedureBuilder`/`AnyProcedureBuilder` type, stop — the inline construction is specifically designed to avoid naming any builder type.
- **Type fidelity preserved.** The built CRUD routers' input/output types stay concrete (NOT `any`), and resolver `ctx` is not `any`. `pnpm tsc` passing is necessary but NOT sufficient — a prior attempt collapsed the router types to `any` and still passed tsc. Prove fidelity with a throwaway wrong-shape probe (Task 1 Step 6).
- **tRPC paths unchanged:** every `*.crud.*` path and sub-path identical → zero client changes.
- **`pnpm tsc` + `pnpm lint` green.** NEVER run `pnpm build`. Pre-existing unrelated working-tree errors from other uncommitted slices — `src/features/campaigns-admin/ui/components/leads/lead-drawer-identity.tsx`, `src/shared/components/customer-search.tsx`, `src/trpc/server.ts:6` — are out of scope; do not touch them, introduce no NEW errors.
- **Do NOT delete `create-entity-router.ts` or `entity-registry.ts`** — customers/meetings/applications still use them (→ S7).
- **Git discipline:** work on `main`, stage explicitly by path, never `git add -A`, never commit without the user's go-ahead. Task "Verify" gates run tsc/lint only.
- Lint import ordering via `perfectionist/sort-imports`; autofix `npx eslint --fix <files>`.

---

## File Structure

- `src/trpc/lib/create-crud-router.ts` — **modify.** Build the two procedures inline from `config.spec`; delete the two config fields.
- `src/trpc/routers/customer-notes.router/index.ts` — **modify.** Drop 2 crud args → `entity` unused → drop `createEntityRouter`, become pure.
- `src/trpc/routers/customers.router/index.ts` — **modify.** Drop only the 2 crud args (keep factory).
- `src/trpc/routers/meetings.router/index.ts` — **modify.** Drop only the 2 crud args (keep factory).
- `src/trpc/routers/applications.router/index.ts` — **modify.** Drop only the 2 crud args (keep factory).
- `src/trpc/routers/proposals.router/index.ts` — **modify.** Drop 2 crud args → `entity` unused → drop `createEntityRouter`; pure composition (crud inline in Task 1, extracted in Task 2).
- `src/trpc/routers/proposals.router/crud.router.ts` — **create (Task 2).** Standalone `crudRouter` leaf.

---

### Task 1: `createCrudRouter` builds procedures inline; all five call sites drop args

**Files:**
- Modify: `src/trpc/lib/create-crud-router.ts`
- Modify: `src/trpc/routers/{customers,meetings,applications,customer-notes,proposals}.router/index.ts`

**Interfaces:**
- Consumes: `agentProcedure`, `baseProcedure` (`@/trpc/init`); `resolveVisibilityScope` (`./middleware/scope-middleware`); `shareableMiddleware` (`./middleware/shareable-middleware`); `config.spec` (already on the config).
- Produces: `createCrudRouter(config)` with config shape `{ spec, schemas, handlers? }` — **no** `authedProcedure`/`shareableProcedure` fields.

- [ ] **Step 1: Baseline the in-scope files (they must not regress beyond pre-existing unrelated errors)**

Run: `pnpm tsc 2>&1 | grep -E "error TS" | sed 's/(.*//' | sort -u`
Expected: only `src/features/campaigns-admin/ui/components/leads/lead-drawer-identity.tsx`, `src/shared/components/customer-search.tsx` (and `src/trpc/server.ts:6` for the trailing-space rule). None of the files this task edits appear. Record this as your baseline.

- [ ] **Step 2: Rewrite the imports + procedure construction in `create-crud-router.ts`**

Change the `agentProcedure`/`baseProcedure` import from type-only to a value import, and add the two middleware helpers. Replace this (lines ~9):
```ts
import type { agentProcedure, baseProcedure } from '@/trpc/init'
```
with a value import in the correct group, and add the helpers:
```ts
import { agentProcedure, baseProcedure } from '@/trpc/init'
import { resolveVisibilityScope } from './middleware/scope-middleware'
import { shareableMiddleware } from './middleware/shareable-middleware'
```
(`createTRPCRouter` is already imported from `@/trpc/init` — keep it.)

- [ ] **Step 3: Delete the two procedure fields from `CreateCrudRouterConfig`**

Remove these two fields (and their doc comments) from the interface (lines ~43-46):
```ts
  /** Pre-scoped agent procedure (agentProcedure + scope middleware). */
  authedProcedure: typeof agentProcedure
  /** Pre-scoped shareable procedure (baseProcedure + shareable middleware). */
  shareableProcedure: typeof baseProcedure
```
Leave the interface's four generics (`TTable, TId, TInsert, TUpdate`) and the `spec`/`schemas`/`handlers` fields unchanged. The `createCrudRouter<...>` function signature keeps exactly those four generics — add nothing.

- [ ] **Step 4: Build the two procedures inline at the top of the function body**

At the start of `createCrudRouter`'s body (just after the `handlers` merge, before the `readProcedure`/`updateProcedure` selection ~line 71), construct them from `config.spec` with the cast-free inline pattern (mirrors `proposals.router/procedures.ts`):
```ts
  // Scoped procedures built inline from the spec — the cast-free inline `.use()`
  // pattern (ctx infers from agentProcedure, so no `as typeof agentProcedure`).
  // Equivalent to what createEntityRouter's toolkit built from the same spec.
  const authedProcedure = agentProcedure.use(async ({ ctx, next }) =>
    next({ ctx: { ...ctx, scope: resolveVisibilityScope(config.spec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
  const shareableProcedure = baseProcedure.use(shareableMiddleware(config.spec))
```
Then update the two selection lines to use the local consts (drop the `config.` prefix):
```ts
  const readProcedure = config.spec.shareable ? shareableProcedure : authedProcedure
  const updateProcedure = config.spec.shareable ? shareableProcedure : authedProcedure
```
And in the `create`/`delete`/`duplicate` slots, replace `config.authedProcedure` with the local `authedProcedure` (three occurrences at ~lines 100, 127, 134). Leave everything else in the body byte-identical.

- [ ] **Step 5: Drop the 2 crud args at all five call sites**

In each of these, remove the `authedProcedure: entity.authedProcedure,` and `shareableProcedure: entity.shareableProcedure,` lines from the `createCrudRouter({...})` call, keeping `spec`, `schemas`, and any `handlers`:
- `src/trpc/routers/customers.router/index.ts` — keep the `handlers.getById` override; keep `createEntityRouter` + `entity` (still used by `profile`/`business`).
- `src/trpc/routers/meetings.router/index.ts` — keep `createEntityRouter` + `entity` (used by `reads`/`participants`/`business`).
- `src/trpc/routers/applications.router/index.ts` — keep `createEntityRouter` + `entity` (used by `business`/`draft`).

Then the two entities where `entity` becomes unused after the drop — migrate them off the factory:

- `src/trpc/routers/customer-notes.router/index.ts` — replace the whole factory with a pure router (drop the `createEntityRouter` import):
```ts
import z from 'zod'

import { customerNoteSchemas, customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'

export const customerNotesRouter = createTRPCRouter({
  crud: createCrudRouter({
    spec: customerNoteServerSpec,
    schemas: { ...customerNoteSchemas, id: z.string().uuid() },
  }),
})
```

- `src/trpc/routers/proposals.router/index.ts` — drop `createEntityRouter` + the `(entity) =>` factory; `index.ts` becomes pure composition with `crud` **inline** (the standalone-file extraction is Task 2). Remove the now-unused `createEntityRouter` import; keep `createCrudRouter`, `z`, `duplicateProposalWithIncentives`, `proposalSchemas`, `proposalServerSpec`:
```ts
export const proposalsRouter = createTRPCRouter({
  crud: createCrudRouter({
    spec: proposalServerSpec,
    schemas: { ...proposalSchemas, id: z.string().uuid() },
    handlers: { duplicate: duplicateProposalWithIncentives },
  }),
  business: businessRouter,
  incentives: incentivesRouter,
  funding: fundingRouter,
  delivery: deliveryRouter,
  views: viewsRouter,
  contracts: contractsRouter,
  media: proposalMediaRouter,
})
```

- [ ] **Step 6: Prove type fidelity (tsc-clean is NOT sufficient — a prior attempt collapsed types to `any` and still passed)**

Temporarily add a wrong-shape CRUD call in a scratch spot you will delete — e.g. in `proposals.router/index.ts` add on its own line inside the file (not inside the router object):
```ts
// SCRATCH — must ERROR; delete before finishing:
const _probe = createCrudRouter({ spec: proposalServerSpec, schemas: { ...proposalSchemas, id: z.string().uuid() } })
type _In = Parameters<typeof _probe.getById>[0] // inspect: must NOT be `any`
```
Better/decisive: build the router, then assert a bogus input is rejected. Run `pnpm tsc` and confirm the built procedures' input type is concrete (hover or a `@ts-expect-error` on a wrong-shape input must itself be satisfied). If a wrong-shape input does NOT error, the types are `any` — the inline construction is wrong; fix before proceeding. **Delete the scratch probe** once confirmed.

- [ ] **Step 7: Verify — lint + tsc clean, no new errors, no cast**

Run: `npx eslint --fix src/trpc/lib/create-crud-router.ts src/trpc/routers/{customers,meetings,applications,customer-notes,proposals}.router/index.ts`
Then: `pnpm lint 2>&1 | grep -v "server.ts" | grep -E "error|warning" || echo "LINT CLEAN"`
Then: `pnpm tsc 2>&1 | grep -v "src/trpc/server.ts(6" | grep -E "error TS" | sed 's/(.*//' | sort -u`
Expected: `LINT CLEAN`; and tsc shows ONLY the two pre-existing unrelated files from Step 1 — no new files, nothing in `create-crud-router.ts` or any `*.router/index.ts` you touched.
Then confirm no cast crept in: `grep -n "as typeof\|as unknown\|AnyProcedureBuilder\|@ts-" src/trpc/lib/create-crud-router.ts || echo "NO CASTS"` → expect `NO CASTS`.

---

### Task 2: Extract proposals' inline crud into a standalone `crud.router.ts` leaf

**Files:**
- Create: `src/trpc/routers/proposals.router/crud.router.ts`
- Modify: `src/trpc/routers/proposals.router/index.ts`

**Interfaces:**
- Consumes: `createCrudRouter` (Task 1 shape — `{ spec, schemas, handlers? }`); `proposalServerSpec`, `proposalSchemas`; `duplicateProposalWithIncentives`.
- Produces: `export const crudRouter`; composed in `index.ts` under the `crud` key. tRPC path `proposals.crud.*` unchanged.

- [ ] **Step 1: Create `crud.router.ts`**

Create `src/trpc/routers/proposals.router/crud.router.ts` — move the `crud` config out of `index.ts`, carrying its load-bearing comments (getById phone-gate/row-shape note; the `crud.duplicate` override rationale):
```ts
// ─── Proposals CRUD Router ──────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
// see ../../DOCS.md#crud-five-slots-fixed
//
// crud.duplicate is overridden — the generic duplicateImpl only copies the
// parent row, never `proposal_incentives` (a Wave-2 child table), which would
// silently drop discounts/exclusive-offers on the copy. Create enrichment and
// duplicate config live on proposalServerSpec.hooks and .duplicate.
// see ../../../shared/entities/proposals/DOCS.md#duplicate-resets-and-redrives

import z from 'zod'

import { duplicateProposalWithIncentives } from '@/shared/entities/proposals/dal/server/duplicate'
import { proposalSchemas, proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { ...proposalSchemas, id: z.string().uuid() },
  handlers: { duplicate: duplicateProposalWithIncentives },
})
```

- [ ] **Step 2: Reduce `index.ts` to pure composition importing `crudRouter`**

Replace `proposals.router/index.ts` with imports + one `createTRPCRouter`. Drop the now-unused `createCrudRouter`, `z`, `duplicateProposalWithIncentives`, `proposalSchemas`, `proposalServerSpec` imports:
```ts
// Proposals router — pure composition. Every leaf is its own file. No
// createEntityRouter: crud builds its procedures inline from the spec (S6a).
// see ../../DOCS.md#entity-router-via-factory (rewritten in S7)

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
  crud: crudRouter,
  business: businessRouter,
  incentives: incentivesRouter,
  funding: fundingRouter,
  delivery: deliveryRouter,
  views: viewsRouter,
  contracts: contractsRouter,
  media: proposalMediaRouter,
})
```

- [ ] **Step 3: Verify**

Run: `npx eslint --fix src/trpc/routers/proposals.router/crud.router.ts src/trpc/routers/proposals.router/index.ts`
Then: `pnpm lint 2>&1 | grep -v "server.ts" | grep -E "error|warning" || echo "LINT CLEAN"`
Then: `pnpm tsc 2>&1 | grep -v "src/trpc/server.ts(6" | grep -E "error TS" | sed 's/(.*//' | sort -u`
Expected: `LINT CLEAN`; tsc shows only the two pre-existing unrelated files.
Then: `grep -rn "createEntityRouter" src/trpc/routers/proposals.router/ | grep -v "// " || echo "NO createEntityRouter IN PROPOSALS"` → expect the "NO" line.

---

## Self-Review

**Spec coverage:**
- Build procedures inline in `createCrudRouter` → Task 1 Steps 2-4. ✅
- Drop the 2 params + all 5 call sites → Task 1 Steps 3, 5. ✅
- customer-notes + proposals shed the factory → Task 1 Step 5. ✅
- customers/meetings/applications keep factory, drop args → Task 1 Step 5. ✅
- Standalone proposals `crud.router.ts` → Task 2. ✅
- Type-fidelity gate (the prior failure mode) → Task 1 Step 6; no-cast gate → Task 1 Step 7. ✅
- Do-not-delete factory/registry files → Global Constraints. ✅

**Placeholder scan:** No TBD/TODO; every code step has the actual code. The scratch probe (Task 1 Step 6) is explicitly throwaway with a delete instruction.

**Type consistency:** `crudRouter` exported by `crud.router.ts` and imported under the same name in `index.ts`. `createCrudRouter` config shape (`{ spec, schemas, handlers? }`) is identical between Task 1's five call sites and Task 2's `crud.router.ts`.
