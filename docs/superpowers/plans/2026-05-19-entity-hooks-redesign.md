# Entity Lifecycle Hooks Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the two-layer hook system (DAL `beforeX` + router `lifecycle`) into a single lifecycle hooks object on `EntityServerSpec`, with all hooks executing at the DAL layer.

**Architecture:** All hooks live on `EntityServerSpec.hooks` as `create.before/after`, `update.before/after`, `delete.before/after`. Both before and after hooks execute inside `createCrudDal`. The router (`createCrudRouter`) loses its `lifecycle` config and becomes a thin pass-through (CASL + Zod + dalToTrpc). Duplicate is declarative config (`exclude` + `overrides`) on the spec, routing through `createImpl` so create hooks fire automatically.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC v11, Zod

**Spec:** `docs/superpowers/specs/2026-05-19-entity-hooks-redesign.md`

---

## File Map

### Modified Files

| File | Responsibility |
|---|---|
| `src/shared/dal/server/types.ts` | `EntityServerSpec` type: restructure hooks, add duplicate config |
| `src/shared/dal/server/lib/create-crud-dal.ts` | Invoke before+after hooks, rewrite duplicateImpl |
| `src/trpc/lib/create-crud-router.ts` | Remove lifecycle config, document handler override warning |
| `src/shared/entities/meetings/lib/server-spec.ts` | Migrate to new hooks shape, add after hooks + duplicate config |
| `src/shared/entities/proposals/lib/server-spec.ts` | Add create.before hook + duplicate config |
| `src/shared/entities/proposals/dal/server/mutations.ts` | Remove `proposalCreateDal` and `proposalDuplicateDal` (keep `recordProposalView`) |
| `src/trpc/routers/meetings.router/index.ts` | Remove lifecycle import and config |
| `src/trpc/routers/proposals.router/index.ts` | Remove handlers override |
| `docs/adr/0002-entity-server-system.md` | Update hooks section |
| `docs/how-to/add-an-entity.md` | Update hooks step |
| `docs/codebase-conventions/dal-conventions.md` | Add hooks contract |
| `src/trpc/DOCS.md` | Add lifecycle hooks section |
| `src/shared/entities/meetings/DOCS.md` | Update hook references |
| `src/shared/entities/proposals/DOCS.md` | Update hook references |

### Created Files

| File | Responsibility |
|---|---|
| `src/shared/entities/proposals/lib/snap-sow-from-meeting.ts` | Extract SOW snapshot logic from proposalCreateDal |
| `src/shared/entities/proposals/lib/generate-share-token.ts` | Extract token generation from proposalCreateDal |

### Deleted Files

| File | Reason |
|---|---|
| `src/trpc/routers/meetings.router/lifecycle.ts` | Merged into meeting server-spec hooks |

---

## Task 1: Restructure `EntityServerSpec` Type

**Files:**
- Modify: `src/shared/dal/server/types.ts:62-89`

- [ ] **Step 1: Replace the `hooks` property and add `duplicate` config on `EntityServerSpec`**

Open `src/shared/dal/server/types.ts`. Replace lines 80-88 (the current `update?`, `hooks?` block) with the new hooks shape and duplicate config:

```ts
  update?: { jsonbMergeColumns: readonly PgColumn[] }
  /**
   * Entity lifecycle hooks. Executed by createCrudDal — both before and after.
   *
   * - `before` hooks: async, data transformation. Can read DB via DAL functions
   *   (never naked `db`). Return the (possibly enriched) data.
   * - `after` hooks: async, side effects (services, notifications, realtime).
   *   The hook implementation decides what to `await` (critical) vs
   *   `void .catch()` (best-effort).
   *
   * All hooks receive ScopedContext. Hooks should be thin orchestrators —
   * pure business logic belongs in `entities/<entity>/lib/`, service
   * orchestration uses existing services.
   */
  hooks?: {
    create?: {
      // eslint-disable-next-line ts/method-signature-style -- bivariant method signatures required for EntityServerSpec<Table> → EntityServerSpec<PgTable> assignability
      before?(input: Insert<TTable>, ctx: ScopedContext): Promise<Insert<TTable>> | Insert<TTable>
      // eslint-disable-next-line ts/method-signature-style
      after?(row: Row<TTable>, ctx: ScopedContext): Promise<void>
    }
    update?: {
      // eslint-disable-next-line ts/method-signature-style
      before?(data: Update<TTable>, ctx: ScopedContext): Promise<Update<TTable>> | Update<TTable>
      // eslint-disable-next-line ts/method-signature-style
      after?(row: Row<TTable>, ctx: ScopedContext, meta: {
        previousRow: Row<TTable>
        input: Update<TTable>
      }): Promise<void>
    }
    delete?: {
      // eslint-disable-next-line ts/method-signature-style
      before?(id: string | number, ctx: ScopedContext): Promise<void>
      // eslint-disable-next-line ts/method-signature-style
      after?(id: string | number, ctx: ScopedContext): Promise<void>
    }
  }
  /**
   * Declarative duplicate config. Default behavior: copy full row minus PK.
   * Duplicate routes through createImpl — create hooks fire automatically.
   * This is NOT a hook. It's declarative configuration for field selection.
   */
  duplicate?: {
    /** Fields to drop beyond PK (which is always dropped). */
    exclude?: readonly string[]
    /** Override/transform specific field values on the copy. */
    // eslint-disable-next-line ts/method-signature-style
    overrides?(source: Row<TTable>, ctx: ScopedContext): Partial<Insert<TTable>>
  }
```

Note: the `update?` property for `jsonbMergeColumns` already exists at line 79 — do NOT duplicate it. The new `hooks?` replaces the old `hooks?` block (lines 81-88). The `duplicate?` config is a new sibling property.

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc 2>&1 | head -30`

Expected: Type errors in `create-crud-dal.ts` and `server-spec.ts` files (they still reference old hook shape). That's correct — we fix those in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/shared/dal/server/types.ts
git commit -m "refactor(dal): restructure EntityServerSpec hooks type to lifecycle hooks pattern"
```

---

## Task 2: Update `createCrudDal` — Before + After Hooks at DAL Layer

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts`

- [ ] **Step 1: Update `createImpl` to invoke `create.before` and `create.after`**

Replace the `createImpl` function (lines 67-86) with:

```ts
async function createImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  ctx: ScopedContext,
  input: Insert<TTable>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const enriched = spec.hooks?.create?.before
      ? await spec.hooks.create.before(input, ctx)
      : input
    const validated = spec.schemas.insert.parse(enriched) as Insert<TTable>
    const [row] = await db
      .insert(spec.table as PgTable)
      .values(validated)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }

    if (spec.hooks?.create?.after) {
      await spec.hooks.create.after(row as Row<TTable>, ctx)
    }

    return row as Row<TTable>
  })
}
```

- [ ] **Step 2: Update `updateImpl` to invoke `update.before` and `update.after`**

Replace the `updateImpl` function (lines 90-112) with:

```ts
async function updateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number, data: Update<TTable> },
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const enrichedData = spec.hooks?.update?.before
      ? await spec.hooks.update.before(input.data, ctx)
      : input.data

    // Fetch previousRow only when after hook needs it (one extra SELECT)
    let previousRow: Row<TTable> | undefined
    if (spec.hooks?.update?.after) {
      const prev = await getByIdImpl(spec, pkColumn, ctx, { id: input.id })
      if (prev.success) {
        previousRow = prev.data as Row<TTable> | undefined
      }
    }

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

    if (spec.hooks?.update?.after && previousRow) {
      await spec.hooks.update.after(row as Row<TTable>, ctx, {
        previousRow,
        input: input.data,
      })
    }

    return row as Row<TTable>
  })
}
```

- [ ] **Step 3: Update `deleteImpl` to invoke `delete.before` and `delete.after`**

Replace the `deleteImpl` function (lines 116-132) with:

```ts
async function deleteImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (spec.hooks?.delete?.before) {
      await spec.hooks.delete.before(input.id, ctx)
    }

    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const deleted = await db
      .delete(spec.table as PgTable)
      .where(where)
      .returning({ id: pkColumn })
    if (deleted.length === 0) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    if (spec.hooks?.delete?.after) {
      await spec.hooks.delete.after(input.id, ctx)
    }
  })
}
```

- [ ] **Step 4: Rewrite `duplicateImpl` to use declarative config and route through `createImpl`**

Replace the `duplicateImpl` function (lines 136-169) with:

```ts
async function duplicateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable>>> {
  // 1. Fetch source row
  const srcResult = await getByIdImpl(spec, pkColumn, ctx, input)
  if (!srcResult.success) {
    return srcResult
  }
  const source = srcResult.data
  if (!source) {
    return { success: false, error: { type: 'not-found' } }
  }

  // 2. Copy full row, drop PK + excluded fields
  const pkName = spec.primaryKey ?? 'id'
  const excludeSet = new Set<string>([
    pkName,
    ...(spec.duplicate?.exclude ?? []),
  ])
  const base = Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !excludeSet.has(key)),
  )

  // 3. Apply overrides
  const overrides = spec.duplicate?.overrides?.(source, ctx) ?? {}
  const insertData = { ...base, ...overrides } as Insert<TTable>

  // 4. Route through createImpl — create.before + create.after fire automatically
  return createImpl(spec, ctx, insertData)
}
```

Note: `duplicateImpl` no longer wraps in `dalDbOperation` itself because `createImpl` already does. Error handling for the source fetch uses early return instead of throwing inside `dalDbOperation`.

- [ ] **Step 5: Add `dalVerifySuccess` import if not already present**

Check the imports at the top of `create-crud-dal.ts`. The file currently imports `ThrowableDalError` from `../types` and `dalDbOperation` from `./helpers`. The new `duplicateImpl` does NOT need `dalVerifySuccess` — it uses direct result checking. Verify no new imports are needed.

- [ ] **Step 6: Verify types compile**

Run: `pnpm tsc 2>&1 | head -30`

Expected: Type errors in `server-spec.ts` files (they still use old hook names). The DAL itself should compile clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "refactor(dal): invoke before+after hooks at DAL layer, declarative duplicate"
```

