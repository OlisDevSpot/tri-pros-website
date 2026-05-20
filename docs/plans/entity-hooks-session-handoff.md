# Session Handoff: Entity Server System Hooks Design

> Date: 2026-05-19 | Issue: #209 (Meeting entity migration)
> Branch: `docs/context-collapse-migration` (work in progress — NOT a clean branch)

## What was accomplished

### 1. Meeting entity migration (Tasks 1-11 complete, Task 12 failed smoke test)

The core migration is done — meetings router decomposed from 859-line flat file into entity router (`crud` + `reads` + `participants` sub-routers) + `meetingFlowRouter` (feature router) + `customerPipelinesRouter` additions. All client call paths updated, tsc + lint clean.

**What works:** Type-checking, linting, route resolution, dead code removal (`linkProposal`, `getPortfolioForMeeting` — zero consumers).

**What broke during smoke test:** Creating a meeting fails because `ownerId` is a `NOT NULL` column but it's `.omit()`'d from `insertMeetingSchema`. The old router hardcoded `ownerId: ctx.session.user.id` inline. The default CRUD handler doesn't inject it.

### 2. Framework extensions (partially implemented, needs redesign)

Two features were added but the hooks architecture needs restructuring:

**Currently in the codebase (needs refactoring):**
- `EntityServerSpec.hooks` — has `beforeCreate`, `beforeUpdate`, `beforeDuplicate` (DAL-level, no ctx)
- `CreateCrudRouterConfig.lifecycle` — has `onCreated`, `onUpdated`, `onDeleted`, `onDuplicated` (router-level, with ctx)
- `meetings.router/lifecycle.ts` — meeting lifecycle callbacks living in the router directory

**Problems identified:**
- Two separate hook systems is confusing — developer has to know which layer to use
- DAL hooks lack ctx — but `ownerId` stamping needs to know who's calling
- `lifecycle.ts` has entity business logic but lives in `trpc/routers/` — wrong location
- The split creates artificial questions: "is pipeline derivation a DAL concern or router concern?"

## What we decided (not yet implemented)

### Unified hooks on EntityServerSpec

Informed by Payload CMS + better-auth patterns. All hooks live on the entity spec, organized by operation and timing:

```ts
// On EntityServerSpec
hooks?: {
  create?: {
    before?: (data: Insert<TTable>, ctx: ScopedContext) => Insert<TTable>
    after?: (row: Row<TTable>, ctx: ScopedContext) => Promise<void>
  }
  update?: {
    before?: (data: Update<TTable>, ctx: ScopedContext) => Update<TTable>
    after?: (row: Row<TTable>, ctx: ScopedContext, meta: {
      previousRow: Row<TTable>
      input: Update<TTable>
    }) => Promise<void>
  }
  duplicate?: {
    before?: (source: Row<TTable>, ctx: ScopedContext) => Partial<Insert<TTable>>
    after?: (row: Row<TTable>, ctx: ScopedContext) => Promise<void>
  }
}
```

**Key design decisions:**
- `before` hooks — sync, data transformation, ctx available (for ownerId, etc.)
- `after` hooks — async, side effects (GCal, notifications, Ably, participant creation)
- `before` hooks invoked by DAL layer (`createCrudDal`)
- `after` hooks invoked by router layer (`createCrudRouter`) — reads from `spec.hooks`, NOT a separate `lifecycle` config
- Hooks live on the spec = one place to look, colocated with entity definition
- `ScopedContext` (not `AuthedContext`) — hooks must handle `ctx.session` being null (jobs/services use `SYSTEM_CONTEXT`)
- No casting — hooks use optional chaining (`ctx.session?.user.id`) with fallbacks

### ownerId schema change

Un-omit `ownerId` from `insertMeetingSchema` — make it optional so clients CAN send it (super-admin use case). `hooks.create.before` defaults it from ctx when not provided:

```ts
before: (data, ctx) => ({
  ...data,
  ownerId: data.ownerId ?? ctx.session?.user.id,
}),
```

