# S6a — Collapse `createEntityRouter` (crud builds its procedures inline)

> Part of the tRPC Layer Standardization Epic
> (`docs/plans/2026-08-09-trpc-standardization-epic.md`). Splits the former
> S6 into **S6a** (this slice) and **S6b** (finish customers / meetings /
> applications).
>
> **Revised 2026-08-11.** The first approach — generalize `createCrudRouter`'s
> procedure params over the tRPC builder type — was abandoned: it forced either
> a relocated cast or a generics explosion (the sound bound had to reproduce
> tRPC's entire `ProcedureBuilder` parameter list, and the naive `any` bound
> silently collapsed the built router's IO types to `any`). Root cause: making a
> shared factory *name* a procedure-builder type at a parameter boundary, which
> tRPC cannot cleanly express. The fix removes the boundary entirely.

**Goal:** Make the proposals tRPC router factory-free — a standalone
`crud.router.ts` leaf — by having `createCrudRouter` **build its scoped
procedures inline from the spec it already receives**, instead of taking them as
parameters. No cast, no added generics.

## Background

The epic replaced the `createEntityRouter` factory + `EntityToolkit` argument
with per-entity procedures defined once in `<entity>.router/procedures.ts`. On
proposals, every sub-router except `crud` is already a plain leaf importing its
pre-scoped procedure from `./procedures`. `crud` alone still needs the factory,
because `createCrudRouter` takes `authedProcedure` / `shareableProcedure` as
params typed `typeof agentProcedure` / `typeof baseProcedure`, and the only value
that satisfies those from a post-`.use()` scoped procedure is the toolkit's
`scopedAgentProcedure as typeof agentProcedure` cast
([create-entity-router.ts:44-56](../../../src/trpc/lib/create-entity-router.ts)).

**Why passing the procedure in is the trap:** after `agentProcedure.use(...)`,
the builder's *type* changes (it carries the added `scope`), and tRPC exposes no
type for "a procedure builder of any middleware depth." Any attempt to type such
a parameter precisely forces a cast or an unsound/explosive generic. But the
hand-written leaves have no such problem — they call `proposalProcedure.input().query()`
**directly**, and tRPC infers everything cast-free (the S1 inline-`.use()`
pattern). `createCrudRouter` can do the same: build its procedures inline.

Verified facts (2026-08-10/11):
- In proposals, `entity` is referenced only by `crud`
  ([index.ts:39-40](../../../src/trpc/routers/proposals.router/index.ts)); every
  other sub-router is already a plain leaf.
- `createCrudRouter` uses its two procedure params only via
  `.input().query()/.mutation()` ([create-crud-router.ts:72-140](../../../src/trpc/lib/create-crud-router.ts)).
- The scope helpers are spec-generic: `resolveVisibilityScope(spec: EntityServerSpec, { userId, ability })`
  and `shareableMiddleware(spec: EntityServerSpec)` — the same ones
  `procedures.ts` and the toolkit already use.
- `entity-registry` is write-only (zero readers); an entity dropping out of it
  is behavior-neutral.
- All 5 entities call `createCrudRouter` and pass the two procedure params:
  proposals, customers, meetings, applications, customer-notes.

## Approach

`createCrudRouter` **drops** its `authedProcedure` / `shareableProcedure`
parameters and builds them internally from `config.spec`, using the cast-free
inline pattern:

```ts
const authedProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveVisibilityScope(config.spec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
const shareableProcedure = baseProcedure.use(shareableMiddleware(config.spec))
```

Because these are built and chained inline (never named at a boundary), tRPC
infers their types fully: no cast, no `unstable-core` import, no added generics.
`createCrudRouter`'s signature returns to its original four generics
(`TTable, TId, TInsert, TUpdate`). The built router's IO types and resolver `ctx`
stay concrete. This is behavior-identical to what the toolkit built from the same
spec (`agentProcedure.use(scopeMiddleware(spec))`), minus the cast.

## Scope

Removing the two params changes `createCrudRouter`'s interface, so **all five
crud call sites** are touched — mechanical and behavior-preserving:

**In scope:**

1. **`src/trpc/lib/create-crud-router.ts`** — build the two procedures inline
   from `config.spec`; delete the two config fields + their doc; drop the
   `authedProcedure`/`shareableProcedure` selection to use the local consts.
   Value-import `agentProcedure`/`baseProcedure` (were type-only) +
   `resolveVisibilityScope` + `shareableMiddleware`.
2. **proposals** — drop the 2 crud args; `entity` becomes unused → drop
   `createEntityRouter`; `index.ts` → pure composition; extract the `crud`
   config into a standalone `proposals.router/crud.router.ts` leaf
   (`export const crudRouter = createCrudRouter({ spec, schemas, handlers })`).
3. **customer-notes** — pure-crud; drop the 2 args → `entity` unused → drop
   `createEntityRouter`; `index.ts` → `createTRPCRouter({ crud: createCrudRouter({ spec, schemas }) })`.
4. **customers / meetings / applications** — drop only the 2 dead crud args from
   their existing `createCrudRouter` call. They **keep** `createEntityRouter` +
   the `entity` toolkit for their other leaves (business/reads/participants/
   profile/draft). Their full migration to procedures.ts + standalone
   crud.router.ts stays **S6b**.

**Out of scope / deferred:**
- `create-entity-router.ts` + `entity-registry.ts` are **not deleted** (still
  used by customers/meetings/applications) → S7.
- procedures.ts + standalone crud.router.ts for customers/meetings/applications
  → S6b.
- ADR-0002 amendment + `src/trpc/DOCS.md` rewrite → S7.

## Testing

This repo has no router unit-test suite; the epic gates router-shape slices on
`pnpm tsc` + `pnpm lint` + path stability.

1. `pnpm tsc` — no NEW errors (pre-existing unrelated working-tree errors from
   other uncommitted slices — `lead-drawer-identity.tsx`, `customer-search.tsx`,
   `server.ts:6` — are out of scope). Critically: **type fidelity is preserved**
   — the built CRUD routers' input/output types stay concrete (not `any`), and
   resolver `ctx` is not `any`. tsc-clean alone is not sufficient evidence;
   confirm a wrong-shape call to a CRUD procedure is a tsc error.
2. `pnpm lint` — clean (autofix import order with `npx eslint --fix`).
3. tRPC paths unchanged: `proposals.crud.*` and every other `*.crud.*` and
   sub-path identical → zero client changes.
4. Behavior identical: each entity's inline-built procedure equals what the
   toolkit built from the same spec.

## Knock-on to the epic

- **S6b** shrinks: customer-notes is already done; it now finishes
  customers/meetings/applications (procedures.ts + standalone crud.router.ts +
  drop their `createEntityRouter`).
- **S7** unchanged: delete `create-entity-router.ts` + `entity-registry.ts` once
  those three are off the factory; ADR + DOCS rewrite.