---

## Task 3: Update `createCrudRouter` — Remove Lifecycle, Document Handler Override

**Files:**
- Modify: `src/trpc/lib/create-crud-router.ts:28-63` (config interface), `108-170` (mutations)

- [ ] **Step 1: Remove `lifecycle` from `CreateCrudRouterConfig` and update `handlers` warning**

Replace lines 47-62 (the `handlers?` and `lifecycle?` properties) with:

```ts
  /**
   * Override individual CRUD handlers. Merged with createCrudDal defaults.
   * ⚠️ Overrides BYPASS spec.hooks entirely — the override replaces the
   * full DAL function including its before/after hook invocations.
   * Prefer spec.hooks for data enrichment; use this only when the entire
   * operation must be replaced.
   */
  handlers?: Partial<CrudHandlers<TTable, TId>>
```

Remove the entire `lifecycle?` property and its 4 method signatures.

- [ ] **Step 2: Remove lifecycle invocations from all mutations**

In the `create` mutation (around lines 117-119), remove:
```ts
    if (config.lifecycle?.onCreated) {
      await config.lifecycle.onCreated(ctx as AuthedContext, row)
    }
```

In the `update` mutation (around lines 133-146), remove:
```ts
    let previousRow: Row<TTable> | undefined
    if (config.lifecycle?.onUpdated) {
      previousRow = dalToTrpc(await handlers.getById(ctx, { id })) ?? undefined
    }
```
And remove:
```ts
    if (config.lifecycle?.onUpdated && previousRow) {
      await config.lifecycle.onUpdated(ctx as AuthedContext, row, {
        previousRow,
        input: { id, data: data as Update<TTable> },
      })
    }
```

In the `delete` mutation (around lines 155-157), remove:
```ts
    if (config.lifecycle?.onDeleted) {
      await config.lifecycle.onDeleted(ctx as AuthedContext, { id: input.id as TId })
    }
```

In the `duplicate` mutation (around lines 165-167), remove:
```ts
    if (config.lifecycle?.onDuplicated) {
      await config.lifecycle.onDuplicated(ctx as AuthedContext, row, input.id as TId)
    }
```

- [ ] **Step 3: Clean up unused imports**

