# Meeting Entity Server System Migration — Design Spec

> Issue: #209 | Branch: TBD | Date: 2026-05-19

## Overview

Migrate the Meeting entity to the Entity Server System (ADR-0002). This is the largest single migration: 859-line router with 7 inline `db.*` calls + 16 inline `isOmni` copies, reduced to ~40-line entity router + sub-routers + 2 new framework features (DAL hooks + router lifecycle callbacks).

This spec also introduces three framework extensions that benefit all entities:
1. **DAL `beforeWrite` hooks** on `EntityServerSpec` — pure synchronous data enrichment before SQL
2. **Router `lifecycle` callbacks** on `createCrudRouter` — async post-write orchestration (services, side-effects)
3. **`reads` sub-router convention** — standardized name for entity-level read queries beyond CRUD `getById`

## Architecture: Three-Layer Router Model

```
Entity CRUD DAL (internal building blocks — never called by UI directly)
  meetingCrud.create/update/delete/duplicate/getById
  Pure data access. Returns DalReturn<T>. Applies ctx.scope.
  DAL hooks (beforeCreate, beforeUpdate, beforeDuplicate) run here.

Entity Router (public API — complete lifecycle operations)
  meetingsRouter.crud.*        → CRUD + lifecycle callbacks (onCreated, onUpdated, etc.)
  meetingsRouter.reads.*       → list, getByIdWithJoins, getInternalUsers
  meetingsRouter.participants.* → get, manage
  Uses entity DAL + services for entity-invariant side-effects.
  Served by entity.authedProcedure (scoped via middleware).

Feature Routers (feature-specific orchestration)
  meetingFlowRouter.*          → updateCustomerProfile, getPersonaProfile
  customerPipelinesRouter.*    → getCustomerProjects, assignToProject (moved here)
  Uses entity DAL + services for feature-specific workflows.
  Served by agentProcedure (no entity toolkit).
```

**Key rule:** Entity routers handle operations that happen EVERY time, regardless of which feature triggered them. Feature routers handle operations specific to one UI workflow.

## Framework Extension 1: DAL `beforeWrite` Hooks

### Location

Added to `EntityServerSpec` in `src/shared/dal/server/types.ts`.

### Type definition

```ts
// On EntityServerSpec
hooks?: {
  /** Sync data enrichment before insert. No async, no DB reads, no services. */
  beforeCreate?: (input: Insert<TTable>) => Insert<TTable>
  /** Sync data enrichment before update. No async, no DB reads, no services. */
  beforeUpdate?: (data: Update<TTable>) => Update<TTable>
  /** Sync field cherry-pick for duplicate. Returns the fields to copy. */
  beforeDuplicate?: (source: Row<TTable>) => Partial<Insert<TTable>>
}
```

### Implementation

Inside `createCrudDal`, each impl function calls the hook before the SQL write:

```ts
// createImpl — enriches input before insert
async function createImpl(spec, ctx, input) {
  return dalDbOperation(async () => {
    let enriched = input
    if (spec.hooks?.beforeCreate) {
      enriched = spec.hooks.beforeCreate(enriched)
    }
    const validated = spec.schemas.insert.parse(enriched) as Insert<TTable>
    const [row] = await db.insert(spec.table).values(validated).returning()
    if (!row) throw new ThrowableDalError({ type: 'create-failed' })
    return row as Row<TTable>
  })
}

// updateImpl — enriches data before update
async function updateImpl(spec, pkColumn, ctx, input) {
  return dalDbOperation(async () => {
    let enrichedData = input.data
    if (spec.hooks?.beforeUpdate) {
      enrichedData = spec.hooks.beforeUpdate(enrichedData)
    }
    const validated = spec.schemas.update.parse(enrichedData) as Update<TTable>
    // ... existing update logic
  })
}

// duplicateImpl — uses hook to cherry-pick fields instead of copying everything
async function duplicateImpl(spec, pkColumn, ctx, input) {
  return dalDbOperation(async () => {
    const source = /* ... fetch source row ... */
    let values: Record<string, unknown>
    if (spec.hooks?.beforeDuplicate) {
      values = spec.hooks.beforeDuplicate(source) as Record<string, unknown>
    } else {
      const { [pkName]: _pk, ...rest } = source as Record<string, unknown>
      values = rest
    }
    const [row] = await db.insert(spec.table).values(values).returning()
    // ...
  })
}
```

