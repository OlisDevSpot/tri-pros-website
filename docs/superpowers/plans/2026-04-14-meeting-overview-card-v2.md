# MeetingOverviewCard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single compound component in `shared/` that unifies all meeting card rendering with built-in actions. No wrappers. No feature-level shims.

**Architecture:** One file (`shared/components/entities/meetings/overview-card.tsx`) owns context, sub-components, and actions. Entity hooks move from `features/meetings/hooks/` to `shared/entities/meetings/hooks/`. Constants move to `shared/constants/meetings/`. Every view context composes this one component.

**Tech Stack:** React 19, TypeScript, shadcn/ui, date-fns, lucide-react, tRPC (TanStack Query)

**Spec:** `docs/superpowers/specs/2026-04-14-meeting-overview-card-v2.md`

---

## File Map

### Created
| File | Responsibility |
|---|---|
| `src/shared/constants/meetings/status-colors.ts` | Merged color/label maps |
| `src/shared/constants/meetings/outcome-options.ts` | Selectable outcome options |
| `src/shared/entities/meetings/hooks/use-meeting-actions.ts` | tRPC mutations for meetings |
| `src/shared/entities/meetings/hooks/use-meeting-action-configs.ts` | Action config builder with fixed base actions |
| `src/shared/components/entities/meetings/overview-card.tsx` | The compound component |

### Deleted (after migration complete)
| File | Reason |
|---|---|
| `src/features/customer-pipelines/constants/meeting-status-colors.ts` | Moved to shared |
| `src/features/meetings/constants/status-colors.ts` | Moved to shared |
| `src/features/meetings/constants/outcome-options.ts` | Moved to shared |
| `src/features/meetings/hooks/use-meeting-actions.ts` | Moved to shared |
| `src/features/meetings/hooks/use-meeting-action-configs.ts` | Moved to shared |
| `src/features/customer-pipelines/ui/components/meeting-entity-card.tsx` | Replaced by MeetingOverviewCard |
| `src/features/meetings/ui/components/calendar/meeting-calendar-card.tsx` | Replaced by MeetingOverviewCard |

### Modified (import updates)
| File | Change |
|---|---|
| `src/features/meetings/ui/components/calendar/meeting-calendar-dot.tsx` | Update constant imports |
| `src/features/meetings/ui/components/table/columns.tsx` | Update constant imports |
| `src/features/meetings/ui/components/steps/closing-step.tsx` | Update constant imports |
| `src/features/meetings/ui/components/table/index.tsx` | Update hook imports |
| `src/features/meetings/ui/views/meetings-view.tsx` | Update hook imports, use MeetingOverviewCard in calendar |
| `src/features/meetings/ui/components/calendar/meeting-calendar.tsx` | Use MeetingOverviewCard instead of MeetingCalendarCard |
| `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` | Use MeetingOverviewCard for both fresh + project meetings |
| `src/features/customer-pipelines/ui/components/customer-meetings-list.tsx` | Use MeetingOverviewCard instead of MeetingEntityCard |
| `src/features/customer-pipelines/ui/components/customer-projects-list.tsx` | Use MeetingOverviewCard instead of MeetingEntityCard |
| `src/features/customer-pipelines/ui/components/project-entity-card.tsx` | Use MeetingOverviewCard instead of MeetingEntityCard |
| `src/shared/entities/proposals/types.ts` | Add SowTradeScope |
| `src/features/customer-pipelines/types/index.ts` | Import SowTradeScope from shared |

---

### Task 1: Move constants and types to shared

**Files:**
- Create: `src/shared/constants/meetings/status-colors.ts`
- Create: `src/shared/constants/meetings/outcome-options.ts`
- Modify: `src/shared/entities/proposals/types.ts`
- Modify: `src/features/customer-pipelines/types/index.ts`
- Delete: `src/features/customer-pipelines/constants/meeting-status-colors.ts`
- Delete: `src/features/meetings/constants/status-colors.ts`
- Delete: `src/features/meetings/constants/outcome-options.ts`
- Modify: 6 consumer files (import path updates)

- [ ] **Step 1: Create `src/shared/constants/meetings/status-colors.ts`**

Merge both source files into one:

