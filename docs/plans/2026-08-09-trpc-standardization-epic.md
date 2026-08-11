# tRPC Layer Standardization Epic

> **Status:** Design agreed (grill session 2026-08-09). Not yet implemented.
> **Canonical exemplar:** `proposals.router`.
> **Supersedes part of:** ADR-0002 (Entity Server System) — specifically the
> `createEntityRouter` factory, the `EntityToolkit` param, and the entity
> registry. The `EntityServerSpec` data model, `createCrudRouter`, the DAL,
> and the scope/shareable *middleware* all stay.

## Why this epic exists

The Entity Server System (ADR-0002) got the data model right — one
`EntityServerSpec` per entity, scope + shareable middleware, standardized CRUD
— but the **router-construction mechanism** over-engineered itself. It tried to
*generate* pre-scoped procedures at call time from the spec, inside a factory
that also owned entity registration. That produced:

- A `createEntityRouter(spec, factory)` wrapper whose only two live jobs are
  (a) bake middleware onto procedures and (b) `registerEntity(spec)`.
- An `EntityToolkit` object threaded as an argument into every sub-router
  (`createDeliveryRouter(entity)`), even though a sub-router of proposals will
  *always* be about proposals — the argument carries no real variability.
- A cast (`as typeof agentProcedure`) that the factory *needs* because tRPC's
  procedure-builder type changes after every `.use()`; the idiomatic
  top-level-`const` + `typeof` pattern "doesn't work for our per-entity
  factory" (per the code comment). We inverted the idiom and paid for it.
- A write-only `entityRegistry` — **never read anywhere in `src/`** — whose
  sole live function is a duplicate-registration throw. Speculative scaffolding
  ("Future use: openapi gen, admin scaffolds").
- `index.ts` mixing **three** router-construction styles (factory,
  inline `createTRPCRouter`, `createXxxRouter(entity)`).

The fix is **definition-once instead of generation**: define the per-entity
pre-scoped procedures as top-level consts, import them directly, and let each
sub-router be a plain `createTRPCRouter`.

## Design decisions (locked)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Per-entity procedures live in **`<entity>.router/procedures.ts`** as top-level consts (`proposalProcedure`, `proposalShareableProcedure`, `proposalPublicProcedure`). | tRPC-idiomatic `const + typeof`; deletes the `as typeof` cast; keeps the tRPC runtime out of the DAL. |
| D2 | **`server-spec.ts` stays a pure data object** — never imports `@/trpc/*`. | `server-spec.ts` is imported by the DAL (`dal/server/crud.ts`) and a feature-DAL. Exporting procedures from it would drag `initTRPC`/`superjson` into the DAL and risk client-bundle leakage. |
| D3 | **`index.ts` is pure composition** — imports + one `createTRPCRouter({...})`, no procedure bodies. | Router file reads as a table of contents; one construction style. |
| D4 | **One leaf shape** — every sub-router is `export const xxxRouter = createTRPCRouter({...})` in its own `*.router.ts`, importing procedures from `./procedures`. | Kills the toolkit param; one pattern to learn. |
| D5 | **Every leaf attaches to a real entity** — the parent (`delivery`, `contracts` = action/service leaves on Proposal) or a child table (`media`, `views`, `incentives` = sub-entity leaves). Never a fictional grouping. | Forces `recordView`/`getProposalViews` out of `delivery` into `views.router.ts`; forces `incentives` out of `index.ts`. |
| D6 | **Child tables become full child entities** via a new **`subEntitySpec`** abstraction. | See below. Own folder/spec/DAL/procedures/router, but auth delegates to the parent. |
| D7 | Child entities **reuse the parent's CASL subject** (`Proposal`), not their own. | No requirement for independent child permissions today; child auth *is* parent auth. Split subjects out later only when a real distinction appears. Avoids inflating the permission matrix. |
| D8 | **Delete** `createEntityRouter` and `entity-registry.ts`. | Registry is write-only (YAGNI); factory's jobs are absorbed by `procedures.ts` + plain composition. |

### D6 detail — the `subEntitySpec` abstraction (keystone)

