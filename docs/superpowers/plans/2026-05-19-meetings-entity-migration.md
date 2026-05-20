# Meeting Entity Server System Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Meeting entity to the Entity Server System, introducing DAL beforeWrite hooks and router lifecycle callbacks as framework extensions.

**Architecture:** Two new framework layers — DAL hooks (pure sync data transforms before SQL) and router lifecycle callbacks (async post-write orchestration). Meeting router decomposes into `crud` + `reads` + `participants` sub-routers. Feature-specific procedures move to `meetingFlowRouter` and `customerPipelinesRouter`.

**Tech Stack:** tRPC v11, Drizzle ORM, Zod, CASL, Ably realtime, better-auth

**Spec:** `docs/superpowers/specs/2026-05-19-meetings-entity-migration-design.md`

---

## File Map

### New files
| File | Purpose |
|---|---|
| `src/shared/entities/meetings/lib/server-spec.ts` | `meetingServerSpec` with DAL hooks |
| `src/shared/entities/meetings/lib/visibility.ts` | `meetingVisibility(userId)` SQL predicate |
| `src/shared/entities/meetings/dal/server/crud.ts` | `meetingCrud` singleton |
| `src/shared/entities/meetings/dal/server/queries.ts` | `listMeetings`, `getByIdWithJoins` |
| `src/trpc/routers/meetings.router/index.ts` | Entity router entry (replaces flat file) |
| `src/trpc/routers/meetings.router/reads.router.ts` | `list`, `getByIdWithJoins`, `getInternalUsers` |
| `src/trpc/routers/meetings.router/participants.router.ts` | `getParticipants`, `manageParticipants` |
| `src/trpc/routers/meetings.router/lifecycle.ts` | `meetingLifecycle` callbacks |
| `src/trpc/routers/meeting-flow.router.ts` | Feature router |

### Modified files
| File | Change |
|---|---|
| `src/shared/dal/server/types.ts` | Add `hooks` to `EntityServerSpec` |
| `src/shared/dal/server/lib/create-crud-dal.ts` | Invoke hooks in create/update/duplicate |
| `src/trpc/lib/create-crud-router.ts` | Add `lifecycle` config + invocation |
| `src/trpc/routers/app.ts` | Register `meetingFlowRouter` |
| `src/trpc/routers/customer-pipelines.router.ts` | Add `getCustomerProjects`, `assignToProject` |
| `src/shared/dal/client/hooks/use-invalidation.ts` | Update path references |
| `src/features/meeting-flow/ui/views/meeting-flow.tsx` | Update tRPC call paths |
| `src/features/meeting-flow/ui/components/persona-profile-panel.tsx` | Update tRPC call path |
| `src/features/customer-pipelines/ui/components/assign-project-dialog.tsx` | Update tRPC call paths |
| `src/shared/entities/meetings/hooks/use-meeting-actions.ts` | Update tRPC call paths |
| `src/shared/entities/meetings/hooks/use-participant-mutations.tsx` | Update tRPC call paths |
| `src/shared/entities/meetings/components/create-meeting-form.tsx` | Update tRPC call paths |
| `src/shared/entities/meetings/components/participants-slot.tsx` | Update tRPC call path |
| `src/shared/entities/meetings/components/participant-picker/participant-picker.tsx` | Update tRPC call path |
| `src/shared/entities/meetings/components/participant-picker/participant-picker-content.tsx` | Update tRPC call paths |
| `src/shared/entities/meetings/components/participant-picker/read-only-participant-summary.tsx` | Update tRPC call path |
| `src/features/meeting-flow/ui/components/table/index.tsx` | Update tRPC call path |
| `src/features/schedule-management/ui/views/schedule-view.tsx` | Update tRPC call path |
| `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx` | Update tRPC call path |

### Deleted files
| File | Reason |
|---|---|
| `src/trpc/routers/meetings.router.ts` | Replaced by `meetings.router/` directory |

---

## Task 1: Add `hooks` to `EntityServerSpec` type

**Files:**
- Modify: `src/shared/dal/server/types.ts:62-80`

- [ ] **Step 1: Add hooks type to EntityServerSpec**

Open `src/shared/dal/server/types.ts`. Add the `hooks` property to the `EntityServerSpec` interface, after the `update` property (line 79):