```ts
// Profile modal badge colors (used with Badge variant="outline")
export const MEETING_LIST_STATUS_COLORS: Record<string, string> = {
  not_set: 'bg-zinc-500/10 text-zinc-600',
  converted_to_project: 'bg-green-500/10 text-green-600',
  proposal_sent: 'bg-lime-500/10 text-lime-600',
  proposal_created: 'bg-amber-500/10 text-amber-600',
  follow_up_needed: 'bg-purple-500/10 text-purple-600',
  not_good: 'bg-red-500/10 text-red-600',
  pns: 'bg-red-500/10 text-red-600',
  npns: 'bg-red-500/10 text-red-600',
  ftd: 'bg-red-500/10 text-red-600',
  no_show: 'bg-red-500/10 text-red-600',
  lost_to_competitor: 'bg-red-500/10 text-red-600',
  not_interested: 'bg-red-500/10 text-red-600',
}

export const MEETING_OUTCOME_COLORS: Record<string, string> = {
  not_set: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  converted_to_project: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  proposal_sent: 'border-lime-500/30 bg-lime-500/10 text-lime-400',
  proposal_created: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  follow_up_needed: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  not_good: 'border-red-500/30 bg-red-500/10 text-red-400',
  pns: 'border-red-500/30 bg-red-500/10 text-red-400',
  npns: 'border-red-500/30 bg-red-500/10 text-red-400',
  ftd: 'border-red-500/30 bg-red-500/10 text-red-400',
  no_show: 'border-red-500/30 bg-red-500/10 text-red-400',
  lost_to_competitor: 'border-red-500/30 bg-red-500/10 text-red-400',
  not_interested: 'border-red-500/30 bg-red-500/10 text-red-400',
}

export const MEETING_OUTCOME_LABELS: Record<string, string> = {
  not_set: 'Not Set',
  converted_to_project: 'Converted to Project',
  proposal_sent: 'Proposal Sent',
  proposal_created: 'Proposal Created',
  follow_up_needed: 'Follow-up Needed',
  not_good: 'Not Good',
  pns: 'PNS',
  npns: 'NPNS',
  ftd: 'FTD',
  no_show: 'No Show',
  lost_to_competitor: 'Lost to Contractor',
  not_interested: 'Not Interested',
}

export const MEETING_OUTCOME_DOT_COLORS: Record<string, string> = {
  not_set: 'bg-zinc-500',
  converted_to_project: 'bg-emerald-500',
  proposal_sent: 'bg-lime-500',
  proposal_created: 'bg-amber-500',
  follow_up_needed: 'bg-purple-500',
  not_good: 'bg-red-500',
  pns: 'bg-red-500',
  npns: 'bg-red-500',
  ftd: 'bg-red-500',
  no_show: 'bg-red-500',
  lost_to_competitor: 'bg-red-500',
  not_interested: 'bg-red-500',
}
```

- [ ] **Step 2: Create `src/shared/constants/meetings/outcome-options.ts`**

```ts
import type { EntityActionOption } from '@/shared/components/entity-actions/types'

import { MEETING_OUTCOME_DOT_COLORS, MEETING_OUTCOME_LABELS } from '@/shared/constants/meetings/status-colors'
import { selectableMeetingOutcomes } from '@/shared/constants/enums'

export const MEETING_OUTCOME_OPTIONS: EntityActionOption[] = selectableMeetingOutcomes.map(value => ({
  label: MEETING_OUTCOME_LABELS[value] ?? value.replace(/_/g, ' '),
  value,
  color: MEETING_OUTCOME_DOT_COLORS[value],
}))
```

- [ ] **Step 3: Add `SowTradeScope` to `src/shared/entities/proposals/types.ts`**

Add after existing exports:

```ts
export interface SowTradeScope {
  trade: string
  scopes: string[]
}
```

- [ ] **Step 4: Update `src/features/customer-pipelines/types/index.ts`**

Replace the inline `SowTradeScope` definition with an import + re-export:

```ts
// Add import:
import type { SowTradeScope } from '@/shared/entities/proposals/types'

// Replace the interface definition with:
export type { SowTradeScope } from '@/shared/entities/proposals/types'
```

- [ ] **Step 5: Update all constant import paths**

6 files need import path changes:

