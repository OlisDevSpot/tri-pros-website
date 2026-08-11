# S6b — Collapse `createEntityRouter` on customers / meetings / applications

> Part of the tRPC Layer Standardization Epic
> (`docs/plans/2026-08-09-trpc-standardization-epic.md`). Finishes what S6a
> started: S6a made `createCrudRouter` build its scoped procedures inline and
> took proposals + customer-notes off the factory. S6b carries the same
> factory-free shape to the last three `createEntityRouter` holdouts.

**Goal:** Make the customers, meetings, and applications tRPC routers
factory-free — each with a `procedures.ts` (scoped procedures defined once),
standalone leaf files importing those procedures, a standalone `crud.router.ts`,
and an `index.ts` reduced to pure composition — so that **nothing imports
`createEntityRouter` or `EntityToolkit` any more**. That is the precondition
S7 needs to delete the factory + registry.

## Background

The epic replaces the `createEntityRouter` factory + `EntityToolkit` argument
with per-entity procedures defined once in `<entity>.router/procedures.ts`, and
pure composition in `index.ts`. Proposals is the fully-migrated reference:
`procedures.ts` (pre-scoped `proposalProcedure` / `proposalShareableProcedure` /
`proposalPublicProcedure` built via the cast-free inline `.use()` pattern),
every sub-router a plain leaf importing from `./procedures`, `crud` extracted to
`crud.router.ts` (which after S6a builds its own procedures inline from the
spec), and `index.ts` a flat `createTRPCRouter({ crud: crudRouter, … })`.

After S6a, three routers still call `createEntityRouter(...spec, entity => …)`
and thread `entity.authedProcedure` / `entity.publicProcedure` into their crud
override and sub-routers:

- **customers** (`customers.router/`): `index.ts` (crud with a `getById`
  phone-gating override + an inline `profile` sub-router on
  `entity.authedProcedure`) + `business.router.ts`
  (`createCustomerBusinessRouter(entity)` — `list`/`search` on
  `entity.authedProcedure`, `createFromIntake` on `entity.publicProcedure`).
- **meetings** (`meetings.router/`): `index.ts` (plain crud) +
  `business.router.ts` / `reads.router.ts` / `participants.router.ts` — three
  `create*Router(entity)` factory functions, all `entity.authedProcedure` only.
- **applications** (`applications.router/`): `index.ts` (plain crud + inline
  `business` and `draft` sub-routers, all `entity.authedProcedure`).

Verified facts (2026-08-11, read from disk):
- `entity` is referenced in each router only to reach `.authedProcedure` /
  `.publicProcedure`. No sub-router uses `entity.shareableProcedure`.
- **None** of `customerServerSpec`, `meetingServerSpec`,
  `applicationServerSpec` declares `shareable` → no shareable procedure is
  needed in any of the three `procedures.ts`; `createCrudRouter` already
  falls back to its inline authed procedure when `spec.shareable` is falsy.
- Only **customers** has a public entrypoint (`createFromIntake` on
  `entity.publicProcedure`) → only customers' `procedures.ts` needs a public
  procedure.
- The inline-`.use()` pattern from proposals `procedures.ts` is cast-free:
  `agentProcedure.use(async ({ ctx, next }) => next({ ctx: { ...ctx, scope:
  resolveVisibilityScope(spec, { userId: ctx.session.user.id, ability:
  ctx.ability }) } }))`. `resolveVisibilityScope` and `shareableMiddleware`
  are spec-generic; `agentProcedure` / `baseProcedure` / `createTRPCRouter`
  come from `../../init`.

## Approach

Apply the proposals shape to each of the three entities. Per-entity procedures
follow the `<entity>Procedure` naming; intra-entity leaf files export the
unprefixed `crudRouter` / `businessRouter` / `readsRouter` / `participantsRouter`
/ `profileRouter` / `draftRouter` — matching proposals' convention exactly.

**Per-entity `procedures.ts` (defined once):**

- **customers** — `customerProcedure` (agent, inline scope from
  `customerServerSpec`) + `customerPublicProcedure` (`= baseProcedure`).
- **meetings** — `meetingProcedure` (agent, inline scope from
  `meetingServerSpec`).
- **applications** — `applicationProcedure` (agent, inline scope from
  `applicationServerSpec`).

Each carries the same header rationale as proposals' `procedures.ts` (why the
scope step is inlined, not `.use(scopeMiddleware(spec))`; server-spec stays a
pure data object).