## What needs to happen next (implementation order)

1. **Restructure `EntityServerSpec.hooks` type** — replace flat `beforeCreate/beforeUpdate/beforeDuplicate` with nested `create.before/update.before/duplicate.before` + add `.after` hooks
2. **Update `createCrudDal`** — pass ctx to before hooks, use new nested path (`spec.hooks?.create?.before`)
3. **Update `createCrudRouter`** — remove `lifecycle` config, read after hooks from `spec.hooks?.create?.after` etc. Add `previousRow` fetch for `update.after` (only when hook defined)
4. **Un-omit `ownerId`** from `insertMeetingSchema` in `src/shared/db/schema/meetings.ts`
5. **Merge `lifecycle.ts` into `server-spec.ts`** — move meeting hook implementations into the spec's `hooks` property
6. **Delete `src/trpc/routers/meetings.router/lifecycle.ts`**
7. **Update `meetings.router/index.ts`** — remove `lifecycle: meetingLifecycle` from `createCrudRouter` call
8. **Verify proposals router still works** — it uses `handlers` overrides (not hooks), should be unaffected
9. **pnpm tsc + lint + smoke test** — the create meeting flow should now work

## Key files to read

| File | Why |
|---|---|
| `src/shared/dal/server/types.ts:62-89` | Current EntityServerSpec with hooks type |
| `src/shared/dal/server/lib/create-crud-dal.ts` | Where before hooks are invoked |
| `src/trpc/lib/create-crud-router.ts` | Where lifecycle/after hooks are invoked |
| `src/shared/entities/meetings/lib/server-spec.ts` | Meeting spec with current hooks |
| `src/trpc/routers/meetings.router/lifecycle.ts` | Meeting lifecycle (to be merged into spec) |
| `src/trpc/routers/meetings.router/index.ts` | Entity router wiring |
| `src/shared/db/schema/meetings.ts:61-69` | insertMeetingSchema with ownerId omit |
| `src/shared/entities/proposals/lib/server-spec.ts` | Proposals spec (no hooks, uses handler overrides — must stay working) |
| `docs/superpowers/specs/2026-05-19-meetings-entity-migration-design.md` | Full design spec (hooks section is now outdated — needs updating after implementation) |

## Three-layer router model (confirmed, working)

```
Entity Router (meetingsRouter)
  crud: 5 single-row lifecycle ops via createCrudRouter
  reads: list, getByIdWithJoins, getInternalUsers
  participants: getParticipants, manageParticipants

Feature Routers (serve specific UI workflows)
  meetingFlowRouter: updateCustomerProfile, getPersonaProfile
  customerPipelinesRouter: getCustomerProjects, assignToProject (moved here)

Services (server-initiated orchestration)
  schedulingService, notificationService, etc.
```

**Key rule:** Entity routers handle operations that happen EVERY time regardless of feature. Feature routers handle operations specific to one UI workflow.

## Lessons / feedback from this session

- **Entity behavior belongs in `entities/`, never in `trpc/routers/`** — lifecycle.ts was wrongly placed in the router directory. Hard rule going forward.
- **Method signature syntax required** for hooks/lifecycle types on `EntityServerSpec` — arrow syntax causes TypeScript variance errors (`ts/method-signature-style` lint rule disabled with comment explaining why)
- **Don't create custom handler overrides when hooks suffice** — the `meetingCreateDal` approach was over-engineering for stamping one field
- **Dead code found:** `linkProposal` (0 consumers), `getPortfolioForMeeting` (0 consumers) — created issue #215 for broader dead code audit
- **Feature routers are real** — `meetingFlowRouter` confirmed as the right pattern for feature-specific tRPC endpoints (parallels existing `customerPipelinesRouter`, `dashboardRouter`)

## Related issues

- #209 — Meeting entity migration (this work)
- #213 — Project entity migration (unblocked by this)
- #214 — Lead Sources entity migration
- #215 — Dead code + ad-hoc duplication audit (created this session)