```ts
export interface EntityServerSpec<
  TTable extends PgTable = PgTable,
  // eslint-disable-next-line unused-imports/no-unused-vars -- Phantom type param carried through to CrudHandlers<TTable, TId> via createCrudDal
  TId extends string | number = string,
> {
  entityName: EntityName
  caslSubject: AppSubject
  visibility: (userId: string) => SQL
  table: TTable
  schemas: {
    insert: z.ZodObject<Record<string, z.ZodTypeAny>>
    update: z.ZodObject<Record<string, z.ZodTypeAny>>
    select: z.ZodObject<Record<string, z.ZodTypeAny>>
  }
  /** Defaults to 'id'. Override for serial PKs or custom column names. */
  primaryKey?: string
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }
  /** Sync data-enrichment hooks. Run inside createCrudDal default handlers only. */
  hooks?: {
    /** Enrich input before insert. Pure sync — no async, no DB reads, no services. */
    beforeCreate?: (input: Insert<TTable>) => Insert<TTable>
    /** Enrich data before update. Pure sync — no async, no DB reads, no services. */
    beforeUpdate?: (data: Update<TTable>) => Update<TTable>
    /** Cherry-pick fields from source row for duplicate. Pure sync. */
    beforeDuplicate?: (source: Row<TTable>) => Partial<Insert<TTable>>
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: no new errors (existing specs don't have hooks — the property is optional)

- [ ] **Step 3: Commit**

```bash
git add src/shared/dal/server/types.ts
git commit -m "feat(dal): add beforeWrite hooks to EntityServerSpec type"
```

---

## Task 2: Invoke hooks in `createCrudDal`

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts:67-83` (createImpl), `87-106` (updateImpl), `130-156` (duplicateImpl)

- [ ] **Step 1: Modify `createImpl` to call `beforeCreate` hook**

In `src/shared/dal/server/lib/create-crud-dal.ts`, modify `createImpl` (around line 67):

```ts
async function createImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  _ctx: ScopedContext,
  input: Insert<TTable>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const enriched = spec.hooks?.beforeCreate
      ? spec.hooks.beforeCreate(input)
      : input
    const validated = spec.schemas.insert.parse(enriched) as Insert<TTable>
    const [row] = await db
      .insert(spec.table as PgTable)
      .values(validated)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return row as Row<TTable>
  })
}
```

- [ ] **Step 2: Modify `updateImpl` to call `beforeUpdate` hook**

Modify `updateImpl` (around line 87):

```ts
async function updateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number, data: Update<TTable> },
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const enrichedData = spec.hooks?.beforeUpdate
      ? spec.hooks.beforeUpdate(input.data)
      : input.data
    const validated = spec.schemas.update.parse(enrichedData) as Update<TTable>
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [row] = await db
      .update(spec.table as PgTable)
      .set(validated as Record<string, unknown>)
      .where(where)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row as Row<TTable>
  })
}
```

- [ ] **Step 3: Modify `duplicateImpl` to call `beforeDuplicate` hook**

Modify `duplicateImpl` (around line 130):

```ts
async function duplicateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const srcResult = await getByIdImpl(spec, pkColumn, ctx, input)
    if (!srcResult.success) {
      throw new ThrowableDalError(srcResult.error)
    }
    const source = srcResult.data
    if (!source) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    let values: Record<string, unknown>
    if (spec.hooks?.beforeDuplicate) {
      values = spec.hooks.beforeDuplicate(source) as Record<string, unknown>
    }
    else {
      const pkName = spec.primaryKey ?? 'id'
      const { [pkName]: _droppedPk, ...rest } = source as Record<string, unknown>
      values = rest
    }

    const [row] = await db
      .insert(spec.table as PgTable)
      .values(values)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'duplicate-failed' })
    }
    return row as Row<TTable>
  })
}
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: no errors (hooks are optional, existing callers unaffected)

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "feat(dal): invoke beforeWrite hooks in createCrudDal default handlers"
```

---

## Task 3: Add `lifecycle` callbacks to `createCrudRouter`

**Files:**
- Modify: `src/trpc/lib/create-crud-router.ts`

- [ ] **Step 1: Import AuthedContext and Row types**

At the top of `src/trpc/lib/create-crud-router.ts`, add to the existing imports:

```ts
import type { Row, Update } from '@/shared/db/types'
```