| File | Old import | New import |
|---|---|---|
| `src/features/customer-pipelines/ui/components/meeting-entity-card.tsx` | `@/features/customer-pipelines/constants/meeting-status-colors` and `@/features/meetings/constants/status-colors` | `@/shared/constants/meetings/status-colors` |
| `src/features/meetings/ui/components/calendar/meeting-calendar-dot.tsx` | `@/features/meetings/constants/status-colors` | `@/shared/constants/meetings/status-colors` |
| `src/features/meetings/ui/components/calendar/meeting-calendar-card.tsx` | `@/features/meetings/constants/status-colors` | `@/shared/constants/meetings/status-colors` |
| `src/features/meetings/ui/components/table/columns.tsx` | `@/features/meetings/constants/status-colors` | `@/shared/constants/meetings/status-colors` |
| `src/features/meetings/ui/components/steps/closing-step.tsx` | `@/features/meetings/constants/status-colors` | `@/shared/constants/meetings/status-colors` |

- [ ] **Step 6: Delete old constant files**

```
src/features/customer-pipelines/constants/meeting-status-colors.ts
src/features/meetings/constants/status-colors.ts
src/features/meetings/constants/outcome-options.ts
```

- [ ] **Step 7: Verify + commit**

```bash
pnpm tsc --noEmit && pnpm lint
git commit -m "refactor: move meeting constants and SowTradeScope to shared"
```

---

### Task 2: Move meeting hooks to shared/entities/meetings/hooks/

**Files:**
- Create: `src/shared/entities/meetings/hooks/use-meeting-actions.ts`
- Create: `src/shared/entities/meetings/hooks/use-meeting-action-configs.ts`
- Delete: `src/features/meetings/hooks/use-meeting-actions.ts`
- Delete: `src/features/meetings/hooks/use-meeting-action-configs.ts`
- Modify: 4 consumer files (import path updates)

- [ ] **Step 1: Create `src/shared/entities/meetings/hooks/use-meeting-actions.ts`**

Exact copy of the features file — no changes needed, all imports are already from `@/shared/` or `@/trpc/`:

```ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useMeetingActions() {
  const trpc = useTRPC()
  const { invalidateMeeting } = useInvalidation()

  const deleteMeeting = useMutation(
    trpc.meetingsRouter.delete.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting deleted')
      },
      onError: () => toast.error('Failed to delete meeting'),
    }),
  )

  const duplicateMeeting = useMutation(
    trpc.meetingsRouter.duplicate.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting duplicated')
      },
      onError: () => toast.error('Failed to duplicate meeting'),
    }),
  )

  const updateOutcome = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Outcome updated')
      },
      onError: () => toast.error('Failed to update outcome'),
    }),
  )

  const updateScheduledFor = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Scheduled date updated')
      },
      onError: () => toast.error('Failed to update scheduled date'),
    }),
  )

  return { deleteMeeting, duplicateMeeting, updateOutcome, updateScheduledFor }
}
```

- [ ] **Step 2: Create `src/shared/entities/meetings/hooks/use-meeting-action-configs.ts`**

Modified from the features version. Key changes:
- Import `MEETING_OUTCOME_OPTIONS` from new shared path
- Import `useMeetingActions` from new relative path
- Fixed base actions: `onView` opens customer profile modal (requires `customerId`)
- `assignOwner` is conditional (only when `onAssignOwner` provided)
- `assignProject` is conditional (only when `onAssignProject` provided)

