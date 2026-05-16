# Entity Server System

Every business **Entity** (Customer, Meeting, Proposal, Project) declares a typed **EntityServerSpec** consumed by a layered set of factories (`createCrudHandlers`, `createCrudRouter`, `createEntityRouter`) that generate tRPC procedures with uniform auth, visibility scoping, schema validation, and named special-case behaviors (`shareable`, JSONB merge). We chose this over the existing pattern of hand-written tRPC routers because the four entity routers had already drifted into divergent CRUD shapes (procedure names, input schemas, auth checks, visibility wiring) despite the glossary calling them peers — and the `isOmni`-or-predicate dance had been inlined at 30+ sites with no forcing function preventing further drift. This is the server-side counterpart of ADR-0001's Entity Action System: same forcing-function pattern, same typed-registry shape, applied one layer deeper.

## Context

Audit of the tRPC layer surfaced five frictions that convention alone wasn't holding:

1. **30+ inline copies** of `const isOmni = ctx.ability.can('manage', 'all'); const where = isOmni ? undefined : userCanSeeX(...)` — the row-visibility "dance" repeated across `customers.router.ts`, `meetings.router.ts`, `customer-pipelines.router.ts`, etc. Auditing visibility-correctness today means reading every procedure individually.
2. **CRUD shapes diverged.** `projects.router/` and `proposals.router/` were already split into `crud/business/...` subdirectories; `customers.router.ts` and `meetings.router.ts` were flat files mixing CRUD with business operations in 600+ lines. Procedure names varied (`getAll`/`list`/`getForEdit` vs `getProposal`/`createProposal`/`updateProposal`). Input schemas varied. No type-level mechanism kept them aligned.
3. **Field-level CASL was hand-rolled** in customers' `updateProfile`, `updateCustomerContact`, `updateCreatedAt` — three procedures, three near-identical for-loops over `ability.cannot('update', 'Customer', key)`.
4. **The dual-credential proposal read was inlined ad-hoc.** `getProposal` accepted "authenticated session with CASL `read` permission OR matching share token" via inline branching, with no shared abstraction for future shareable entities, and the page calling it had to know about the dual-credential model.
5. **Silent visibility-scope leak on `getProposal`.** The procedure ran a CASL `can('read', 'Proposal')` check but skipped any row-scoping predicate. Every agent could read every proposal via direct id query.

ADR-0001 had already solved the structurally identical problem at the client-side action-menu layer ("convention alone wasn't holding the line"). The same solution shape applied one layer deeper.

## Decision

An **Entity Server System** with five pieces:

1. **`EntityServerSpec`** — a typed declaration per entity at `entities/<entity>/lib/server-spec.ts`. A single interface with required `caslSubject` and `visibility` — every entity is a top-level identity. Named typed config fields for cross-entity patterns: `shareable: { tokenColumn }` (public-share read via token), `update.jsonbMergeColumns` (deep-merge JSONB columns instead of replace), `primaryKey` (override default `'id'`). Entity-internal relations (junction tables, append-only logs) live as business plugin procedures on the parent's L2 router, not as their own entities. No callback functions in the spec except the visibility predicate — the spec is data, not behavior.

2. **`createCrudHandlers(spec)`** (L0) — returns `{ list, getById, create, update, delete, duplicate? }` as raw async functions, fully wired with CASL gating, visibility scoping, schema validation, JSONB-merge semantics, and primary-key derivation. Composable from anywhere: business procedures wrapping defaults with extra logic, future scripts that bypass tRPC entirely. No tRPC dependency at L0.

3. **`createCrudRouter(spec, { exclude? })`** (L1) — thin tRPC sub-router over L0 handlers. Reads `spec.shareable` to generate the dual-credential `getById` (baseProcedure + optional token input + session-or-token gate). `exclude` is the v1 call-site override surface; broader override mechanisms (wrap/replace) deferred to v2 until 2+ adopters surface a real need.

4. **`createEntityRouter(spec, plugins?)`** (L2) — composes L1 with business plugins (each a `(spec) => Router` factory receiving the spec). Auto-plugs the CRUD sub-router. Registers spec into a server-side `entityRegistry: Record<EntityName, EntityServerSpec>`. The entity router becomes a one-line composition: `export const proposalsRouter = createEntityRouter(proposalServerSpec, { business: proposalBusinessRouter })`.