Remove `AuthedContext` from the import at line 10 (type import from `@/trpc/types`) if it's no longer used anywhere in the file. Check whether `Update` and `Row` are still needed in imports — `Update` may still be used in the update mutation cast; `Row` may not be needed if lifecycle is gone. Verify before removing.

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc 2>&1 | head -30`

Expected: Errors in `meetings.router/index.ts` (references `lifecycle: meetingLifecycle`) and `proposals.router/index.ts` (references `handlers: { create: proposalCreateDal, ... }`). Those are fixed in Tasks 6 and 7.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/lib/create-crud-router.ts
git commit -m "refactor(trpc): remove lifecycle config from createCrudRouter"
```

---

## Task 4: Extract Proposal Helpers

**Files:**
- Create: `src/shared/entities/proposals/lib/snap-sow-from-meeting.ts`
- Create: `src/shared/entities/proposals/lib/generate-share-token.ts`

- [ ] **Step 1: Create `generate-share-token.ts`**

```ts
// Share token for homeowner proposal access. see ../DOCS.md#share-token-generated-at-insert

import { randomBytes } from 'node:crypto'

/** Generate a unique `tpr-` prefixed share token for proposal links. */
export function generateShareToken(): string {
  return `tpr-${randomBytes(8).toString('hex')}`
}
```

- [ ] **Step 2: Create `snap-sow-from-meeting.ts`**

Extract the SOW snapshot logic from `proposalCreateDal` (lines 53-78 of `proposals/dal/server/mutations.ts`):

```ts
// Snapshot trade selections from meeting flow state into proposal projectJSON.
// see ../DOCS.md#sow-snapshot-from-meeting-on-create

import type { Insert } from '@/shared/db/types'
import type { proposals } from '@/shared/db/schema/proposals'

import { createEmptySowSection } from './create-empty-sow-section'

interface MeetingFlowState {
  tradeSelections?: Array<{
    tradeId: string
    tradeName: string
    selectedScopes: Array<{ id: string, label: string }>
  }>
}

/**
 * If the meeting has trade selections and the proposal doesn't already
 * have a SOW, snapshot the selections into empty SOW sections.
 */
export function snapSowFromMeeting(
  input: Insert<typeof proposals>,
  flowState: MeetingFlowState | null,
): Insert<typeof proposals> {
  const tradeSelections = flowState?.tradeSelections
  if (!tradeSelections?.length) return input

  const projectJSON = (input.projectJSON ?? {}) as Record<string, unknown>
  const data = (projectJSON.data ?? {}) as Record<string, unknown>

  // Don't overwrite existing SOW
  if (data.sow) return input

  const sow = tradeSelections.map(entry =>
    createEmptySowSection({
      trade: { id: entry.tradeId, label: entry.tradeName },
      scopes: entry.selectedScopes,
    }),
  )

  return {
    ...input,
    projectJSON: {
      ...projectJSON,
      data: { ...data, sow },
    },
  } as typeof input
}
```

- [ ] **Step 3: Verify both files compile**

Run: `pnpm tsc 2>&1 | head -10`