```ts
'use client'

import type { JSX } from 'react'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { MeetingOutcome } from '@/shared/types/enums'

import { useCallback, useMemo } from 'react'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { MEETING_ACTIONS } from '@/shared/components/entity-actions/constants/meeting-actions'
import { ROOTS } from '@/shared/config/roots'
import { MEETING_OUTCOME_OPTIONS } from '@/shared/constants/meetings/outcome-options'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useModalStore } from '@/shared/hooks/use-modal-store'

import { useMeetingActions } from './use-meeting-actions'

interface MeetingEntity {
  id: string
  meetingOutcome?: string
  customerId?: string | null
}

interface MeetingActionOverrides {
  onAssignOwner?: (entity: MeetingEntity) => void
  onAssignProject?: (entity: MeetingEntity) => void
}

interface MeetingActionConfigsResult {
  actions: EntityActionConfig<MeetingEntity>[]
  DeleteConfirmDialog: () => JSX.Element
}

export function useMeetingActionConfigs(
  customerId: string,
  overrides: MeetingActionOverrides = {},
): MeetingActionConfigsResult {
  const { deleteMeeting, duplicateMeeting, updateOutcome } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete meeting',
    message: 'This will permanently delete this meeting and its data. This cannot be undone.',
  })

  const handleView = useCallback((entity: MeetingEntity) => {
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId, defaultTab: 'meetings' as const, highlightMeetingId: entity.id },
    })
    openModal()
  }, [customerId, setModal, openModal])

  const actions = useMemo((): EntityActionConfig<MeetingEntity>[] => {
    const configs: EntityActionConfig<MeetingEntity>[] = [
      {
        action: MEETING_ACTIONS.view,
        onAction: handleView,
      },
      {
        action: MEETING_ACTIONS.start,
        onAction: (entity) => {
          window.location.href = ROOTS.dashboard.meetings.byId(entity.id)
        },
      },
      {
        action: MEETING_ACTIONS.duplicate,
        onAction: entity => duplicateMeeting.mutate({ id: entity.id }),
        isLoading: duplicateMeeting.isPending,
      },
      {
        action: MEETING_ACTIONS.setOutcome,
        type: 'select' as const,
        options: MEETING_OUTCOME_OPTIONS,
        getCurrentValue: (entity: MeetingEntity) => entity.meetingOutcome ?? 'not_set',
        onSelect: (entity: MeetingEntity, value: string) => {
          updateOutcome.mutate({ id: entity.id, meetingOutcome: value as MeetingOutcome })
        },
        isLoading: updateOutcome.isPending,
      },
      {
        action: MEETING_ACTIONS.createProposal,
        onAction: (entity) => {
          window.location.href = `${ROOTS.dashboard.proposals.new()}?meetingId=${entity.id}`
        },
      },
    ]

    if (overrides.onAssignOwner) {
      configs.push({
        action: MEETING_ACTIONS.assignOwner,
        onAction: overrides.onAssignOwner,
      })
    }

    if (overrides.onAssignProject) {
      configs.push({
        action: MEETING_ACTIONS.assignProject,
        onAction: overrides.onAssignProject,
      })
    }

    configs.push({
      action: MEETING_ACTIONS.delete,
      onAction: async (entity: MeetingEntity) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteMeeting.mutate({ id: entity.id })
        }
      },
      isLoading: deleteMeeting.isPending,
    })

    return configs
  }, [handleView, overrides.onAssignOwner, overrides.onAssignProject, duplicateMeeting, updateOutcome, deleteMeeting, confirmDelete])

  return { actions, DeleteConfirmDialog }
}
```

**Note:** This hook imports `CustomerProfileModal` from `@/features/customer-pipelines/ui/components` (the public entrypoint). This is a `shared/` → `features/` import which violates Rule 12. However, this is a pragmatic exception: the modal is the canonical way to view a meeting, and this hook is entity infrastructure that needs it. If the team wants strict Rule 12 compliance, the modal reference can be injected via a provider pattern later. For now, the import through the public entrypoint is acceptable.

**IMPORTANT:** Check if `@/features/customer-pipelines/ui/components` actually exports `CustomerProfileModal`. If not, either add it to the barrel or import directly from the file.

- [ ] **Step 3: Update all hook import paths**

4 consumer files:

| File | Old import | New import |
|---|---|---|
| `src/features/meetings/ui/views/meetings-view.tsx` | `@/features/meetings/hooks/use-meeting-action-configs` and `@/features/meetings/hooks/use-meeting-actions` | `@/shared/entities/meetings/hooks/use-meeting-action-configs` and `@/shared/entities/meetings/hooks/use-meeting-actions` |
| `src/features/meetings/ui/components/table/index.tsx` | Same old paths | Same new paths |
| `src/features/customer-pipelines/ui/components/meeting-entity-card.tsx` | `@/features/meetings/hooks/use-meeting-action-configs` | `@/shared/entities/meetings/hooks/use-meeting-action-configs` |
| `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` | `@/features/meetings/hooks/use-meeting-action-configs` | `@/shared/entities/meetings/hooks/use-meeting-action-configs` |