### Constraints

- **Synchronous only.** Hooks must be pure functions: `(input) => enrichedInput`.
- **No async.** If enrichment needs a DB read, use a `handlers` override instead.
- **No service calls.** Side-effects belong in router lifecycle callbacks.
- **Composable with handler overrides.** If an entity provides both `hooks.beforeCreate` AND `handlers.create`, the custom handler is responsible for calling the hook (or not). Hooks only run inside the DEFAULT handlers. This prevents double-enrichment.

### Meeting hooks

```ts
// entities/meetings/lib/server-spec.ts
hooks: {
  beforeUpdate: (data) => {
    // see ../DOCS.md#outcome-pipeline-auto-derive
    if (data.meetingOutcome) {
      const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
      if (pipeline != null) return { ...data, pipeline }
    }
    return data
  },
  beforeDuplicate: (source) => ({
    // see ../DOCS.md#duplicate-cherry-picks-setup-fields
    ownerId: source.ownerId,
    customerId: source.customerId,
    meetingType: source.meetingType,
    scheduledFor: source.scheduledFor ?? undefined,
    contextJSON: source.contextJSON,
  }),
}
```

## Framework Extension 2: Router Lifecycle Callbacks

### Location

Added to `CreateCrudRouterConfig` in `src/trpc/lib/create-crud-router.ts`.

### Type definition

```ts
// On CreateCrudRouterConfig
lifecycle?: {
  onCreated?: (ctx: AuthedContext, row: Row<TTable>) => Promise<void>
  onUpdated?: (ctx: AuthedContext, row: Row<TTable>, meta: {
    previousRow: Row<TTable>
    input: { id: TId, data: Update<TTable> }
  }) => Promise<void>
  onDeleted?: (ctx: AuthedContext, input: { id: TId }) => Promise<void>
  onDuplicated?: (ctx: AuthedContext, row: Row<TTable>, sourceId: TId) => Promise<void>
}
```

### Implementation

Inside `createCrudRouter`, each slot calls the lifecycle callback after DAL success:

```ts
// create slot
create: config.authedProcedure
  .input(config.schemas.insert)
  .mutation(async ({ ctx, input }) => {
    assertCan(ctx.ability, 'create', config.spec)
    const row = dalToTrpc(await handlers.create(ctx, input as Insert<TTable>))
    if (config.lifecycle?.onCreated) {
      await config.lifecycle.onCreated(ctx, row)
    }
    return row
  }),

// update slot — fetches previousRow before update
update: updateProcedure
  .input(updateInput)
  .mutation(async ({ ctx, input }) => {
    if (ctx.ability) assertCan(ctx.ability, 'update', config.spec)
    const { id, data } = input as { id: TId, data: z.output<TUpdate>, token?: string }

    // Fetch previous row for lifecycle callback
    let previousRow: Row<TTable> | undefined
    if (config.lifecycle?.onUpdated) {
      previousRow = dalToTrpc(await handlers.getById(ctx, { id })) ?? undefined
    }

    const row = dalToTrpc(await handlers.update(ctx, { id, data }))

    if (config.lifecycle?.onUpdated && previousRow) {
      await config.lifecycle.onUpdated(ctx, row, { previousRow, input: { id, data } })
    }
    return row
  }),

// delete slot
delete: config.authedProcedure
  .input(idOnlyInput)
  .mutation(async ({ ctx, input }) => {
    assertCan(ctx.ability, 'delete', config.spec)
    dalToTrpc(await handlers.delete(ctx, { id: input.id }))
    if (config.lifecycle?.onDeleted) {
      await config.lifecycle.onDeleted(ctx, { id: input.id })
    }
  }),

// duplicate slot
duplicate: config.authedProcedure
  .input(idOnlyInput)
  .mutation(async ({ ctx, input }) => {
    assertCan(ctx.ability, 'duplicate', config.spec)
    const row = dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
    if (config.lifecycle?.onDuplicated) {
      await config.lifecycle.onDuplicated(ctx, row, input.id)
    }
    return row
  }),
```

### Constraints