And ensure `AuthedContext` is available. It lives in `@/trpc/types`. Add it to the existing import from `@/trpc/types`:

```ts
import type { AuthedContext, CrudHandlers, EntityServerSpec, SlotName } from '@/trpc/types'
```

- [ ] **Step 2: Add lifecycle type to CreateCrudRouterConfig**

After the `handlers` property in the `CreateCrudRouterConfig` interface, add:

```ts
  /** Post-write lifecycle callbacks. Async — can call services, other DALs, fire-and-forget. */
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

- [ ] **Step 3: Wire `onCreated` into create slot**

Find the `create` slot in the returned `createTRPCRouter({...})`. Replace it:

```ts
    create: config.authedProcedure
      .input(config.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'create', config.spec)
        const row = dalToTrpc(await handlers.create(ctx, input as Insert<TTable>))
        if (config.lifecycle?.onCreated) {
          await config.lifecycle.onCreated(ctx as AuthedContext, row)
        }
        return row
      }),
```

- [ ] **Step 4: Wire `onUpdated` into update slot with previousRow fetch**

Replace the `update` slot:

```ts
    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability) {
          assertCan(ctx.ability, 'update', config.spec)
        }
        const { id, data } = input as { id: TId, data: z.output<TUpdate>, token?: string }

        // Fetch previous row for lifecycle callback (one extra SELECT, only when onUpdated defined)
        let previousRow: Row<TTable> | undefined
        if (config.lifecycle?.onUpdated) {
          previousRow = dalToTrpc(await handlers.getById(ctx, { id })) ?? undefined
        }

        const row = dalToTrpc(await handlers.update(ctx, { id, data }))

        if (config.lifecycle?.onUpdated && previousRow) {
          await config.lifecycle.onUpdated(ctx as AuthedContext, row, {
            previousRow,
            input: { id, data: data as Update<TTable> },
          })
        }
        return row
      }),
```

- [ ] **Step 5: Wire `onDeleted` into delete slot**

Replace the `delete` slot:

```ts
    delete: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'delete', config.spec)
        dalToTrpc(await handlers.delete(ctx, { id: input.id }))
        if (config.lifecycle?.onDeleted) {
          await config.lifecycle.onDeleted(ctx as AuthedContext, { id: input.id as TId })
        }
      }),
```

- [ ] **Step 6: Wire `onDuplicated` into duplicate slot**

Replace the `duplicate` slot:

```ts
    duplicate: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.ability, 'duplicate', config.spec)
        const row = dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
        if (config.lifecycle?.onDuplicated) {
          await config.lifecycle.onDuplicated(ctx as AuthedContext, row, input.id as TId)
        }
        return row
      }),
```

- [ ] **Step 7: Verify types compile**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: no errors (lifecycle is optional, existing callers unaffected — proposals router passes no lifecycle)

- [ ] **Step 8: Commit**

```bash
git add src/trpc/lib/create-crud-router.ts
git commit -m "feat(trpc): add lifecycle callbacks to createCrudRouter"
```

---

## Task 4: Meeting visibility + server-spec + CRUD singleton

**Files:**
- Create: `src/shared/entities/meetings/lib/visibility.ts`
- Create: `src/shared/entities/meetings/lib/server-spec.ts`
- Create: `src/shared/entities/meetings/dal/server/crud.ts`

- [ ] **Step 1: Create visibility predicate**

Create `src/shared/entities/meetings/lib/visibility.ts`:

```ts
import type { SQL } from 'drizzle-orm'

import { meetings } from '@/shared/db/schema'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

/** Agent-visibility predicate. see ../DOCS.md#visibility-via-participation */
export function meetingVisibility(userId: string): SQL {
  return userParticipatesInMeeting(userId, meetings.id)
}
```

- [ ] **Step 2: Create server spec with DAL hooks**

Create `src/shared/entities/meetings/lib/server-spec.ts`:

```ts
import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertMeetingSchema,
  meetings,
  selectMeetingSchema,
} from '@/shared/db/schema'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { meetingVisibility } from '@/shared/entities/meetings/lib/visibility'

const updateMeetingSchema = insertMeetingSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference. */
export const meetingSchemas = {
  insert: insertMeetingSchema,
  update: updateMeetingSchema,
}