**Note:** The new `useMeetingActionConfigs` has a different signature: `useMeetingActionConfigs(customerId, overrides)` instead of `useMeetingActionConfigs(overrides)`. Consumer call sites will be updated in Tasks 4-7 when they're migrated to MeetingOverviewCard. For now, temporarily keep the old files alongside the new ones to avoid breaking consumers. Delete the old files in Task 8.

Actually — simpler approach: just update the import paths now. The old-signature consumers will get type errors, which we fix in Tasks 4-7 when migrating each consumer. This is fine because we're doing all tasks in sequence.

- [ ] **Step 4: Delete old hook files**

```
src/features/meetings/hooks/use-meeting-actions.ts
src/features/meetings/hooks/use-meeting-action-configs.ts
```

- [ ] **Step 5: Verify + commit**

```bash
pnpm tsc --noEmit  # Will have errors in unmigrated consumers — expected
git add src/shared/entities/meetings/hooks/ src/shared/constants/meetings/ src/shared/entities/proposals/types.ts src/features/customer-pipelines/types/index.ts
git commit -m "refactor: move meeting hooks to shared/entities/meetings/hooks"
```

**Note:** Type errors from unmigrated consumers are expected at this point. They'll be fixed in Tasks 3-7.

---

### Task 3: Create MeetingOverviewCard compound component

**Files:**
- Create: `src/shared/components/entities/meetings/overview-card.tsx`

This is the single compound component. It calls `useMeetingActionConfigs` internally, provides everything via context. All sub-components read from context.

- [ ] **Step 1: Create the file**

Create `src/shared/components/entities/meetings/overview-card.tsx`. The complete file is too large to inline here (estimated 550-650 lines). The structure follows the BlogpostCard pattern exactly:

1. **Imports** — type imports first (ReactNode, Meeting, Proposal, EntityActionConfig, SowTradeScope), then value imports (date-fns, lucide, React, shadcn components, shared constants, entity hooks)

2. **Types** section:
   - `MeetingOverviewCardProposal` = `Pick<Proposal, 'id' | 'status' | 'token' | 'createdAt'> & { label?: Proposal['label'], trade?: string | null, value?: number | null, viewCount?: number, sowSummary?: SowTradeScope[] }`
   - `MeetingOverviewCardData` = `Pick<Meeting, 'id'> & Partial<Pick<Meeting, 'scheduledFor' | 'createdAt' | 'meetingType' | 'meetingOutcome' | 'ownerId' | 'customerId'>> & { ownerName?, ownerImage?, customerName?, customerPhone?, customerAddress?, customerCity?, customerState?, customerZip?, proposals? }`
   - `MeetingFieldConfig` discriminated union (outcome, scheduledDate, type, proposalCount)
   - `MeetingOverviewCardContextValue` = `{ meeting, customerId, actions }`

3. **Context** — `createContext`, `useMeetingOverviewCard` hook with `React.use()`

4. **Root** — `MeetingOverviewCardRoot` accepts: `meeting: MeetingOverviewCardData`, `customerId: string`, `className?`, `children`, `onAssignOwner?`, `onAssignProject?`. Calls `useMeetingActionConfigs(customerId, { onAssignOwner, onAssignProject })` internally. Renders `DeleteConfirmDialog` + context provider + `<div>` wrapper.

5. **Layout sub-components** — `Header` (flex row), `Body` (generic container)

6. **Data display sub-components** — `Owner` (with HybridPopoverTooltip), `CustomerName`, `CreatedAt`, `Phone` (wraps PhoneAction), `Address` (wraps AddressAction, accepts children for custom trigger)

7. **Fields sub-component** — config-driven renderer. `OutcomeField` (badge or dot, with optional dropdown), `ScheduledDateField` (static or DateTimePicker), `TypeField` (badge), `ProposalCountField` (icon + count)

8. **Trades sub-component** — aggregates from proposals[].sowSummary, renders badges with popover

9. **Proposals sub-component** — list with render prop, optional `showHeader` prop

10. **Actions sub-component** — reads actions from context, renders EntityActionMenu. NO actions prop.

11. **ContextMenu sub-component** — reads actions from context, renders shadcn ContextMenu. NO actions prop.

