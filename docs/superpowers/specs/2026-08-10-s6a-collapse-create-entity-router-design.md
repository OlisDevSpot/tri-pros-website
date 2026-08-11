# S6a — Finalize the canonical proposals shape (collapse `createEntityRouter`)

> Part of the tRPC Layer Standardization Epic
> (`docs/plans/2026-08-09-trpc-standardization-epic.md`). Splits the former
> S6 into **S6a** (this slice — finalize the shape on proposals) and **S6b**
> (replicate onto customers / meetings / applications / customer-notes).

**Goal:** Prove the final, factory-free router shape on the proposals router —
a standalone `crud.router.ts` leaf driven by the `procedures.ts` scoped
procedures — so S6b can replicate it verbatim onto the other four entities.
Behavior byte-for-byte identical; `pnpm tsc` + `pnpm lint` green.

## Background

The epic replaced the `createEntityRouter` factory + `EntityToolkit` argument
with define-once procedures in each `<entity>.router/procedures.ts`. On the
proposals router, S1–S5b already moved every sub-router (business, incentives,
funding, delivery, views, contracts, media) onto plain leaves that import their
pre-scoped procedures directly from `./procedures`. The `createEntityRouter`
wrapper now survives for **one reason only**: `crud` (built by
`createCrudRouter`) types its procedure params as `typeof agentProcedure` /
`typeof baseProcedure`, and only the toolkit's `as typeof agentProcedure` cast
([create-entity-router.ts:55](../../../src/trpc/lib/create-entity-router.ts))
satisfies those from a post-`.use()` procedure.

Verified state (2026-08-10):
- In the whole proposals router, `entity` is referenced in exactly one place —
  `crud`'s `authedProcedure` / `shareableProcedure`
  ([index.ts:39-40](../../../src/trpc/routers/proposals.router/index.ts)).
- `createCrudRouter` only ever calls `.input().query()/.mutation()` on those two
  params ([create-crud-router.ts:87+](../../../src/trpc/lib/create-crud-router.ts)) —
  the param types are stricter than the usage.
- `entity-registry` is write-only: `registerEntity` is the sole meaningful
  export and `entityRegistry` has zero readers anywhere in `src/`.
- `proposal-media` already came off the toolkit in S5b (plain leaf on
  `proposalMediaProcedure`).

Therefore, once `createCrudRouter` accepts the inline-scoped procedure, the
factory has no remaining job on proposals and can be dropped from its
`index.ts`.

## Scope

**In scope (proposals only):**

1. **Generalize `createCrudRouter`'s two procedure params.**
2. **Add `proposals.router/crud.router.ts`** — a plain leaf.
3. **Reduce `proposals.router/index.ts` to pure composition** (drop
   `createEntityRouter`).

**Out of scope (deferred):**
- `create-entity-router.ts` and `entity-registry.ts` are **not deleted** —
  customers / meetings / applications / customer-notes still call the factory.
  They are deleted in **S7**, after S6b migrates those four.
- The ADR-0002 amendment and `src/trpc/DOCS.md` rewrite remain in **S7** (docs
  land when the code fully matches).
- No child-entity work, no DAL changes, no scope-semantics changes.

## Design

### Change 1 — Generalize `createCrudRouter` procedure params

**File:** `src/trpc/lib/create-crud-router.ts`

The two params typed as concrete tRPC procedures:

```ts
/** Pre-scoped agent procedure (agentProcedure + scope middleware). */
authedProcedure: typeof agentProcedure
/** Pre-scoped shareable procedure (baseProcedure + shareable middleware). */
shareableProcedure: typeof baseProcedure
```

become generic over the procedure-builder type, bounded to a tRPC procedure
builder that exposes `.input().query()/.mutation()`. The function body is
unchanged — it already only chains those three methods. Both the toolkit's
cast-typed procedures (`typeof agentProcedure`) and the inline-scoped
`procedures.ts` procedures (`agentProcedure.use(...)`) satisfy the looser bound,
so:

- **`crud.router.ts` passes `proposalProcedure` / `proposalShareableProcedure`
  with no cast** — the point of the slice.
- **The four entities still on the toolkit keep compiling unchanged** — a
  backward-compatible widening (a stricter type still satisfies a looser bound).

**Known tricky bit:** pinning the exact tRPC builder type for the generic bound
so both the cast-typed and inline-`.use()` procedures satisfy it. tRPC's
`ProcedureBuilder` type changes shape after every `.use()`, which is the very
reason the cast existed. The implementer must land a bound broad enough to
accept any middleware-depth builder yet precise enough that
`.input().query()/.mutation()` type-check and inference on the resulting router
is preserved (the returned router type must stay identical to today's). This is
the one place the diff is more than mechanical.

### Change 2 — `proposals.router/crud.router.ts`

**File (create):** `src/trpc/routers/proposals.router/crud.router.ts`

A plain leaf, structurally identical to the other proposal sub-routers, that
imports its procedures from `./procedures`:

```ts
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

The load-bearing crud comments currently in `index.ts` — the getById phone-gate
/ row-shape note and the `crud.duplicate` override rationale (it copies
`proposal_incentives`, which the generic `duplicateImpl` would drop) — move here
verbatim with the code they annotate.

### Change 3 — `proposals.router/index.ts` → pure composition

**File (modify):** `src/trpc/routers/proposals.router/index.ts`

Drop the `createEntityRouter(proposalServerSpec, (entity) => …)` wrapper and the
`createCrudRouter` call. The file becomes imports + one `createTRPCRouter`:

```ts
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

- tRPC path `proposals.crud.*` (and every other sub-path) is unchanged → zero
  client changes.
- `createEntityRouter`'s side effect (`registerEntity(proposalServerSpec)`) no
  longer fires for proposals; since the registry has no readers this is
  behavior-neutral.
- Imports removed: `createEntityRouter`, `createCrudRouter`, `z`,
  `duplicateProposalWithIncentives`, `proposalSchemas`/`proposalServerSpec` (all
  now consumed inside `crud.router.ts`).

## Testing

Consistent with every prior slice — this codebase gates router-shape changes on
type-check + lint + path stability, not a unit suite:

1. `pnpm tsc` — clean (only the pre-existing `src/trpc/server.ts:6` WIP
   trailing-space error may remain, unrelated to this slice).
2. `pnpm lint` — clean (import ordering via `perfectionist/sort-imports`;
   autofix with `npx eslint --fix` on touched files).
3. Confirm the four still-on-toolkit routers (customers, meetings, applications,
   customer-notes) compile **unchanged** — proves the `createCrudRouter`
   widening is backward-compatible.
4. Confirm the composed router still exposes `proposals.crud.getById/create/
   update/delete/duplicate` and all other sub-paths (path stability = no client
   breakage).

## Knock-on to the epic

- **S6b** (the former S6 body) now replicates *this finalized shape* —
  `procedures.ts` + standalone `crud.router.ts` + pure `index.ts` — onto
  customers, meetings, applications, customer-notes. No "wrapper lingers for
  crud" caveat anymore.
- **S7** shrinks to pure demolition: delete `create-entity-router.ts` +
  `entity-registry.ts` (now zero consumers), then the ADR-0002 amendment +
  `src/trpc/DOCS.md` rewrite.
- S7's `blocked-by: S4, S5, S6` is satisfied by S6a + S6b together; numbering of
  S7/S8 is unchanged.