export const meetingServerSpec = {
  entityName: MEETING,
  caslSubject: MEETING,
  visibility: meetingVisibility,
  table: meetings,
  schemas: {
    insert: insertMeetingSchema,
    update: updateMeetingSchema,
    select: selectMeetingSchema,
  },
  hooks: {
    // see ../DOCS.md#meeting-pipeline-storage-vs-derived
    beforeUpdate: (data) => {
      if (data.meetingOutcome) {
        const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
        if (pipeline != null) {
          return { ...data, pipeline }
        }
      }
      return data
    },
    // see ../DOCS.md#duplicate-cherry-picks-setup-fields
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

- [ ] **Step 3: Create CRUD singleton**

Create `src/shared/entities/meetings/dal/server/crud.ts`:

```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

/** Stable CRUD handlers for the meetings entity. Single instance, fully typed. */
export const meetingCrud = createCrudDal(meetingServerSpec)
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/meetings/lib/visibility.ts src/shared/entities/meetings/lib/server-spec.ts src/shared/entities/meetings/dal/server/crud.ts
git commit -m "feat(meetings): add server-spec with DAL hooks, visibility, and CRUD singleton"
```

---

## Task 5: Meeting DAL queries — `listMeetings` and `getByIdWithJoins`

**Files:**
- Create: `src/shared/entities/meetings/dal/server/queries.ts`

This task extracts the two main read queries from `meetings.router.ts` into DAL functions with `ScopedContext` + `DalReturn<T>` signatures.

- [ ] **Step 1: Create queries.ts with listMeetings**

Create `src/shared/entities/meetings/dal/server/queries.ts`. This is a long file — it contains the 80-line paginated list query extracted from the router. Read the current implementation at `src/trpc/routers/meetings.router.ts:61-206` and extract it into a DAL function.

Key differences from the router version:
- First arg is `ctx: ScopedContext` — use `ctx.scope` instead of inline `isOmni` / `userParticipatesInMeeting` branching
- Return type is `DalReturn<T>` wrapped in `dalDbOperation`
- `isOmni` is derived from `ctx.scope === null` (scope middleware already resolved it)
- Phone gating: pass `ctx.scope === null` as the `isOmni` arg to `gatedPhoneSql()`

The function signature:

```ts
export async function listMeetings(
  ctx: ScopedContext,
  input: MeetingListInput,
): Promise<DalReturn<PaginatedResult<MeetingListRow>>>
```

Define the input schema and list row type in the same file (following the proposals pattern in `src/shared/entities/proposals/dal/server/queries.ts`).

- [ ] **Step 2: Add getByIdWithJoins**

In the same file, add `getByIdWithJoins`. Extract from `src/trpc/routers/meetings.router.ts:344-382`. Same pattern — `ctx.scope` replaces inline `isOmni` branching:

```ts
export async function getByIdWithJoins(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<MeetingWithCustomer | undefined>>
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/dal/server/queries.ts
git commit -m "feat(meetings): extract listMeetings and getByIdWithJoins to DAL"
```

---

## Task 6: Meeting lifecycle callbacks

**Files:**
- Create: `src/trpc/routers/meetings.router/lifecycle.ts`

- [ ] **Step 1: Create lifecycle.ts**

Create `src/trpc/routers/meetings.router/lifecycle.ts`:

```ts
// Meeting entity lifecycle callbacks. Orchestrate services + other DALs
// after CRUD operations succeed. see meetings DOCS.md for business rules.

import type { Meeting } from '@/shared/db/schema'
import type { AuthedContext } from '@/trpc/types'

import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { notificationService } from '@/shared/services/notification.service'
import { ably } from '@/shared/services/providers/upstash/realtime'
import { schedulingService } from '@/shared/services/scheduling.service'

export const meetingLifecycle = {
  onCreated: async (ctx: AuthedContext, row: Meeting) => {
    // see ../../../shared/entities/meetings/DOCS.md#meeting-owner-not-just-creator
    await addParticipant(row.id, ctx.session.user.id, 'owner')

    if (row.scheduledFor) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.create] GCal push failed for ${row.id}:`, err))
    }
  },

  onUpdated: async (ctx: AuthedContext, row: Meeting, meta: {
    previousRow: Meeting
    input: { id: string, data: Partial<Meeting> }
  }) => {
    const { previousRow, input: { data } } = meta

    // Push to Google Calendar if schedule-relevant fields changed
    if ('scheduledFor' in data || 'meetingType' in data || 'agentNotes' in data) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.update] GCal push failed for ${row.id}:`, err))
    }

    // Push notify other participants when scheduledFor actually changed
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

    // Publish realtime event for cross-device sync
    void ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
      fields: Object.keys(data),
    })
  },

  onDuplicated: async (ctx: AuthedContext, row: Meeting) => {
    await addParticipant(row.id, ctx.session.user.id, 'owner')

    if (row.scheduledFor) {
      void schedulingService
        .pushToGCal(ctx.session.user.id, 'meeting', row.id)
        .catch(err => console.error(`[meetings.duplicate] GCal push failed for ${row.id}:`, err))
    }
  },
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/meetings.router/lifecycle.ts
git commit -m "feat(meetings): add lifecycle callbacks for create/update/duplicate"
```