- **Async allowed.** Lifecycle callbacks orchestrate services, other DALs, fire-and-forget effects.
- **Errors propagate.** If a lifecycle callback throws, the mutation fails. For fire-and-forget, use `void promise.catch(...)` inside the callback.
- **`previousRow` costs one SELECT.** Only fetched when `onUpdated` is defined. Entities without `onUpdated` pay no cost.
- **Composable with handler overrides.** Lifecycle callbacks run regardless of whether the DAL handler is default or custom. They sit at the router layer, above DAL.

### Meeting lifecycle callbacks

```ts
// meetings.router/lifecycle.ts
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { schedulingService } from '@/shared/services/scheduling.service'
import { notificationService } from '@/shared/services/notification.service'
import { ably } from '@/shared/services/providers/upstash/realtime'

export const meetingLifecycle = {
  onCreated: async (ctx, row) => {
    // Every meeting creation adds the creator as participant owner
    await addParticipant(row.id, ctx.session.user.id, 'owner')

    if (row.scheduledFor) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.create] GCal push failed:`, err))
    }
  },

  onUpdated: async (ctx, row, { previousRow, input }) => {
    const { data } = input

    // GCal push if schedule-relevant fields changed
    if ('scheduledFor' in data || 'meetingType' in data || 'agentNotes' in data) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.update] GCal push failed:`, err))
    }

    // Push notify participants when scheduledFor actually changed
    if (previousRow.scheduledFor !== row.scheduledFor) {
      void notificationService
        .notifyMeetingScheduledTimeChanged({
          meetingId: row.id,
          oldScheduledFor: previousRow.scheduledFor,
          newScheduledFor: row.scheduledFor,
          excludeUserId: ctx.session.user.id,
        })
        .catch(err => console.warn('[push] notifyMeetingScheduledTimeChanged failed:', err))
    }

    // Ably publish for cross-device sync
    void ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
      fields: Object.keys(data),
    })
  },

  onDuplicated: async (ctx, row) => {
    await addParticipant(row.id, ctx.session.user.id, 'owner')

    if (row.scheduledFor) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.duplicate] GCal push failed:`, err))
    }
  },
}
```

## File Structure

### New files

```
src/shared/entities/meetings/
  dal/server/
    crud.ts              ← meetingCrud = createCrudDal(meetingServerSpec)
    queries.ts           ← listMeetings, getByIdWithJoins (ScopedContext + DalReturn)
  lib/
    server-spec.ts       ← meetingServerSpec (with DAL hooks)
    visibility.ts        ← meetingVisibility(userId) → SQL

src/trpc/routers/
  meetings.router/       ← directory (upgraded from flat file)
    index.ts             ← createEntityRouter — ~30 lines
    reads.router.ts      ← list, getByIdWithJoins, getInternalUsers
    participants.router.ts ← getParticipants, manageParticipants
    lifecycle.ts         ← meetingLifecycle callbacks
  meeting-flow.router.ts ← NEW feature router
  app.ts                 ← ADD meetingFlowRouter
```

### Modified files

```
src/shared/dal/server/types.ts          ← Add hooks to EntityServerSpec
src/shared/dal/server/lib/create-crud-dal.ts ← Invoke hooks in create/update/duplicate impls
src/trpc/lib/create-crud-router.ts      ← Add lifecycle config + invocation in slots
src/trpc/routers/app.ts                 ← Register meetingFlowRouter
src/trpc/routers/customer-pipelines.router.ts ← Add getCustomerProjects, assignToProject
```

### Existing files kept as-is

```
src/shared/entities/meetings/dal/server/participants.ts  ← no signature changes
src/shared/entities/meetings/dal/server/mutations.ts     ← deriveOutcomeOnProposalSent stays
src/shared/entities/meetings/dal/server/google-calendar.ts ← stays
src/shared/entities/meetings/lib/constants.ts            ← MEETING exists
```

### Deleted (dead code)

```
Procedures removed from meetings router:
  - linkProposal (0 consumers — proposal creation handles this in proposalCreateDal)
  - getPortfolioForMeeting (0 consumers)