Expected: No new errors from these files (they're not imported yet).

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/lib/snap-sow-from-meeting.ts src/shared/entities/proposals/lib/generate-share-token.ts
git commit -m "refactor(proposals): extract snap-sow-from-meeting and generate-share-token helpers"
```

---

## Task 5: Migrate Meetings Server Spec

**Files:**
- Modify: `src/shared/entities/meetings/lib/server-spec.ts`

- [ ] **Step 1: Add imports for services and participant DAL**

Add these imports at the top of the file (these were previously in `lifecycle.ts`):

```ts
import type { Meeting } from '@/shared/db/schema'

import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { notificationService } from '@/shared/services/notification.service'
import { ably } from '@/shared/services/providers/upstash/realtime'
import { schedulingService } from '@/shared/services/scheduling.service'
```

- [ ] **Step 2: Replace the hooks object with new lifecycle hooks shape**

Replace the entire `hooks` property (the `hooks: { beforeCreate, beforeUpdate, beforeDuplicate }` block) with:

```ts
  hooks: {
    create: {
      // see ../DOCS.md#meeting-owner-not-just-creator
      before(input, ctx) {
        return { ...input, ownerId: ctx.session!.user.id }
      },
      // Merged from lifecycle.ts onCreated + onDuplicated (identical behavior)
      async after(row: Meeting, ctx) {
        await addParticipant(row.id, ctx.session!.user.id, 'owner')

        if (row.scheduledFor) {
          void schedulingService
            .pushToGCal(ctx.session!.user.id, 'meeting', row.id)
            .catch(err => console.error(`[meetings.create] GCal push failed for ${row.id}:`, err))
        }
      },
    },
    update: {
      // see ../DOCS.md#meeting-pipeline-storage-vs-derived
      before(data) {
        if (data.meetingOutcome) {
          const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
          if (pipeline != null) {
            return { ...data, pipeline }
          }
        }
        return data
      },
      // Merged from lifecycle.ts onUpdated
      async after(row: Meeting, ctx, meta) {
        const { previousRow, input: data } = meta

        if ('scheduledFor' in data || 'meetingType' in data || 'agentNotes' in data) {
          void schedulingService
            .pushToGCal(ctx.session!.user.id, 'meeting', row.id)
            .catch(err => console.error(`[meetings.update] GCal push failed for ${row.id}:`, err))
        }

        if (previousRow.scheduledFor !== row.scheduledFor) {
          void notificationService
            .notifyMeetingScheduledTimeChanged({
              meetingId: row.id,
              oldScheduledFor: previousRow.scheduledFor,
              newScheduledFor: row.scheduledFor,
              excludeUserId: ctx.session!.user.id,
            })
            .catch(err => console.warn('[push] notifyMeetingScheduledTimeChanged failed:', err))
        }

        void ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
          fields: Object.keys(data),
        })
      },
    },
  },
```

- [ ] **Step 3: Add declarative duplicate config**

Add after the `hooks` block, as a sibling property:

```ts
  // see ../DOCS.md#duplicate-cherry-picks-setup-fields
  // Default: copy full row minus PK. Exclude derived/outcome/calendar fields.
  // Routed through createImpl — create.before stamps ownerId, create.after adds participant.
  duplicate: {
    exclude: [
      'createdAt', 'updatedAt',
      'meetingOutcome', 'pipeline',
      'flowStateJSON', 'agentNotes',
      'projectId',
      'gcalEventId', 'gcalEtag', 'gcalSyncedAt',
    ],
    overrides: (_source, ctx) => ({
      ownerId: ctx.session!.user.id,
    }),
  },
```

Note: `id` is always excluded by `duplicateImpl` — don't list it. The fields kept are: `customerId`, `meetingType`, `scheduledFor`, `contextJSON` — matching the current `beforeDuplicate` cherry-pick behavior.

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc 2>&1 | head -20`

Expected: May see errors from `meetings.router/index.ts` still referencing lifecycle. Fixed in Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/meetings/lib/server-spec.ts
git commit -m "refactor(meetings): migrate to unified lifecycle hooks on server-spec"
```

---

## Task 6: Migrate Proposals Server Spec + Clean Up Mutations

**Files:**
- Modify: `src/shared/entities/proposals/lib/server-spec.ts`
- Modify: `src/shared/entities/proposals/dal/server/mutations.ts`

- [ ] **Step 1: Add imports to proposals server-spec**

Add these imports at the top of `server-spec.ts`:

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { deriveProposalKind } from '@/shared/entities/proposals/lib/derive-proposal-kind'
import { generateShareToken } from '@/shared/entities/proposals/lib/generate-share-token'
import { snapSowFromMeeting } from '@/shared/entities/proposals/lib/snap-sow-from-meeting'
```

- [ ] **Step 2: Add hooks and duplicate config to `proposalServerSpec`**

After the `update: { jsonbMergeColumns: [...] }` property, add:

```ts
  hooks: {
    create: {
      // see ../DOCS.md#kind-derived-from-meeting-project
      // see ../DOCS.md#share-token-generated-at-insert
      // see ../DOCS.md#sow-snapshot-from-meeting-on-create
      async before(input, ctx) {
        const meeting = input.meetingId
          ? dalVerifySuccess(await meetingCrud.getById(SYSTEM_CONTEXT, { id: input.meetingId as string }))
          : null

        const kind = deriveProposalKind(meeting?.projectId ?? null)
        const token = generateShareToken()
        const enriched = snapSowFromMeeting(input, meeting?.flowStateJSON ?? null)

        return { ...enriched, kind, token }
      },
    },
  },

  // see ../DOCS.md#duplicate-resets-and-redrives
  // Default: copy full row minus PK. Exclude derived/status/timeline fields.
  // Routed through createImpl — create.before re-derives kind + generates fresh token.
  duplicate: {
    exclude: [
      'createdAt', 'updatedAt',
      'status', 'kind', 'token',
      'sentAt', 'approvedAt',
      'contractSentAt', 'contractViewedAt', 'contractSignedAt', 'contractDeclinedAt',
      'signingRequestId', 'qbInvoiceId', 'qbPaymentStatus',
    ],
    overrides: (source, ctx) => ({
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
      status: 'draft' as const,
    }),
  },
```

- [ ] **Step 3: Remove `proposalCreateDal` and `proposalDuplicateDal` from mutations.ts**

Open `src/shared/entities/proposals/dal/server/mutations.ts`. Delete the `proposalCreateDal` function (lines 25-95) and `proposalDuplicateDal` function (lines 99-124). Keep the file header comment (update it), keep the `recordProposalView` function (lines 128-139), and clean up imports that are no longer needed.

The file should look like:

```ts
// Proposal entity DAL mutations. Business-specific operations beyond CRUD.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalViews } from '@/shared/db/schema/proposal-views'

// ── recordProposalView ─────────────────────────────────────────────────

/** Records a proposal view event. Called from the public recordView procedure on homeowner open. */
export async function recordProposalView(
  input: InsertProposalView,
): Promise<DalReturn<ProposalView>> {
  return dalDbOperation(async () => {
    const [view] = await db.insert(proposalViews).values(input).returning()
    if (!view) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return view
  })
}
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc 2>&1 | head -20`

Expected: Error in `proposals.router/index.ts` — still imports `proposalCreateDal`/`proposalDuplicateDal`. Fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/proposals/lib/server-spec.ts src/shared/entities/proposals/dal/server/mutations.ts
git commit -m "refactor(proposals): migrate to lifecycle hooks, remove custom create/duplicate DAL"
```

---

## Task 7: Wire Meetings Router — Remove Lifecycle

**Files:**
- Modify: `src/trpc/routers/meetings.router/index.ts`
- Delete: `src/trpc/routers/meetings.router/lifecycle.ts`

- [ ] **Step 1: Update meetings router**

Replace the full content of `src/trpc/routers/meetings.router/index.ts` with:

```ts
import z from 'zod'

import { meetingSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { createParticipantsRouter } from './participants.router'
import { createMeetingReadsRouter } from './reads.router'

export const meetingsRouter = createEntityRouter(meetingServerSpec, (entity) => {
  return createTRPCRouter({
    crud: createCrudRouter({
      spec: meetingServerSpec,
      schemas: { ...meetingSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),
    reads: createMeetingReadsRouter(entity),
    participants: createParticipantsRouter(entity),
  })
})
```

Changes: removed `import { meetingLifecycle }` and removed `lifecycle: meetingLifecycle` from `createCrudRouter` config.

- [ ] **Step 2: Delete lifecycle.ts**

```bash
rm src/trpc/routers/meetings.router/lifecycle.ts
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc 2>&1 | head -20`

Expected: Clean for meetings. May still have proposals router errors (Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/meetings.router/index.ts
git rm src/trpc/routers/meetings.router/lifecycle.ts
git commit -m "refactor(meetings): remove lifecycle.ts, hooks now on server-spec"
```

---

## Task 8: Wire Proposals Router — Remove Handler Overrides

**Files:**
- Modify: `src/trpc/routers/proposals.router/index.ts`

- [ ] **Step 1: Update proposals router**

Replace the full content of `src/trpc/routers/proposals.router/index.ts` with:

```ts
import z from 'zod'

import { getFinanceOptions } from '@/shared/entities/finance-options/dal/server/queries'
import { getFullView, listProposals, proposalListInputSchema } from '@/shared/entities/proposals/dal/server/queries'
import { proposalSchemas, proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { createContractsRouter } from './contracts.router'
import { createDeliveryRouter } from './delivery.router'

export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) => {
  return createTRPCRouter({
    // ── CRUD (5 single-row operations) ──────────────────────────────────
    // Generated by createCrudRouter. Create enrichment (kind derivation,
    // token gen, SOW snapshot) and duplicate config (field exclusion, status
    // reset) now live on proposalServerSpec.hooks and .duplicate.
    crud: createCrudRouter({
      spec: proposalServerSpec,
      schemas: { ...proposalSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),

    // ── Business queries ──────────────────────────────────────────────────
    business: createTRPCRouter({
      getFullView: entity.shareableProcedure
        .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await getFullView(ctx, input)) ?? null
        }),

      list: entity.authedProcedure
        .input(proposalListInputSchema)
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await listProposals(ctx, input))
        }),

      getFinanceOptions: entity.publicProcedure
        .query(async () => {
          return getFinanceOptions()
        }),
    }),

    // ── Service-layer sub-routers ─────────────────────────────────────────
    delivery: createDeliveryRouter(entity),
    contracts: createContractsRouter(entity),
  })
})
```

Changes: removed `proposalCreateDal`/`proposalDuplicateDal` imports, removed `handlers: { create: proposalCreateDal, duplicate: proposalDuplicateDal }` from `createCrudRouter` config, updated comment.

- [ ] **Step 2: Verify full type check passes**

Run: `pnpm tsc`

Expected: Clean — zero errors. All old hook references eliminated, all new hooks wired.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`

Expected: Clean. Fix any import sorting issues if flagged.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/proposals.router/index.ts
git commit -m "refactor(proposals): remove handler overrides, hooks now on server-spec"
```

---

## Task 9: Verify — Full Build + Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

Run: `pnpm tsc`

Expected: Zero errors.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: Zero errors.

- [ ] **Step 3: Review your own diff**

Run: `git diff main --stat` and `git diff main` to review all changes.

Check for:
- No leftover `beforeCreate`/`beforeUpdate`/`beforeDuplicate` references in types or specs
- No leftover `lifecycle` references in router configs
- No leftover imports of deleted files (`lifecycle.ts`, `proposalCreateDal`, `proposalDuplicateDal`)
- No naked `db` calls in hooks (should all go through DAL)
- No debug logs or `console.log` that shouldn't be there

- [ ] **Step 4: Start dev server and smoke test**

Run: `pnpm dev -- --port 3002`

Verify these flows still work:
1. App loads, agent dashboard renders
2. Navigate to a customer → meetings list renders
3. Create a new meeting → should succeed (ownerId stamped by `create.before`, participant added by `create.after`)
4. Update a meeting's scheduled time → should succeed (GCal push + notification fire)
5. Navigate to a proposal → renders correctly
6. Create a new proposal from a meeting → should succeed (kind derived, token generated, SOW snapshotted)

- [ ] **Step 5: Commit any fixes**

If smoke test reveals issues, fix and commit with descriptive messages.

---

## Task 10: Documentation Updates

**Files:**
- Modify: `src/trpc/DOCS.md`
- Modify: `docs/codebase-conventions/dal-conventions.md`
- Modify: `docs/adr/0002-entity-server-system.md`
- Modify: `docs/how-to/add-an-entity.md`
- Modify: `src/shared/entities/meetings/DOCS.md`
- Modify: `src/shared/entities/proposals/DOCS.md`

- [ ] **Step 1: Add lifecycle hooks section to `src/trpc/DOCS.md`**

Add a new section (find the appropriate location — after the CRUD slots section):

```md
## Lifecycle Hooks

Entity lifecycle hooks execute at the DAL layer — both before and after database writes. All hooks live on `EntityServerSpec.hooks`, organized by operation (`create`, `update`, `delete`).

### Hook Contract

| | `before` | `after` |
|---|---|---|
| **Async** | Yes (`Promise<T> \| T`) | Yes (`Promise<void>`) |
| **Purpose** | Data transformation, enrichment | Side effects (services, notifications, realtime) |
| **DB access** | Via DAL functions only (never naked `db`) | Via DAL functions only |
| **Context** | `ScopedContext` | `ScopedContext` |
| **Return** | Enriched input data | void |
| **Error** | Throw to abort | Hook impl decides: `await` (critical) vs `void .catch()` (best-effort) |

### Rules

- **Hooks are thin orchestrators.** Pure business logic in `entities/<entity>/lib/`. Service orchestration via existing services.
- **Never use naked `db` in hooks.** All DB access through DAL functions.
- **`ScopedContext` always.** `ctx.session` may be null when called from jobs/services.
- **`duplicate` is declarative config, not a hook.** Lives on `spec.duplicate` with `exclude` + `overrides`. Routes through `createImpl` so create hooks fire automatically.
- **`handlers` overrides bypass hooks entirely.** Use only when the full operation must be replaced.

### Framework Precedent

Follows better-auth (`databaseHooks`), Payload CMS (collection `beforeChange`/`afterChange`), and Prisma (client extensions) — all keep before+after at the same layer.
```

- [ ] **Step 2: Add hooks contract to `docs/codebase-conventions/dal-conventions.md`**

Find the appropriate section and add:

```md
## Lifecycle Hooks

The DAL layer is the hook execution engine for all entity lifecycle hooks. Both `before` and `after` hooks execute inside `createCrudDal` functions.

- Hooks can call other DAL functions (via `SYSTEM_CONTEXT` or passed `ctx`)
- Never use naked `db` in hooks — always go through DAL
- `before` hooks return type: `Promise<T> | T` (sync enrichment still works)
- `after` hooks return type: `Promise<void>` (fire-and-forget decided by hook impl)
- All hooks receive `ScopedContext` — handle `ctx.session` being null for jobs/services
```

- [ ] **Step 3: Update `docs/adr/0002-entity-server-system.md` hooks section**

Find the hooks/lifecycle section. Replace references to the two-layer system with the unified model. Key points to update:
- Remove: "DAL hooks are sync-only" — they're now async
- Remove: "router lifecycle callbacks for async orchestration" — after hooks now at DAL
- Add: unified hooks on EntityServerSpec, framework precedent (better-auth, Payload, Prisma)
- Add: declarative duplicate config

- [ ] **Step 4: Update `docs/how-to/add-an-entity.md` hooks step**

Find the hooks/lifecycle step. Show the new pattern with a concrete example:

```md
### Lifecycle Hooks (optional)

Add hooks to your spec for data enrichment (before) and side effects (after):

\`\`\`ts
hooks: {
  create: {
    before(input, ctx) {
      return { ...input, ownerId: ctx.session!.user.id }
    },
    async after(row, ctx) {
      await someService.onCreated(row, ctx)
    },
  },
},
\`\`\`

Add declarative duplicate config if the entity supports duplication:

\`\`\`ts
duplicate: {
  exclude: ['createdAt', 'updatedAt', 'status'],
  overrides: (source, ctx) => ({
    label: \`Copy of \${source.label}\`,
    ownerId: ctx.session!.user.id,
  }),
},
\`\`\`

Hooks should be thin orchestrators. Extract business logic to `lib/` helpers. Use existing services for orchestration.
```

- [ ] **Step 5: Update entity DOCS.md files**

In `src/shared/entities/meetings/DOCS.md`:
- Update any references to `lifecycle.ts` → now `server-spec.ts` hooks
- Update any references to `beforeCreate`/`beforeUpdate`/`beforeDuplicate` → `create.before`/`update.before`/`duplicate` config

In `src/shared/entities/proposals/DOCS.md`:
- Update references to `proposalCreateDal` → `create.before` hook on server-spec
- Update references to `proposalDuplicateDal` → `duplicate` config on server-spec
- Note the convention fix: meeting data read now goes through `meetingCrud.getById` (DAL-first)

- [ ] **Step 6: Verify lint passes after doc changes**

Run: `pnpm lint`

- [ ] **Step 7: Commit**

```bash
git add src/trpc/DOCS.md docs/codebase-conventions/dal-conventions.md docs/adr/0002-entity-server-system.md docs/how-to/add-an-entity.md src/shared/entities/meetings/DOCS.md src/shared/entities/proposals/DOCS.md
git commit -m "docs: update hooks contract across ADR, conventions, how-to, and entity DOCS"
```