---

## Task 7: Meeting entity router — `reads` + `participants` sub-routers + `index.ts`

**Files:**
- Create: `src/trpc/routers/meetings.router/reads.router.ts`
- Create: `src/trpc/routers/meetings.router/participants.router.ts`
- Create: `src/trpc/routers/meetings.router/index.ts`
- Delete: `src/trpc/routers/meetings.router.ts` (the flat file)

- [ ] **Step 1: Create reads.router.ts**

Create `src/trpc/routers/meetings.router/reads.router.ts`:

```ts
import type { EntityToolkit } from '@/trpc/lib/create-entity-router'
import type { PgTable } from 'drizzle-orm/pg-core'

import { TRPCError } from '@trpc/server'
import { inArray } from 'drizzle-orm'
import z from 'zod'

import { user } from '@/shared/db/schema'
import { db } from '@/shared/db'
import { getByIdWithJoins, listMeetings, meetingListInputSchema } from '@/shared/entities/meetings/dal/server/queries'
import { createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

export function createMeetingReadsRouter(entity: EntityToolkit<PgTable>) {
  return createTRPCRouter({
    list: entity.authedProcedure
      .input(meetingListInputSchema)
      .query(async ({ ctx, input }) => {
        return dalToTrpc(await listMeetings(ctx, input))
      }),

    getByIdWithJoins: entity.authedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const row = dalToTrpc(await getByIdWithJoins(ctx, input))
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
        }
        return row
      }),

    getInternalUsers: entity.authedProcedure
      .query(async ({ ctx }) => {
        if (ctx.ability.cannot('assign', 'Meeting')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to assign meeting owners' })
        }

        return db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
          })
          .from(user)
          .where(inArray(user.role, ['agent', 'super-admin']))
          .orderBy(user.name)
      }),
  })
}
```

- [ ] **Step 2: Create participants.router.ts**

Create `src/trpc/routers/meetings.router/participants.router.ts`. Extract the `getParticipants` and `manageParticipants` procedures from `meetings.router.ts:485-672`. The `manageParticipants` procedure keeps its existing logic but replaces inline `db.update(meetings).set({ ownerId })` calls with `meetingCrud.update()`:

Replace every occurrence of:
```ts
await db.update(meetings).set({ ownerId: userId }).where(eq(meetings.id, meetingId))
```
with:
```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
// ...
dalVerifySuccess(await meetingCrud.update(ctx, { id: meetingId, data: { ownerId: userId } }))
```

And replace inline `isOmni` / `isParticipant` checks with `entity.authedProcedure` (scope middleware handles visibility).

For `getParticipants`, the inline visibility check (`isOmni` + `isParticipant`) is replaced by scope middleware — the procedure uses `entity.authedProcedure` which injects `ctx.scope`. However, `getParticipantsForMeeting` queries the `meetingParticipants` table (not `meetings`), so the scope predicate doesn't directly apply. Keep the explicit `isParticipant` check for now — this is a known punch-list item for participant DAL signature standardization.

- [ ] **Step 3: Create index.ts (the entity router entry point)**

Create `src/trpc/routers/meetings.router/index.ts`:

```ts
import z from 'zod'

import { meetingSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { meetingLifecycle } from './lifecycle'
import { createParticipantsRouter } from './participants.router'
import { createMeetingReadsRouter } from './reads.router'

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

- [ ] **Step 4: Delete the old flat router file**

```bash
rm src/trpc/routers/meetings.router.ts
```

- [ ] **Step 5: Verify app.ts import resolves**

Check that `src/trpc/routers/app.ts` imports `meetingsRouter` from `./meetings.router` — this will automatically resolve to `./meetings.router/index.ts`. No change needed in `app.ts` for this import.

Run: `pnpm tsc --noEmit 2>&1 | head -40`
Expected: errors ONLY from client-side files referencing old `meetingsRouter.*` paths (expected — fixed in Tasks 9-10)

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/meetings.router/
git commit -m "feat(meetings): entity router with crud + reads + participants sub-routers"
```

---

## Task 8: Feature router — `meetingFlowRouter` + customer-pipelines additions

**Files:**
- Create: `src/trpc/routers/meeting-flow.router.ts`
- Modify: `src/trpc/routers/customer-pipelines.router.ts`
- Modify: `src/trpc/routers/app.ts`

- [ ] **Step 1: Create meeting-flow.router.ts**

Create `src/trpc/routers/meeting-flow.router.ts`. Extract `updateCustomerProfileForMeeting` and `getPersonaProfile` from the old `meetings.router.ts`.

`updateCustomerProfileForMeeting` replaces `db.update(customers)` with `customerCrud.update()`:

```ts
import { TRPCError } from '@trpc/server'
import z from 'zod'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerProfileSchema, financialProfileSchema, propertyProfileSchema } from '@/shared/entities/customers/schemas'
import { buildPersonaProfile } from '@/features/meeting-flow/lib/build-persona-profile'
import { getCachedPainPoints } from '@/features/meeting-flow/lib/get-cached-pain-points'
import { getByIdWithJoins } from '@/shared/entities/meetings/dal/server/queries'
import { ably } from '@/shared/services/providers/upstash/realtime'

import { agentProcedure, createTRPCRouter } from '../init'

export const meetingFlowRouter = createTRPCRouter({
  updateCustomerProfile: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      customerId: z.string().uuid(),
      customerProfileJSON: customerProfileSchema.optional(),
      propertyProfileJSON: propertyProfileSchema.optional(),
      financialProfileJSON: financialProfileSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { meetingId, customerId, ...profiles } = input

      const updated = dalVerifySuccess(
        await customerCrud.update(SYSTEM_CONTEXT, {
          id: customerId,
          data: profiles as Record<string, unknown>,
        }),
      )

      // Publish realtime event to the meeting channel for cross-device sync
      void ably.channels.get(`meeting:${meetingId}`).publish('meeting.updated', {
        fields: Object.keys(profiles),
      })

      return updated
    }),

  getPersonaProfile: agentProcedure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = dalVerifySuccess(await getByIdWithJoins(ctx, { id: input.meetingId }))

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }

      const customer = row.customer?.id ? row.customer : null
      const painPointsDb = await getCachedPainPoints()

      return buildPersonaProfile({
        customerProfile: customer?.customerProfileJSON ?? null,
        propertyProfile: customer?.propertyProfileJSON ?? null,
        financialProfile: customer?.financialProfileJSON ?? null,
        meetingContext: row.contextJSON ?? null,
        flowState: row.flowStateJSON ?? null,
        painPointsDb,
      })
    }),
})
```

Note: The `getPersonaProfile` query uses `getByIdWithJoins` from the meetings DAL. It needs `ctx` for scoping — `agentProcedure` provides `ctx.session` and `ctx.ability`, and we construct a `ScopedContext` from them. Read the current implementation at `meetings.router.ts:758-789` and replicate the visibility logic. The current version uses inline `isOmni` branching — replicate that for now (feature routers don't use entity toolkit/scope middleware). Alternatively, use `buildUserContext` from `@/shared/dal/server/lib/helpers` to construct a properly scoped context.

- [ ] **Step 2: Add procedures to customer-pipelines router**

In `src/trpc/routers/customer-pipelines.router.ts`, add `getCustomerProjects` and `assignToProject`. Extract from `meetings.router.ts:792-858`.

For `assignToProject`, replace inline `db.update(meetings)` with `meetingCrud.update()`:

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
// ... add to existing imports

// Add inside the createTRPCRouter({...}):

  getCustomerProjects: agentProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Extract from meetings.router.ts:792-833
      // Use buildUserContext for scoped meeting read
      // ...
    }),

  assignToProject: agentProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'Meeting')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update meetings' })
      }

      return dalVerifySuccess(await meetingCrud.update(
        { session: ctx.session, ability: ctx.ability, scope: null },
        {
          id: input.meetingId,
          data: { projectId: input.projectId, meetingOutcome: 'converted_to_project' } as Record<string, unknown>,
        },
      ))
    }),