12. **Static attachment** — `Object.assign(MeetingOverviewCardRoot, { Header, Body, Owner, ... })`

13. **Type exports** — `export type { MeetingFieldConfig, MeetingOverviewCardData, MeetingOverviewCardProposal }`

- [ ] **Step 2: Verify the component compiles**

```bash
pnpm tsc --noEmit  # Consumer errors still expected
pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/entities/meetings/overview-card.tsx
git commit -m "feat: create MeetingOverviewCard compound component with built-in actions"
```

---

### Task 4: Replace MeetingEntityCard consumers (profile modal)

**Files:**
- Modify: `src/features/customer-pipelines/ui/components/customer-meetings-list.tsx`
- Modify: `src/features/customer-pipelines/ui/components/customer-projects-list.tsx`
- Modify: `src/features/customer-pipelines/ui/components/project-entity-card.tsx`
- Delete: `src/features/customer-pipelines/ui/components/meeting-entity-card.tsx`

All 3 consumer files currently render `MeetingEntityCard`. Replace with `MeetingOverviewCard` composition.

- [ ] **Step 1: Update `customer-meetings-list.tsx`**

Replace `MeetingEntityCard` import and usage. The component receives `customerId` as a prop (already available). Thread it to `MeetingOverviewCard`.

Key change: replace each `<MeetingEntityCard meeting={meeting} .../>` with a `MeetingOverviewCard` composition in a Card wrapper. The composition matches the profile modal layout from the spec.

- [ ] **Step 2: Update `project-entity-card.tsx`**

Add `customerId: string` to Props. Replace `MeetingEntityCard` with same composition.

- [ ] **Step 3: Update `customer-projects-list.tsx`**

Pass `customerId={data.customer.id}` to `ProjectEntityCard`.

Replace unassigned meetings section: use `MeetingOverviewCard` instead of `MeetingEntityCard`.

- [ ] **Step 4: Delete `meeting-entity-card.tsx`**

- [ ] **Step 5: Verify + commit**

```bash
pnpm tsc --noEmit
pnpm lint
git commit -m "refactor: replace MeetingEntityCard with MeetingOverviewCard in profile modal"
```

---

### Task 5: Replace MeetingCalendarCard (calendar today + week views)

**Files:**
- Modify: `src/features/meetings/ui/components/calendar/meeting-calendar.tsx`
- Modify: `src/features/meetings/ui/views/meetings-view.tsx`
- Delete: `src/features/meetings/ui/components/calendar/meeting-calendar-card.tsx`

- [ ] **Step 1: Update `meeting-calendar.tsx`**

Replace `MeetingCalendarCard` import with `MeetingOverviewCard`. Remove `actions` from props — the component no longer receives pre-built actions.

Add `customerId` callback or prop so `MeetingOverviewCard` can receive it. The calendar events have `event.customerId`.

Update `renderCard` to compose `MeetingOverviewCard` with:
- Calendar-specific className (STATUS_BG_TINTS based on outcome)
- Header: outcome dot + customer name + actions (ml-auto)
- Editable scheduled time
- Phone + Address (with custom multi-line trigger)

The `onAssignOwner` callback comes from the parent `meetings-view.tsx`. Pass it as a prop to `MeetingCalendar`.

- [ ] **Step 2: Update `meetings-view.tsx`**