5. **Entity-name colocation** — each entity's identity string lives in `entities/<entity>/lib/constants.ts`; `domains/permissions/abilities.ts` imports them and derives `ENTITY_NAMES` const array + `EntityName` union + `AppSubject` type. Visibility predicate colocated at `entities/<entity>/lib/visibility.ts` (migrated from `dal/server/<entity>/visibility.ts`). The server-side `entityRegistry` mirrors ADR-0001's client-side `entityRegistry` in shape and discipline.

## Considered alternatives

- **Free-form `Overrides<Spec>` callback functions on the spec** (per-slot procedure replacement). Rejected: the spec is entity-truth; arbitrary code in the spec hides entity properties in implementations. Recognized cross-entity patterns become typed named fields (`shareable`, JSONB merge). Free-form overrides may surface as call-site factory args in v2 if a pattern emerges that can't be named — never in the spec itself.
- **Discriminated union over `parentEntity` (CoreEntitySpec | NestedEntitySpec).** Initial design used a discriminated union so future nested entities could inherit parent-chain auth. Pulled on first-implementation review: ~70 LoC of dormant scaffolding with no consumer; real candidate tables (meetingParticipants, customerNotes, proposalViews) are better modeled as business plugin procedures on the parent's L2 router. Refactor cost to re-introduce is bounded (~1-2 hours) if a genuine nested entity later emerges.
- **Strict no-override inheritance for nested entities.** Rejected alongside the discriminated-union design: defaults-with-explicit-override is the design ethos.
- **Separate `business.getByShareToken` procedure for dual-credential reads.** Rejected: puts call-site routing burden on the page ("did the caller bring a session or a token?"). The proposal page is shared between agents and homeowners — it must call ONE procedure regardless of credential. Spec-described `shareable` lets `crud.getById` resolve credential internally.
- **Auto-derived `EntityName` union from registry type extraction.** Rejected: too magical, hard to keep purely compile-time once specs live across many files. Hand-maintained union in `domains/permissions/abilities.ts` with a one-line addition per new entity. Compile error when missed.
- **Pure-composition `createEntityRouter` with no registry side-effect.** Rejected: the registry is the deepening hook. Without it, "the system knows about its entities" becomes implicit. The registry enables future cross-cutting tooling (openapi generation, admin-CRUD scaffolds, observability tags) without further refactor.
- **Hard-coded id schema `z.string().uuid()`.** Rejected: some entities use serial integers or other PKs. Id schema is spec-derived via `spec.schemas.select.shape[spec.primaryKey ?? 'id']`. The procedure's input field name normalizes to `id` for consumer ergonomics; the factory maps to the actual column name internally.

## Consequences

- The factory layers ship in `src/trpc/lib/`. `userCanSeeCustomer` / `userParticipatesInMeeting` (today in `dal/server/<entity>/visibility.ts`) move to `entities/<entity>/lib/visibility.ts` during each entity's migration — entity truth follows the entity.
- **Migration order: Proposal → Customer → Meeting → Project.** Proposals first as the highest-learning entity (shareable + dual-credential read). Each migration is a single PR; each pressure-tests a different design surface before the next.
- **The Proposal migration fixes a real bug.** Today's `getProposal` skips visibility scoping entirely; the migrated factory-generated `getById` will apply `proposalVisibility(userId, table)` in SQL. Agent-facing surfaces that depended on the leak (manager-review, dispatch, cross-team viewing) must be validated against the new predicate before the PR ships — likely "owner OR meeting-participant OR super-admin" but requires explicit design.
- **`customers.router.ts` and `meetings.router.ts` must be split first.** Their flat structure has to become `customers.router/` and `meetings.router/` with `crud/business/...` subdirs before the factory can plug in. One pre-migration restructure PR each, with no behavior change.
- **Field-level CASL helper deferred to v2.** Customer's per-field `for ([key, value])` loop is the only adopter today — one-adopter-not-a-seam. Promote to `requireFieldAccess(...)` if Meeting or Proposal field-level rules land.
- **Wrap/replace-style overrides deferred to v2.** Inline business rules ("must validate prerequisite before create," "post-create welcome-email side effect") go in business plugin procedure bodies for now, calling `handlers.<slot>` directly. Promote to factory args only when a wrap pattern repeats across entities.
- Adding a new entity becomes: one spec file + one constant import in `abilities.ts` + one `createEntityRouter` call. Strict types refuse to compile until the spec's required fields (`caslSubject`, `visibility`, `table`, `schemas`) are provided. See [`docs/how-to/add-an-entity.md`](../how-to/add-an-entity.md).