```

- [ ] **Step 3: Register meetingFlowRouter in app.ts**

In `src/trpc/routers/app.ts`, add:

```ts
import { meetingFlowRouter } from './meeting-flow.router'
```

And add to the `createTRPCRouter({...})`:

```ts
  meetingFlowRouter,
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc --noEmit 2>&1 | head -40`
Expected: errors from client-side files still referencing old paths (fixed next)

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/meeting-flow.router.ts src/trpc/routers/customer-pipelines.router.ts src/trpc/routers/app.ts
git commit -m "feat(meetings): add meetingFlowRouter + move procedures to customerPipelinesRouter"
```

---

## Task 9: Update client-side tRPC call paths — entity components

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-actions.ts`
- Modify: `src/shared/entities/meetings/hooks/use-participant-mutations.tsx`
- Modify: `src/shared/entities/meetings/components/create-meeting-form.tsx`
- Modify: `src/shared/entities/meetings/components/participants-slot.tsx`
- Modify: `src/shared/entities/meetings/components/participant-picker/participant-picker.tsx`
- Modify: `src/shared/entities/meetings/components/participant-picker/participant-picker-content.tsx`
- Modify: `src/shared/entities/meetings/components/participant-picker/read-only-participant-summary.tsx`

For each file, find-and-replace tRPC call paths:

- [ ] **Step 1: Update use-meeting-actions.ts**

Replace all occurrences:
- `trpc.meetingsRouter.delete` → `trpc.meetingsRouter.crud.delete`
- `trpc.meetingsRouter.duplicate` → `trpc.meetingsRouter.crud.duplicate`
- `trpc.meetingsRouter.update` → `trpc.meetingsRouter.crud.update`

- [ ] **Step 2: Update use-participant-mutations.tsx**

Replace all occurrences:
- `trpc.meetingsRouter.getParticipants` → `trpc.meetingsRouter.participants.getParticipants`
- `trpc.meetingsRouter.manageParticipants` → `trpc.meetingsRouter.participants.manageParticipants`

- [ ] **Step 3: Update create-meeting-form.tsx**

Replace:
- `trpc.meetingsRouter.create` → `trpc.meetingsRouter.crud.create`
- `trpc.meetingsRouter.update` → `trpc.meetingsRouter.crud.update`

- [ ] **Step 4: Update participant-picker components**

In `participants-slot.tsx`:
- `trpc.meetingsRouter.getParticipants` → `trpc.meetingsRouter.participants.getParticipants`

In `participant-picker.tsx`:
- `trpc.meetingsRouter.getParticipants` → `trpc.meetingsRouter.participants.getParticipants`

In `participant-picker-content.tsx`:
- `trpc.meetingsRouter.getParticipants` → `trpc.meetingsRouter.participants.getParticipants`
- `trpc.meetingsRouter.getInternalUsers` → `trpc.meetingsRouter.reads.getInternalUsers`

In `read-only-participant-summary.tsx`:
- `trpc.meetingsRouter.getParticipants` → `trpc.meetingsRouter.participants.getParticipants`

- [ ] **Step 5: Verify types compile for entity components**

Run: `pnpm tsc --noEmit 2>&1 | grep -c "error TS"` to count remaining errors.
Expected: errors only in feature files (fixed in Task 10)

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/meetings/
git commit -m "refactor(meetings): update entity component tRPC call paths"
```

---

## Task 10: Update client-side tRPC call paths — feature views + invalidation

**Files:**
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx`
- Modify: `src/features/meeting-flow/ui/components/persona-profile-panel.tsx`
- Modify: `src/features/meeting-flow/ui/components/table/index.tsx`
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx`
- Modify: `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx`
- Modify: `src/features/customer-pipelines/ui/components/assign-project-dialog.tsx`
- Modify: `src/shared/dal/client/hooks/use-invalidation.ts`