```

## Entity Spec

### `meetingServerSpec`

```ts
export const meetingServerSpec = {
  entityName: MEETING,
  caslSubject: MEETING,
  visibility: meetingVisibility,
  table: meetings,
  schemas: {
    insert: insertMeetingSchema,
    update: insertMeetingSchema.partial(),
    select: selectMeetingSchema,
  },
  hooks: {
    beforeUpdate: (data) => {
      if (data.meetingOutcome) {
        const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
        if (pipeline != null) return { ...data, pipeline }
      }
      return data
    },
    beforeDuplicate: (source) => ({
      ownerId: source.ownerId,
      customerId: source.customerId,
      meetingType: source.meetingType,
      scheduledFor: source.scheduledFor ?? undefined,
      contextJSON: source.contextJSON,
    }),
  },
} satisfies EntityServerSpec<typeof meetings>
```

### `meetingVisibility`

```ts
export function meetingVisibility(userId: string): SQL {
  return userParticipatesInMeeting(userId, meetings.id)
}
```

## Router Structure

### Entity router — `meetings.router/index.ts`

```ts
export const meetingsRouter = createEntityRouter(meetingServerSpec, (entity) => {
  return createTRPCRouter({
    crud: createCrudRouter({
      spec: meetingServerSpec,
      schemas: { ...meetingSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
      lifecycle: meetingLifecycle,
    }),
    reads: createMeetingReadsRouter(entity),
    participants: createParticipantsRouter(entity),
  })
})
```

### `reads.router.ts`

| Procedure | Type | Implementation |
|---|---|---|
| `list` | query | `dalToTrpc(await listMeetings(ctx, input))` |
| `getByIdWithJoins` | query | `dalToTrpc(await getByIdWithJoins(ctx, input))` |
| `getInternalUsers` | query | CASL `assign` gate + inline user query |

### `participants.router.ts`

| Procedure | Type | Implementation |
|---|---|---|
| `getParticipants` | query | existing `getParticipantsForMeeting()` DAL |
| `manageParticipants` | mutation | existing participant DAL + `meetingCrud.update()` for ownerId sync + `schedulingService` + `notificationService` |

### Feature router — `meeting-flow.router.ts`

| Procedure | Type | Implementation |
|---|---|---|
| `updateCustomerProfile` | mutation | `customerCrud.update()` + Ably publish to meeting channel |
| `getPersonaProfile` | query | meeting+customer DAL read + Notion pain points + `buildPersonaProfile()` |

### Moves to `customerPipelinesRouter`

| Procedure | Implementation |
|---|---|
| `getCustomerProjects` | meeting read → customer → projects + proposals queries |
| `assignToProject` | `meetingCrud.update(ctx, { id, data: { projectId, meetingOutcome: 'converted_to_project' } })` |

## Client-Side Call Path Changes

| Component | Old | New |
|---|---|---|
| `meeting-flow.tsx` | `meetingsRouter.create` | `meetingsRouter.crud.create` |
| `meeting-flow.tsx` | `meetingsRouter.update` | `meetingsRouter.crud.update` |
| `meeting-flow.tsx` | `meetingsRouter.getById` | `meetingsRouter.reads.getByIdWithJoins` |
| `meeting-flow.tsx` | `meetingsRouter.updateCustomerProfileForMeeting` | `meetingFlowRouter.updateCustomerProfile` |
| `persona-profile-panel.tsx` | `meetingsRouter.getPersonaProfile` | `meetingFlowRouter.getPersonaProfile` |
| `use-meeting-actions.ts` | `meetingsRouter.delete` | `meetingsRouter.crud.delete` |
| `use-meeting-actions.ts` | `meetingsRouter.duplicate` | `meetingsRouter.crud.duplicate` |
| `use-meeting-actions.ts` | `meetingsRouter.update` | `meetingsRouter.crud.update` |
| `create-meeting-form.tsx` | `meetingsRouter.create` | `meetingsRouter.crud.create` |
| `create-meeting-form.tsx` | `meetingsRouter.update` | `meetingsRouter.crud.update` |
| `schedule-view.tsx` | `meetingsRouter.list` | `meetingsRouter.reads.list` |
| `meeting-flow/table/index.tsx` | `meetingsRouter.list` | `meetingsRouter.reads.list` |
| `create-new-proposal-view.tsx` | `meetingsRouter.getById` | `meetingsRouter.reads.getByIdWithJoins` |
| `participant-picker-content.tsx` | `meetingsRouter.getInternalUsers` | `meetingsRouter.reads.getInternalUsers` |
| `participant-picker*.tsx` | `meetingsRouter.getParticipants` | `meetingsRouter.participants.getParticipants` |
| `use-participant-mutations.tsx` | `meetingsRouter.manageParticipants` | `meetingsRouter.participants.manageParticipants` |
| `assign-project-dialog.tsx` | `meetingsRouter.getCustomerProjects` | `customerPipelinesRouter.getCustomerProjects` |
| `assign-project-dialog.tsx` | `meetingsRouter.assignToProject` | `customerPipelinesRouter.assignToProject` |
| `use-invalidation.ts` | `meetingsRouter.getCustomerProjects` | `customerPipelinesRouter.getCustomerProjects` |

## Business Invariants Preserved

All 11 rules from `src/shared/entities/meetings/DOCS.md`:

| Rule | How preserved |
|---|---|
| `#participant-roles-three` | Unchanged in `participants.router.ts` — DB partial unique indexes + pre-checks |
| `#visibility-via-participation` | `meetingVisibility` uses `userParticipatesInMeeting` — scope middleware replaces 16 inline `isOmni` copies |
| `#meeting-type-vs-pipeline-orthogonal` | Unchanged |
| `#meeting-pipeline-storage-vs-derived` | `beforeUpdate` hook derives pipeline from outcome atomically |
| `#outcome-selectable-vs-derived` | Unchanged |
| `#outcome-flips-on-proposal-sent` | `deriveOutcomeOnProposalSent` in mutations.ts unchanged |
| `#trade-selections-snapshot-source` | Unchanged (proposal-side concern) |
| `#gcal-sync-state-fields` | `lifecycle.onCreated/onUpdated/onDuplicated` call `schedulingService.pushToGCal` |
| `#dealStructure-derived-helpers` | Unchanged (client-side computed helpers) |
| `#one-customer-per-meeting-nullable` | Unchanged (schema-level) |
| `#meeting-owner-not-just-creator` | `lifecycle.onCreated` calls `addParticipant(row.id, ctx.session.user.id, 'owner')` |

## Impact on Proposals Router

Proposals currently uses `handlers: { create: proposalCreateDal, duplicate: proposalDuplicateDal }` for custom CRUD overrides. This stays unchanged.

Proposals should also adopt the `reads` sub-router convention (rename `business` to `reads` for read-only queries; `delivery` and `contracts` stay as named sub-routers). This is a follow-up task, not part of this PR.

## Acceptance Criteria

- [ ] DAL `hooks.beforeCreate/beforeUpdate/beforeDuplicate` implemented in `createCrudDal`
- [ ] Router `lifecycle.onCreated/onUpdated/onDeleted/onDuplicated` implemented in `createCrudRouter`
- [ ] `onUpdated` receives `previousRow` via pre-update `getById` (only when `onUpdated` is defined)
- [ ] `meetingServerSpec` with visibility + DAL hooks registered in entity registry
- [ ] `meetingCrud` singleton created
- [ ] `listMeetings` and `getByIdWithJoins` in `entities/meetings/dal/server/queries.ts`
- [ ] Meetings entity router: `crud` + `reads` + `participants` sub-routers
- [ ] `meetingFlowRouter` registered in `app.ts` with `updateCustomerProfile` + `getPersonaProfile`
- [ ] `getCustomerProjects` + `assignToProject` moved to `customerPipelinesRouter`
- [ ] `linkProposal` + `getPortfolioForMeeting` removed (dead code)
- [ ] All client-side tRPC call paths updated
- [ ] `use-invalidation.ts` updated for path changes
- [ ] `pnpm tsc` + `pnpm lint` clean
- [ ] No behavior change — all meeting operations work identically

## Out of Scope

- Proposals router `business` → `reads` rename (follow-up)
- Customer/Project/LeadSource entity migrations (#213, #214)
- Dead code + ad-hoc duplication audit (#215)
- `meeting-flow` feature DAL directory creation (deferred until more procedures warrant it)
- Participant DAL signature standardization to `ScopedContext` + `DalReturn` (punch list B)