**Per-entity `crud.router.ts`** — extract each existing `crud:
createCrudRouter({…})` config into `export const crudRouter = createCrudRouter({…})`,
verbatim including handlers/comments:
- customers keeps its `getById` phone-gating override + the full comment block.
- meetings / applications are plain `{ spec, schemas }`.

**Sub-router conversions (factory → plain leaf):**
- customers `business.router.ts`: `createCustomerBusinessRouter(entity)` →
  `export const businessRouter = createTRPCRouter({…})`; swap
  `entity.authedProcedure`→`customerProcedure` (list, search),
  `entity.publicProcedure`→`customerPublicProcedure` (createFromIntake). Drop
  the `EntityToolkit` / `PgTable` type imports.
- meetings `business.router.ts` / `reads.router.ts` / `participants.router.ts`:
  each `create*Router(entity)` → `export const <name>Router = createTRPCRouter({…})`;
  `entity.authedProcedure`→`meetingProcedure`. Drop `EntityToolkit` / `PgTable`.

**Inline sub-router extraction (index → own file):**
- customers `profile` → `profile.router.ts` (`export const profileRouter`),
  `customerProcedure`.
- applications `business` → `business.router.ts` (`export const businessRouter`)
  and `draft` → `draft.router.ts` (`export const draftRouter`), both
  `applicationProcedure`.

**Each `index.ts` → pure composition**, dropping `createEntityRouter` and its
`entity =>` closure, importing the leaves:
- customers: `createTRPCRouter({ crud: crudRouter, profile: profileRouter, business: businessRouter })`.
- meetings: `createTRPCRouter({ crud: crudRouter, reads: readsRouter, participants: participantsRouter, business: businessRouter })`.
- applications: `createTRPCRouter({ crud: crudRouter, business: businessRouter, draft: draftRouter })`.

Router key order is preserved exactly (customers: crud, profile, business;
meetings: crud, reads, participants, business; applications: crud, business,
draft) so every tRPC path is byte-for-byte unchanged.

## Scope

Three independent entities → **one slice, one task per entity** (customers,
meetings, applications). Each task is self-contained, tsc-green on its own, and
independently reviewable; there is no cross-entity dependency.

**In scope (per entity):**

| Entity | Create | Modify |
|---|---|---|
| customers | `procedures.ts`, `crud.router.ts`, `profile.router.ts` | `business.router.ts` (factory→leaf), `index.ts` (pure) |
| meetings | `procedures.ts`, `crud.router.ts` | `business.router.ts`, `reads.router.ts`, `participants.router.ts` (factory→leaf), `index.ts` (pure) |
| applications | `procedures.ts`, `crud.router.ts`, `business.router.ts`, `draft.router.ts` | `index.ts` (pure) |

**Out of scope / deferred:**
- `create-entity-router.ts` + `entity-registry.ts` deletion, ADR-0002
  amendment, `src/trpc/DOCS.md` rewrite → **S7** (unblocked once this lands).
- The pre-existing `createCrudRouter` `id`-infers-as-`unknown` gap → epic
  Pending Fixes (untouched here).

## Testing

This repo has no router unit-test suite; the epic gates router-shape slices on
`pnpm tsc` + `pnpm lint` + tRPC-path stability.

1. `pnpm tsc` — no NEW errors. Type fidelity preserved: the built CRUD routers'
   input/output types and resolver `ctx` stay concrete (not `any`) — a
   wrong-shape call to any crud/sub-router procedure is still a tsc error.
2. `pnpm lint` — clean (autofix import order with `npx eslint --fix`).
3. tRPC paths unchanged: `customers.*`, `meetings.*`, `applications.*` and every
   sub-path identical → zero client changes.
4. Behavior identical: each entity's inline-built `<entity>Procedure` equals
   what the toolkit built from the same spec (`agentProcedure.use(scopeMiddleware(spec))`),
   minus the cast; `customerPublicProcedure` equals the toolkit's
   `publicProcedure` (`= baseProcedure`).
5. Grep gate: after all three tasks, `createEntityRouter` and `EntityToolkit`
   have **zero import sites** across `src/` → S7 can delete them.

## Knock-on to the epic

- **S7** unblocked: with customers/meetings/applications off the factory, and
  proposals + customer-notes already migrated in S6a, nothing imports
  `create-entity-router.ts` or `entity-registry.ts` → delete both, rewrite
  ADR-0002 + `src/trpc/DOCS.md`.