- [ ] **Step 1: Update meeting-flow.tsx**

Replace:
- `trpc.meetingsRouter.getById` → `trpc.meetingsRouter.reads.getByIdWithJoins`
- `trpc.meetingsRouter.update` → `trpc.meetingsRouter.crud.update`
- `trpc.meetingsRouter.updateCustomerProfileForMeeting` → `trpc.meetingFlowRouter.updateCustomerProfile`

- [ ] **Step 2: Update persona-profile-panel.tsx**

Replace:
- `trpc.meetingsRouter.getPersonaProfile` → `trpc.meetingFlowRouter.getPersonaProfile`

- [ ] **Step 3: Update meeting-flow table**

In `src/features/meeting-flow/ui/components/table/index.tsx`:
- `trpc.meetingsRouter.list` → `trpc.meetingsRouter.reads.list`

- [ ] **Step 4: Update schedule-view.tsx**

- `trpc.meetingsRouter.list` → `trpc.meetingsRouter.reads.list`

- [ ] **Step 5: Update create-new-proposal-view.tsx**

- `trpc.meetingsRouter.getById` → `trpc.meetingsRouter.reads.getByIdWithJoins`

- [ ] **Step 6: Update assign-project-dialog.tsx**

Replace:
- `trpc.meetingsRouter.getCustomerProjects` → `trpc.customerPipelinesRouter.getCustomerProjects`
- `trpc.meetingsRouter.assignToProject` → `trpc.customerPipelinesRouter.assignToProject`

- [ ] **Step 7: Update use-invalidation.ts**

Replace:
- `trpc.meetingsRouter.getCustomerProjects` → `trpc.customerPipelinesRouter.getCustomerProjects`

- [ ] **Step 8: Full type-check — zero errors**

Run: `pnpm tsc --noEmit`
Expected: zero errors

- [ ] **Step 9: Lint check**

Run: `pnpm lint`
Expected: zero errors (fix any import sorting issues)

- [ ] **Step 10: Commit**

```bash
git add src/features/ src/shared/dal/client/
git commit -m "refactor(meetings): update all feature tRPC call paths"
```

---

## Task 11: Remove dead code + final cleanup

**Files:**
- Verify: `src/trpc/routers/meetings.router.ts` is deleted (done in Task 7)

- [ ] **Step 1: Verify dead procedures are gone**

Grep to confirm `linkProposal` and `getPortfolioForMeeting` no longer exist:

Run: `grep -r "linkProposal\|getPortfolioForMeeting" src/trpc/ src/features/ src/shared/`
Expected: zero matches

- [ ] **Step 2: Verify old flat file is gone**

Run: `ls src/trpc/routers/meetings.router.ts 2>&1`
Expected: "No such file or directory"

Run: `ls src/trpc/routers/meetings.router/index.ts`
Expected: file exists

- [ ] **Step 3: Verify entity registry**

The `createEntityRouter` call in `meetings.router/index.ts` will register `meetingServerSpec` in the entity registry at module load. No manual registration needed.

- [ ] **Step 4: Full verification**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: zero errors for both

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore(meetings): verify migration complete — tsc + lint clean"
```

(Only commit if there are staged changes from cleanup. Skip `--allow-empty` if no changes.)

---

## Task 12: Manual smoke test

No code changes. Verify the app works.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev -- --port 3002`

- [ ] **Step 2: Verify meeting list loads**

Navigate to the meetings table view. Confirm data renders, filters work, pagination works.

- [ ] **Step 3: Verify meeting create + participant**

Create a new meeting from the dashboard. Confirm the creator is auto-added as participant (lifecycle callback working).

- [ ] **Step 4: Verify meeting update + pipeline derivation**

Set a meeting outcome to `not_good`. Confirm the pipeline column auto-derives to `rehash` (DAL hook working).

- [ ] **Step 5: Verify participant picker**

Open a meeting, verify the participant picker loads participants and allows add/remove/change_role.

- [ ] **Step 6: Verify meeting-flow**

Start a meeting flow, verify customer profile updates work (now going through `meetingFlowRouter`).

- [ ] **Step 7: Verify assign-to-project**

Open the customer pipelines view, try assigning a meeting to a project (now going through `customerPipelinesRouter`).