Remove `useMeetingActionConfigs` call for calendar (no longer needed — MeetingOverviewCard creates its own). Keep the call for the table (table doesn't use MeetingOverviewCard).

Pass `onAssignOwner={handleAssignOwner}` and `onUpdateScheduledFor` to `MeetingCalendar`.

- [ ] **Step 3: Delete `meeting-calendar-card.tsx`**

- [ ] **Step 4: Verify + commit**

```bash
pnpm tsc --noEmit
pnpm lint
git commit -m "refactor: replace MeetingCalendarCard with MeetingOverviewCard in calendar views"
```

---

### Task 6: Replace KanbanProjectMeeting (kanban projects pipeline)

**Files:**
- Modify: `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` (KanbanProjectMeeting sub-component, ~lines 310-361)

- [ ] **Step 1: Replace `KanbanProjectMeeting` body**

Replace the inline implementation with `MeetingOverviewCard` composition:
- Pass `customerId={customerId}` (from parent kanban card's `item.id`)
- Header: owner avatar + name, proposal count, actions (ml-auto)
- Proposals with renderProposal

Remove `useMeetingActionConfigs` call from this sub-component.

- [ ] **Step 2: Verify + commit**

```bash
pnpm tsc --noEmit
pnpm lint
git commit -m "refactor: replace KanbanProjectMeeting with MeetingOverviewCard"
```

---

### Task 7: Replace kanban fresh pipeline inline meeting rendering

**Files:**
- Modify: `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` (fresh pipeline meeting section, ~lines 227-300)

This is the section that was never migrated in v1. It renders meeting data inline with `EntityActionMenu`, `RepProfileSnapshot`, and manual badge rendering.

- [ ] **Step 1: Replace the fresh pipeline meeting section**

The fresh pipeline section (lines ~227-300) currently renders:
- Rep avatar/name via `RepProfileSnapshot`
- Meeting actions via separate `EntityActionMenu` with `meetingActions`
- Meeting time badge (scheduled, active, past variants)
- Individual proposal rows via `KanbanProposalRow`

Replace with `MeetingOverviewCard` composition:
- Pass `customerId={item.id}` and `onAssignOwner={handleAssignOwner}`
- Header: owner (from meeting data) + actions
- Meeting time can stay as a custom element inside Body (the time badge rendering is specific to the kanban context)
- Proposals via renderProposal

Remove the `useMeetingActionConfigs` call from the main `CustomerKanbanCard` component (line ~97) since `MeetingOverviewCard` handles it internally.

**Note:** The fresh pipeline meeting section uses `item.nextMeetingId` to construct a minimal meeting entity. The data shape is different from `PipelineItemProjectMeeting`. We need to construct a `MeetingOverviewCardData` from the kanban item's fields: `{ id: item.nextMeetingId, meetingOutcome: ..., ownerId: item.assignedRep?.id, ownerName: item.assignedRep?.name, ownerImage: item.assignedRep?.image }`. Check what fields the kanban `CustomerPipelineItem` type actually provides for its meeting data.

- [ ] **Step 2: Verify + commit**

```bash
pnpm tsc --noEmit
pnpm lint
git commit -m "refactor: replace kanban fresh pipeline inline meeting with MeetingOverviewCard"
```

---

### Task 8: Final cleanup and verification

**Files:**
- Delete remaining old files (if any)
- Grep for stale imports

- [ ] **Step 1: Grep for stale references**

```bash
grep -r "meeting-entity-card\|MeetingEntityCard" src/ --include="*.tsx" --include="*.ts"
grep -r "meeting-calendar-card\|MeetingCalendarCard" src/ --include="*.tsx" --include="*.ts"
grep -r "@/features/meetings/constants/status-colors" src/ --include="*.tsx" --include="*.ts"
grep -r "@/features/meetings/constants/outcome-options" src/ --include="*.tsx" --include="*.ts"
grep -r "@/features/meetings/hooks/use-meeting-action" src/ --include="*.tsx" --include="*.ts"
grep -r "@/features/customer-pipelines/constants/meeting-status-colors" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results. Fix any remaining references.

- [ ] **Step 2: Full verification**

```bash
pnpm tsc --noEmit   # zero errors
pnpm lint            # zero errors
```

- [ ] **Step 3: Commit if any cleanup was needed**

```bash
git commit -m "chore: clean up stale references after MeetingOverviewCard migration"
```

---

## Verification Checklist

After all tasks complete, verify each view context:

1. **Customer profile modal / meetings tab** — cards show fields + actions, "View Meeting" opens profile modal with highlight
2. **Customer profile modal / projects tab** — same meeting card inside project cards
3. **Kanban / projects pipeline** — meeting cards with owner, proposal count, actions pushed right
4. **Kanban / fresh pipeline** — meeting section uses MeetingOverviewCard, same actions as everywhere else
5. **Calendar today view** — cards with outcome dot, customer name, editable time, phone, address
6. **Calendar week view** — same as today view
7. **Actions consistency** — "View Meeting" opens profile modal in ALL contexts. "Assign Owner" only appears where callback provided. Delete always confirms.