Child tables (`proposal_incentives`, `proposal_views`, `proposal_media_files`)
have **no token column** (only `proposalId`) and **no independent visibility** —
a child is visible iff its parent proposal is. The parent's visibility is itself
a subquery (`userParticipatesInMeeting(userId, proposals.meetingId)`). So a child
cannot have a self-contained `visibility`/`shareable`; it must delegate to the
parent. Today `proposal-media-files/dal/server/authz.ts` does this ad hoc by
joining child→proposals and applying `ctx.scope`.

We build the delegation **once**:

```ts
export const proposalViewsSpec = defineSubEntity({
  entityName: PROPOSAL_VIEW,
  caslSubject: PROPOSAL,                 // D7: reuse parent subject
  table: proposalViews,
  parent: { spec: proposalServerSpec, fk: proposalViews.proposalId },
  shareable: true,                       // inherits parent's tokenColumn via the FK
})
```

Generalized middleware resolves child auth through the parent:
- **scope path** → `fk IN (SELECT proposals.id WHERE <parentVisibility>)`
- **token path** → validate the token against the **parent** table's
  `tokenColumn`, then scope the child by the same subquery.

Reusable for every child table across the codebase (meeting participants,
customer notes, …), not just proposals.

#### Design refinement (S3b deep-dive, 2026-08-10)

Reading the three real sites (`media` authz, `incentives` mutation, `views`)
sharpened the design on four points:

1. **Two scoping levels, two helpers.** Some ops only need "is the **parent**
   visible?" (media create/list, incentives replace, `getProposalViews`) — that
   is **entity-level** and needs *only the parent `EntityServerSpec`*, not a
   sub-spec. Others need "is this **child** row's parent visible?" (media
   setVisibility/delete by media id) — that is the **fk** primitive. Built the
   entity-level primitive first (`isInScope`, S3b); the fk primitive lands in S5.

2. **The spec stays pure config; the engine is a separate consumer.** Mirrors
   `EntityServerSpec → createCrudDal(spec)`. `SubEntitySpec` lives in the child
   entity's `lib/` and imports only the parent's `EntityServerSpec` + the fk
   column — never the DAL. The DAL engine (in `dal/server/lib/`) consumes the
   spec. Never the reverse. (User ruling: do **not** couple the spec to the DAL.)

3. **`defineSubEntity` re-derives nothing — the subquery wraps `ctx.scope`.**
   The scope path is `fk IN (SELECT parent.pk FROM parent WHERE ${ctx.scope})`
   using the **already-computed** `ctx.scope` (which is parent-column SQL for
   both the agent and token paths), not a fresh `parentVisibility` derivation.
   Token "delegation" is free because the token predicate is already in
   `ctx.scope`. (Corrects the line above: no separate `<parentVisibility>` step.)

4. **`proposal-views` is a weak proving ground for the fk engine** — its two ops
   are a system insert + an entity-level parent guard. Media is the real first
   consumer of the fk primitive, so `defineSubEntity` + the fk engine +
   `SubEntitySpec` config all ship in **S5** (first real reader → satisfies R7),
   not S3b. `recordView` is a `systemProcedure` (external/token auth), not
   shareable — event-ingestion is semantically system-level.

Net: the *middleware-generation* idea in the D6 example above is **dropped** —
children reuse the parent's procedures (S1's `proposalProcedure` etc.); the only
generated artifact is DAL-layer scope helpers driven by the pure `SubEntitySpec`.

#### Design update — 2026-08-10 (SUPERSEDES the `subEntitySpec` abstraction above)

A grill session (`/improve-codebase-architecture`, "no escape hatches") replaced
the separate `subEntitySpec`/`defineSubEntity` abstraction **and** the boolean
`isInScope` primitive with a unified, composable model. **A sub-entity is just an
`EntityServerSpec` that declares a `parent`** — there is no second spec type:

- `EntityServerSpec` gains `parent?: { spec, fk }` and `visibility?` becomes
  **optional**. Effective scope is **additive**: `own ∧ parentBridge`, where
  `parentBridge = fk IN (SELECT parent.pk FROM parent WHERE <parent effective
  scope>)`, **recursing up the parent chain**. A pure child omits `visibility`;
  a top-level entity omits `parent`; declaring neither throws (no unscoped
  entity — that's the "no escape hatch" rule).
- `resolveEffectiveScope(spec, auth)` (`dal/server/lib/scope.ts`) is the single
  resolver. It folds the bridge **into `ctx.scope` itself**, expressed entirely
  in the child's own table (parent columns live in the subquery) — so **every
  existing `and(eq(pk,id), ctx.scope ?? undefined)` call site works unchanged**
  for sub-entities. No fk boolean primitives: `assertChildInScope` /
  `childInParentScope` are **dropped** (they invited the per-row N+1). The point
  form for the create/precursor paths that have no host query is
  `isVisible(spec, ctx, id)`. `isInScope` is `@deprecated`, deleted once
  `proposal-views` migrates.
- **Omni stays a procedure/context concern** (the 3 gates do `isOmni ? null :
  resolveEffectiveScope(...)`), never inside an entity predicate — validated in
  code (entity `visibility` fns return `SQL`, can't express "all rows").
- Corrects D6-refinement point 1: there is **no** separate entity-level vs fk
  helper split — one recursive resolver serves both. Points 2–3 hold (spec is
  pure config, wraps the already-computed scope, re-derives nothing).
- `EXPLAIN`-validated on the dev branch: the bridge is **one** query (semijoin,
  sub-ms); the nested subquery adds one indexed hop that scales with
  participation, not table size.

**Shipped as "Increment A"** (2026-08-10, on main, unpushed): `EntityServerSpec.
parent` + optional `visibility` (`types.ts`); `resolveEffectiveScope` + `isVisible`
+ shared `pkColumn` (`scope.ts`); all three gates (`resolveVisibilityScope`,
`buildUserContext`, `shareableMiddleware`) route through `resolveEffectiveScope`.
tsc+lint green; **zero behavior change** (no entity declares `parent` yet). This
supersedes the "S5 also builds the subEntitySpec engine" line below — the engine
is already built, in a different (better) shape. R9 below ("modeled as a
`subEntitySpec`") now reads: **modeled as an `EntityServerSpec` with `parent`.**

## Derived hygiene rules (the durable output)

These are the teachable rules this exercise produces, grouped by layer. They
become `src/trpc/DOCS.md` rules + an ADR amendment at implementation time.

**tRPC / router layer**
- R1. Per-entity pre-scoped procedures are defined **once** in
  `<entity>.router/procedures.ts`; sub-routers import them. No factory that
  generates procedures at call time. No toolkit argument.
- R2. `index.ts` is **pure composition**. No procedure bodies in the composer.
- R3. **One leaf shape**: `export const xxxRouter = createTRPCRouter({...})`,
  one file per leaf.
- R4. **Every router attaches to a real entity** — parent or child table —
  never a fictional grouping.
- R5. **No inline `db.*` in a procedure body.** (Current violation:
  `media.router.ts` `setVisibility` does `db.update(...)` inline.) Route
  through the child entity's DAL.
- R6. **Shared CASL-assert helpers**, not hand-rolled
  `if (ability.cannot(...)) throw` copied across leaves. (Current dup:
  `assertCanUpdate` in `media.router.ts` + the inline check in the `incentives`
  block → one `assertCanUpdateProposal(ctx)`.)
- R7. **No speculative registries / dead scaffolding** (YAGNI). If it has no
  reader, it doesn't ship.

**Entity / config layer**
- R8. `server-spec.ts` is a **pure data object** — never imports the tRPC
  runtime. Keeps the DAL and any `src/shared` importer tRPC-free and
  client-safe.
- R9. Every child table is modeled as a **`subEntitySpec`** declaring
  `parent + fk`; it does not hand-roll parent-join visibility.
- R10. A child reuses the parent's CASL subject until a real permission
  distinction exists.

**DAL layer**
- R11. Child-entity DAL lives in the child's **own** `entities/<child>/dal/server/`
  folder, not dumped under the parent. (Current violation:
  `proposal_incentives` + `proposal_views` DAL lives under
  `entities/proposals/dal/server/`.)
- R12. Cross-entity writes go through the **owning** entity — do not reach into
  a sibling entity's DAL from a router. (Known smell:
  `delivery.router.ts` calls `deriveOutcomeOnProposalSent` (meetings DAL) via
  `SYSTEM_CONTEXT`; already marked `@migration(meetings-entity-router)`.)
  Track as follow-on, not this pass.

**Service layer**
- R13. Services **never import `db` directly**. (Current violation:
  `media/media.service.ts` imports `db` — the deferred "media-service DAL
  compliance" item; the media child-entity conversion makes fixing it
  non-optional.)

## Part 1 — Proposals as the canonical exemplar

Target shape:

```
src/trpc/routers/proposals.router/
  procedures.ts        proposalProcedure / proposalShareableProcedure / proposalPublicProcedure
  index.ts             pure createTRPCRouter({ crud, business, delivery, contracts, media, views, incentives })
  business.router.ts   getFullView, list, getFinanceOptions   (extracted from index)
  funding.router.ts    setCashInDeal                           (extracted from index)
  delivery.router.ts   sendProposalEmail, requestToMoveForward (views procs REMOVED)
  contracts.router.ts  envelope lifecycle + agreement context  (drop entity param)
  media.router.ts      child entity leaf                       (drop entity param, fix inline db)
  views.router.ts      child entity leaf                       (NEW — moved out of delivery)
  incentives.router.ts child entity leaf                       (NEW — extracted from index)

src/shared/entities/
  proposal-media-files/   promote to full subEntitySpec (spec + dal + procedures)
  proposal-incentives/    NEW folder — dal moved out of entities/proposals
  proposal-views/         NEW folder — dal moved out of entities/proposals

src/trpc/lib/
  sub-entity/             NEW — defineSubEntity + generalized parent-delegating middleware
  create-entity-router.ts DELETE
  entity-registry.ts      DELETE
```

See **Work breakdown** below for the sliced, ordered work log.

## Part 2 — Rollout audit

- **Mechanical** toolkit→`procedures.ts` migration for `customers`,
  `meetings`, `applications`, `customer-notes` (same top-level move as
  proposals; no child-entity work). This unblocks the D8 deletes.
- Their child tables (meeting participants, customer notes, …) adopt
  `subEntitySpec` **as-touched**, not in this pass.
- Audit the **non-migrated** routers (`projects`, `lead-sources`) against R1–R13
  and schedule them.

## Work breakdown (in-repo issue log)

Tracked here, in the codebase — not on GitHub. Each slice is independently
mergeable with `pnpm tsc` + `pnpm lint` green and behavior preserved. Check
boxes as slices land; add follow-on slices under S8.

- [x] **S1 · AFK · blocked-by: none** — `proposals.router/procedures.ts`
  (`proposalProcedure` / `proposalShareableProcedure` / `proposalPublicProcedure`);
  convert `delivery` + `contracts` from `createXxxRouter(entity)` to plain leaves
  importing `./procedures`. `createEntityRouter` stays (still wraps `index.ts`)
  but the `entity` param is gone from these leaves.
  - AC: no `EntityToolkit` import in `delivery`/`contracts`; behavior unchanged; tsc+lint green. ✅
  - **Impl note (design correction):** D1 claimed the `as typeof agentProcedure`
    cast would simply vanish. It doesn't vanish for free — the cast existed
    because the standalone `scopeMiddleware` is typed against the *root* context
    (nullable `session`), so `.use(scopeMiddleware(spec))` widens `ctx.session`
    back to null. The real idiomatic fix: chain the agent scope step as an
    **inline** `.use()` on `agentProcedure` (inline middleware infers `ctx` from
    the procedure, so the non-null narrowing flows through) with the scope math
    kept DRY in a new shared `resolveVisibilityScope(spec, {userId, ability})`
    (`scope-middleware.ts`). `shareableProcedure` keeps `.use(shareableMiddleware)`
    as-is — its nullable `ability`/`session` is intended and call sites handle it.
    This is the pattern S6b's mechanical migration must copy.
- [x] **S2 · AFK · blocked-by: S1** — pure `index.ts`: extract `business` +
  `incentives` (**+ `funding`** — see note) into `business.router.ts` /
  `incentives.router.ts` / `funding.router.ts`; `index.ts` is imports + one
  `createTRPCRouter({...})`.
  - AC: no procedure bodies in `index.ts`; every leaf is its own file. ✅
  - **Correction:** the S2 line + Part 1 target shape omitted `funding` —
    but `funding.setCashInDeal` is an inline procedure body in `index.ts`, so
    leaving it would fail the AC. Extracted to its own `funding.router.ts`
    (keeps the `proposals.funding.*` tRPC path stable — no client breakage).
  - **`crud` stays in `index.ts`** (not a procedure body — a `createCrudRouter`
    config). It still passes `entity.authedProcedure`/`shareableProcedure`
    because `createCrudRouter` types those params as `typeof agentProcedure` /
    `typeof baseProcedure`, which only the toolkit's *cast* satisfies — the
    inline-scoped `proposalProcedure` has a different post-`.use` builder type.
    Retiring the `createEntityRouter` wrapper (crud + media off the toolkit) is
    S7; until then `index.ts` keeps the wrapper for those two only.
- **S3 · split into S3a + S3b** (user's call — do the mechanical views move
  first, deep-dive the abstraction second).
  - [x] **S3a · AFK · blocked-by: S1, S2** — relocate `proposal_views` DAL to
    its own `entities/proposal-views/dal/server/{mutations,queries}.ts` and add
    `views.router.ts` (moves `recordView` + `getProposalViews` out of
    `delivery`). **No `subEntitySpec` yet** — the leaf reuses the existing
    `proposalProcedure`/`proposalPublicProcedure` + manual token check, exactly
    as `delivery` did. tRPC path moved `proposals.delivery.{recordView,
    getProposalViews}` → `proposals.views.*`; both client callers updated
    (`proposal-view-badge.tsx`, `proposal-flow/.../proposal/index.tsx`).
    - AC: tsc+lint green; behavior + token-IS-authorization semantics preserved. ✅
    - **R11 now partially satisfied:** `proposal_views` DAL is out of
      `entities/proposals/`; `proposal_incentives` DAL still lives there until S4.
  - [x] **S3b · HITL · blocked-by: S3a** — deep-dive done (see "Design
    refinement" under D6). Shipped the parts that have **real readers today**;
    the `subEntitySpec` config + fk engine were **deferred to S5** because
    building them now would be reader-less (epic R7 — no speculative
    scaffolding; `proposal-views` only exercises *entity-level* scoping, not the
    fk primitive). What shipped:
    - `systemProcedure` (generic, `init.ts`) for external-auth / event-ingestion
      endpoints; `recordView` moved onto it (was `proposalPublicProcedure`).
      Behavior unchanged — token IS authorization, SYSTEM_CONTEXT, manual check.
    - `isInScope(spec, ctx, id)` — entity-level visibility primitive
      (`dal/server/lib/scope.ts`). Returns a **boolean** so each layer throws
      its native error (router → TRPCError, DAL → ThrowableDalError) instead of
      the primitive coupling DAL to the tRPC error type.
    - **Closed the `getProposalViews` gap:** now `getProposalViews(ctx, input)`,
      parent-visibility scoped via `isInScope` — only an agent who can see the
      proposal + super-admin (omni) may read its views.
    - Refactored media's `assertProposalInScope` onto `isInScope` (second real
      reader → proves the primitive isn't ad-hoc). Media's fk-based
      `assertProposalMediaInScope` untouched (S5).
    - AC: tsc+lint green; recordView token semantics preserved. ✅ (engine
      unit-tests for the fk paths move to S5 with the fk engine.)
- [x] **S4 · AFK · blocked-by: S3b** — `proposal-incentives` relocated to its
  own entity folder. **Approach A (deliberate down-scale):** incentives has NO
  per-row CRUD surface (only a bespoke replace-all + list + clone), so — unlike
  media (S5b) — it gets NO `server-spec.ts`, NO `createCrudDal`, NO
  `ENTITY_NAMES`/CASL entry, NO child procedure. A `createCrudDal` here would be
  dead surface (deletion test). Likely-temporary asymmetry vs. media; revisit if
  W3 section-incentives introduces per-row editing needing the ctx.scope bridge.
  Spec: `docs/superpowers/specs/2026-08-10-s4-proposal-incentives-relocation-design.md`;
  plan: `docs/superpowers/plans/2026-08-10-s4-proposal-incentives-relocation.md`.
  - **✅ Shipped (2026-08-10):**
    - **Moved to `entities/proposal-incentives/`:** `lib/incentive-rows.ts`
      (row↔domain mappers), `dal/server/queries.ts` (`listProposalIncentives`),
      `dal/server/mutations.ts` (`replaceProposalIncentives` — verbatim, keeps its
      own parent-scoped select + `isProposalFrozen` gate + trailing recompute).
    - **`cloneProposalIncentives(sourceId, targetId): DalReturn<number>`** — new
      child DAL fn; the duplicate override's raw `db.insert(proposalIncentives)`
      is gone (entity-owns-its-mutations). `duplicate.ts` calls it and keeps
      orchestrating `recomputeProposalFinancials`; the `cloned === 0` short-circuit
      preserves the old `sourceIncentives.length === 0` control flow.
    - **Stayed in `proposals`:** `recomputeProposalFinancials` + `setCashInDeal`
      (proposal-level rollup/funding blob); the domain `incentiveSchema`/
      `incentiveTypes`/`Incentive` (shared funding-form schema); DB schema
      `proposal-incentives.ts` (schema-dir convention). `getFullView`, `duplicate`,
      and `funding-columns` repointed their imports to the child.
    - **Router:** `incentives.router.ts` unchanged except the one import path;
      tRPC path `proposals.incentives.replace` unchanged; zero client changes.
    - **Imports acyclic:** `proposal-incentives/mutations` → `proposals/mutations`
      (recompute) is one-way; `proposals/mutations` no longer imports anything from
      `proposal-incentives`. tsc + lint green (only the pre-existing `server.ts:6`
      WIP error remains). Behavior byte-for-byte preserved on all paths.
- **S5 · split into S5a + S5b** — the scope engine already shipped (Increment A,
  see the 2026-08-10 Design update); what remains is (a) making `projects` a
  spec-driven entity so both media parents are on equal footing, then (b) the
  media child entities + the `media.service` persistence-shape decision. The
  media A/B persistence decision (`createCrudDal`+hooks vs `mediaService`
  orchestrator facade) is **PARKED** until S5a lands — deciding it on top of a
  spec-less `projects` would be deciding on unequal footing (project-media was
  the awkward spec-less case).
  - [x] **S5a · AFK · blocked-by: none** — **Projects server spec + CRUD DAL.**
    `projects` is a first-class entity but is still hand-written (no spec); this
    is the load-bearing prerequisite for the S5b media decision. Author
    `projectServerSpec` (`entities/projects/lib/server-spec.ts`, pure data
    object, `visibility` = the existing `projectParticipationScope`) +
    `projectCrud = createCrudDal(projectServerSpec)` (`dal/server/crud.ts`),
    mirroring `applications`. Decide (at impl) whether to migrate the existing
    hand-written `projects.router/crud.router.ts` onto `createCrudRouter` now or
    add the spec/DAL alongside and migrate the router in S8. Principle enforced
    throughout: **a service always rings the DAL and passes it data — it never
    touches `db`/persistence itself** (see R5/R13). Unblocks project-media
    becoming a real `parent`-linked child in S5b.
    - **✅ Shipped (2026-08-10):** `projectVisibility` fragment
      (`projects/lib/visibility.ts`); `projectServerSpec` + `projectSchemas`
      (`projects/lib/server-spec.ts`); `projectCrud = createCrudDal(...)`
      (`projects/dal/server/crud.ts`). **Alongside-first** — spec + row-level
      CRUD only; NO hooks/duplicate; hand-written `manage-project.ts` stays the
      lifecycle authority (x_projectScopes, R2 cleanup, updatedAt) until the
      router migrates in S8 (which also tightens delete/scope — its own slice).
      tsc+lint green; zero behavior change (`projectCrud` unwired). The media A/B
      persistence decision is now UNPARKED — both parents are spec-driven.
  - [x] **S5b · AFK · blocked-by: S5a** — **DECISION: Option A** (createCrudDal
    per media child + `mediaService` rings those DALs), chosen once S5a made both
    parents spec-driven and symmetric. `proposal-media-files` (via
    `proposalMediaServerSpec`) and `project-media` (via `mediaFileServerSpec`,
    table `mediaFiles`) are now full `parent`-linked child entities;
    `media.service` is a pure orchestrator (R2 + optimize) that rings each
    `store.crud` + a shared scoped media DAL and **no longer imports `db`**
    (closes [[project-media-service-dal-compliance]]). Reorder N+1 killed
    (per-row `assertProposalMediaInScope` → one scoped transaction, no probes).
    - **✅ Shipped (2026-08-10):**
      - **Names:** `PROPOSAL_MEDIA_FILE` + `MEDIA_FILE` added to `ENTITY_NAMES`
        (pure children; `caslSubject` reuses the parent `Proposal`/`Project`).
      - **Specs + CRUD:** `proposalMediaServerSpec` /
        `entities/proposal-media-files/dal/server/crud.ts` (`proposalMediaCrud`);
        `mediaFileServerSpec` / `entities/media-files/dal/server/crud.ts`
        (`mediaFileCrud`). No own `visibility` — scope is the parent bridge;
        no `hooks` (R2/optimize live in the service).
      - **Shared DAL:** `entities/media-files/dal/server/media-ops.ts` —
        table-parameterized `listMediaByOwner` + `reorderMedia` (both compose
        `ctx.scope`; reorder = one scoped tx).
      - **Service:** `media.service` mutations return `DalReturn`; routers unwrap
        via `dalToTrpc`. `MediaStore` gained `crud`.
      - **Routers:** `proposalMediaRouter` is now a plain leaf on a new
        child-scoped `proposalMediaProcedure` (bridge in `ctx.scope`); dropped
        the `EntityToolkit`; deleted `proposal-media-files/dal/server/authz.ts`;
        `setVisibility` routes through scoped `proposalMediaCrud.update` (inline
        `db.update` gone). Project media + google-drive routers thread `ctx`.
      - tsc+lint green (only the pre-existing `server.ts:6` WIP error remains).
    - **Behavior nuances (all on UI-unreachable paths — the media list is already
      scoped, so out-of-scope ids can't be surfaced):** a mutation on a
      missing/out-of-scope media id now consistently → `NOT_FOUND` (rename /
      setVisibility) or an idempotent no-op (delete), vs the old mix; reorder
      skips out-of-scope ids rather than rejecting the whole batch. `createRecord`
      now Zod-parses insert input (strips unknown keys) via `createCrudDal` — all
      current callers pass column-shaped data.
    - **DEFERRED (its own reviewed slice — see S8):** project-media *scoping*.
      The router still runs on bare `agentProcedure` (`ctx.scope = null` →
      `mediaFileCrud` executes UNSCOPED, preserving today's behavior/security
      gap). Flipping it on = swap to a child-scoped procedure (the spec/DAL are
      ready); it's a real tightening and gets reviewed separately. Router-level
      `db` in project-media (`movePhase`/`toggleHero`/`listImportable`) left as-is
      (project-specific, not `media.service`) — folds into the projects entity
      pass at S8.
- **S6 · split into S6a + S6b** (added 2026-08-10; S6a approach REVISED 2026-08-11).
  Proposals still carried the `createEntityRouter` wrapper for one reason only —
  `createCrudRouter` took `authedProcedure`/`shareableProcedure` as params typed
  `typeof agentProcedure`, which only the toolkit's `as` cast satisfies.
  **First S6a approach (generalize the param types over the tRPC builder) was
  ABANDONED** — it forced either a relocated cast or a generics explosion (the
  sound bound had to reproduce tRPC's whole `ProcedureBuilder` param list; the
  naive `any` bound silently collapsed the built router's IO types to `any` while
  passing tsc). **Root cause: making a shared factory NAME a builder type at a
  param boundary, which tRPC can't express.** Revised fix removes the boundary:
  `createCrudRouter` builds its scoped procedures INLINE from `config.spec` (the
  cast-free inline `.use()` pattern), so there's no builder-type param at all.
  Spec: `docs/superpowers/specs/2026-08-10-s6a-collapse-create-entity-router-design.md`.
  - [ ] **S6a · AFK · blocked-by: none** — **`createCrudRouter` builds procedures
    inline; collapse the factory.** `createCrudRouter` drops its two procedure
    params (+ the generics/cast problem) and builds `authedProcedure =
    agentProcedure.use(...resolveVisibilityScope(config.spec)...)` +
    `shareableProcedure = baseProcedure.use(shareableMiddleware(config.spec))`
    inline — behavior-identical to the toolkit, no cast, signature back to its
    original 4 generics. Removing the params touches ALL 5 crud call sites
    (mechanical): customers/meetings/applications drop the 2 args (keep the
    factory for their non-crud leaves → S6b); **customer-notes** (pure-crud) and
    **proposals** shed `createEntityRouter` (their `entity` arg becomes unused).
    proposals `index.ts` → pure composition + standalone `crud.router.ts` leaf.
    `create-entity-router.ts` + `entity-registry.ts` FILES stay (3 consumers) → S7.
    - AC: no cast/added-generics in `createCrudRouter`; built CRUD router IO types
      stay CONCRETE (not `any` — tsc-clean is not sufficient, a prior attempt
      passed tsc with `any` types); all `*.crud.*` paths stable; tsc+lint green.
  - [ ] **S6b · AFK · blocked-by: S6a** — replicate the S6a shape (procedures.ts
    + standalone `crud.router.ts` + pure index) onto `customers`, `meetings`,
    `applications` (no child-entity work). `customer-notes` already fully
    migrated in S6a (pure-crud → its `entity` arg went unused once crud built
    inline). Unblocks S7.
- [ ] **S7 · AFK · blocked-by: S4, S5, S6b** — delete `createEntityRouter` +
  `entity-registry.ts` (zero consumers once S6b lands); write the **ADR-0002
  amendment** + rewrite the
  `src/trpc/DOCS.md` entity-router section to match reality (kill the
  toolkit/registry story; document `procedures.ts` + `subEntitySpec` +
  one-shape leaves + pure index). Docs change here, when the code matches.
- [ ] **S8 · HITL · blocked-by: S7** — audit `projects` + `lead-sources`
  against R1–R13; append follow-on slices here. (Note: `projectServerSpec` +
  `projectCrud` now land in **S5a**; if S5a only adds the spec/DAL alongside the
  hand-written router, migrating `projects.router` onto `createCrudRouter` is
  the projects half of this audit.)

## Tracking

- **This doc** is the tracker (design + requirements + work log). Kept in-repo,
  not on GitHub.
- **ADR-0002 amendment** + **`src/trpc/DOCS.md` rewrite** land in **S7**, when
  the code matches — not before (so DOCS never describes non-existent code).
- `src/trpc/DOCS.md` and `docs/adr/0002-entity-server-system.md` carry a
  forward-pointer to this epic so no one builds further on the toolkit/registry.
- `memory/MEMORY.md` carries a pointer under Active Backlog.

## Pending fixes (follow-ups surfaced during the epic)

- [ ] **`createCrudRouter` `id` input infers as `unknown`, not `TId`.** In every
  entity's CRUD router, the `getById`/`update`/`delete`/`duplicate` input's `id`
  field types as `unknown` instead of the concrete `TId`. Cause: `EntityServerSpec`'s
  phantom `TId` parameter + the `z.object({ id: idZod })` being constructed inside
  `createCrudRouter`'s generic body, so `idZod`'s `TId` doesn't flow to the router's
  inferred input type. **Pre-existing** (verified identical on the pre-S6a snapshot —
  the old toolkit path produced the same `{ id: unknown, token? }`), affects all
  entities, does NOT collapse the router to `any` (the input stays a concrete object;
  only `id` is loose). Surfaced by the S6a final review. Fix likely = thread `TId`
  through the input-schema typing (or type `idZod` so its output survives). Low
  priority; orthogonal to the router-shape work.

## Open risks / to-verify at impl

- The generalized `subEntitySpec` scope subquery must compose with the parent's
  existing `ctx.scope` without double-filtering. Verify against
  `userParticipatesInMeeting`.
- `recordView` is a public+token path today (homeowner records a view with the
  parent token). Confirm `subEntitySpec` token delegation preserves the exact
  "token IS authorization, ability null" semantics.
- `duplicateProposalWithIncentives` (custom CRUD handler) copies child rows —
  confirm the child-entity extraction doesn't strand that duplicate logic.
```