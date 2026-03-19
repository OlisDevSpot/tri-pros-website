# Pipeline: Native Customer Management Design

**Date:** 2026-03-19
**Status:** Approved (v2 — post spec review)
**Scope:** Active pipeline `needs_confirmation` stage, native meeting creation flow, `meetingScopesJSON`, dashboard cleanup, action center relocation.

---

## Context

The app is migrating away from Notion as the source of customer contacts. Customers are now first-class DB citizens. This spec covers the changes needed to reflect that shift in the active pipeline, meeting creation, and dashboard structure. Customer creation itself is handled in a separate feature.

---

## 1. Schema & Data Model

### 1a. `meetingTypes` enum

Replace `['Initial', 'Follow-up']` with `['Fresh', 'Follow-up', 'Rehash']`:

- `src/shared/constants/enums/meetings.ts` — update `meetingTypes` array
- `src/shared/types/enums/meetings.ts` — derived type auto-updates

**Note:** `meetingTypes` is **not** a Postgres pgEnum — `meta.ts` does not need to change. The `situationProfileJSON` Zod schema in `shared/entities/meetings/schemas.ts` references `meetingTypes` via `z.enum(meetingTypes)` and auto-updates. However, any existing rows with `situationProfileJSON.meetingType = 'Initial'` will fail validation after the change. Add `.catch(undefined)` to that field in the entity schema during the transition period to avoid breaking reads of legacy rows.

### 1b. `type` — new native column on `meetings`

Meeting type is now captured at creation time as a required first-class field:

```ts
// src/shared/db/schema/meetings.ts
type: text('type'),  // 'Fresh' | 'Follow-up' | 'Rehash'
```

Added to `insertMeetingSchema` as required (Zod validated against `meetingTypes` const). DB migration: `ALTER TABLE meetings ADD COLUMN type text`.

> The existing `situationProfileJSON.meetingType` field is now redundant. Leave it in place for this iteration — a cleanup pass is out of scope here.

### 1c. `meetingScopesJSON` — new JSONB column on `meetings`

**Entity schema** (`src/shared/entities/meetings/schemas.ts`):

```ts
export const meetingScopeEntrySchema = z.object({
  trade: z.object({ id: z.string(), label: z.string() }),
  scopes: z.array(z.object({ id: z.string(), label: z.string() })),
})
export type MeetingScopeEntry = z.infer<typeof meetingScopeEntrySchema>

export const meetingScopesSchema = z.array(meetingScopeEntrySchema)
export type MeetingScopes = z.infer<typeof meetingScopesSchema>
```

**DB column** (`src/shared/db/schema/meetings.ts`):

```ts
meetingScopesJSON: jsonb('meeting_scopes_json').$type<MeetingScopes>(),
```

- Added to `insertMeetingSchema` as optional
- Added to `selectMeetingSchema` as nullable
- DB migration: `ALTER TABLE meetings ADD COLUMN meeting_scopes_json jsonb`

**Why JSONB over join table:** Meeting scopes are a simple selection list that changes atomically as the meeting progresses. JSONB gives single-round-trip updates, trivial proposal snapshot (copy the value directly), and natural trade-grouping structure. The queryability and referential integrity advantages of a join table do not apply here — scope IDs are Notion text IDs, not DB UUIDs, and cross-meeting scope queries are not needed.

### 1d. `needs_confirmation` pipeline stage

- Added to `meetingPipelineStages` in `src/shared/constants/enums/meetings.ts` as the first entry
- Purely a computed/display stage — never stored independently; it is the fallback of `computeCustomerStage`
- Semantics: customer has no meeting with a valid `scheduledFor` datetime — they are in limbo awaiting confirmation of a meeting time

---

## 2. DAL Prerequisite — `getCustomerPipelineItems` JOIN Fix

**This must be implemented before `needs_confirmation` can appear in the pipeline.**

`src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` currently uses `innerJoin(meetings, ...)`. Customers with no meetings are excluded from results entirely, so `computeCustomerStage` never runs for them and `needs_confirmation` is a ghost stage.

**Required change:** Replace `innerJoin` with `leftJoin`. All meeting aggregate fields already use `?? false` / `?? 0` coercions in the mapping layer (lines 112–118), so null-safety is handled. The `orderBy(desc(max(meetings.createdAt)))` must also be updated to `orderBy(desc(customers.updatedAt))` since `max(meetings.createdAt)` returns null for customers with no meetings.

```ts
// Before:
.innerJoin(meetings, and(eq(meetings.customerId, customers.id), eq(meetings.ownerId, userId)))
.orderBy(desc(max(meetings.createdAt)))

// After:
.leftJoin(meetings, and(eq(meetings.customerId, customers.id), eq(meetings.ownerId, userId)))
.orderBy(desc(customers.updatedAt))
```

With this fix, customers with no meetings appear in results with all aggregate booleans false and `meetingCount = 0`, causing `computeCustomerStage` to return `needs_confirmation` correctly.

---

## 3. Stage Machine

### `meetingPipelineStages` (updated)

```ts
export const meetingPipelineStages = [
  'needs_confirmation',   // new: limbo, no valid scheduled meeting
  'meeting_scheduled',
  'meeting_in_progress',
  'meeting_completed',
  'follow_up_scheduled',
] as const
```

### `computeCustomerStage` (updated)

`meeting_scheduled` becomes an explicit check instead of the default fallback. `needs_confirmation` becomes the true fallback.

```ts
export function computeCustomerStage(data: StageInput): CustomerPipelineStage {
  const { proposalStatuses } = data

  if (proposalStatuses.includes('approved')) return 'approved'
  if (data.hasSentContract) return 'contract_sent'
  if (proposalStatuses.includes('sent')) return 'proposal_sent'
  if (proposalStatuses.length > 0 && proposalStatuses.every(s => s === 'declined')) return 'declined'
  if (data.hasCompletedMeeting && data.hasInProgressMeeting) return 'follow_up_scheduled'
  if (data.hasCompletedMeeting && !data.hasInProgressMeeting) return 'meeting_completed'
  if (data.hasInProgressMeeting && !data.hasScheduledFutureMeeting) return 'meeting_in_progress'
  if (data.hasScheduledFutureMeeting) return 'meeting_scheduled'  // explicit check
  return 'needs_confirmation'                                       // true fallback
}
```

### `activeStageConfig` (updated — `src/features/customer-pipelines/constants/active-pipeline-stages.ts`)

`needs_confirmation` prepended:

```ts
{ key: 'needs_confirmation', label: 'Needs Confirmation', icon: UserCheckIcon, color: 'orange' }
```

### Drag transition updates

```ts
export const ACTIVE_ALLOWED_DRAG_TRANSITIONS: Record<CustomerPipelineStage, readonly CustomerPipelineStage[]> = {
  needs_confirmation: ['meeting_scheduled'],  // intercepted → opens CreateMeetingModal
  meeting_scheduled:  ['meeting_in_progress'],
  meeting_in_progress: ['meeting_completed'],
  meeting_completed:  [],
  follow_up_scheduled: ['meeting_completed'],
  proposal_sent:      ['declined'],
  contract_sent:      [],
  approved:           [],
  declined:           [],
}
```

The drag from `needs_confirmation → meeting_scheduled` is **intercepted** in `CustomerPipelineView.handleMoveItem`. Instead of calling `moveMutation`, it opens `CreateMeetingModal` with the customer pre-filled. If the user cancels, no DB write occurs and the card remains in `needs_confirmation`. On successful meeting creation, the next pipeline refetch places the customer in `meeting_scheduled` via `computeCustomerStage`.

### Stage entry rules for `needs_confirmation`

- **New customers** entering the system land here automatically (no meetings → `computeCustomerStage` returns `needs_confirmation`)
- **Customers moved from rehash/dead pipelines** with no scheduled meeting land here automatically via stage computation — no special handling needed
- **Exit:** only via creating a meeting with a `scheduledFor` datetime (card button or drag-to-modal)

---

## 4. Kanban Card & `CreateMeetingModal`

### Card update (`customer-kanban-card.tsx`)

Cards in the `needs_confirmation` stage receive a full-width `"+ Schedule Meeting"` CTA button below the meta row. Cards in all other stages are unchanged.

```tsx
{item.stage === 'needs_confirmation' && (
  <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); onCreateMeeting(item.id) }}>
    + Schedule Meeting
  </Button>
)}
```

`CustomerKanbanCard` receives a new optional prop: `onCreateMeeting?: (customerId: string) => void`.

### `CreateMeetingModal` (new component)

**Location:** `src/features/meetings/ui/components/create-meeting-modal.tsx`

**Inputs:**
| Field | Component | Required | Notes |
|---|---|---|---|
| Meeting Type | Pill radio | Yes | `Fresh` / `Follow-up` / `Rehash` — maps to `meetings.type` column |
| Date & Time | `DateTimePicker` | No | Optional — if omitted, customer stays in `needs_confirmation` until set |
| Trades & Scopes | `MeetingScopePicker` | No | Optional at creation — can be updated during meeting intake |

**Header:** Customer name + address (available on `CustomerPipelineItem`).

**On submit:** Calls `meetingsRouter.create` with `{ customerId, type, scheduledFor?, meetingScopesJSON? }`. On success, invalidates the pipeline query — if `scheduledFor` was set, the customer moves to `meeting_scheduled` on next fetch; if not, they remain in `needs_confirmation`.

**Entry points:**
1. "Schedule Meeting" button on kanban card → `onCreateMeeting(customerId)` in `CustomerPipelineView`
2. Drag from `needs_confirmation → meeting_scheduled` → intercepted in `handleMoveItem`

Both entry points open the same modal via local `useState` in `CustomerPipelineView`.

### `MeetingScopePicker` (new shared component)

**Location:** `src/features/meetings/ui/components/meeting-scopes-picker.tsx`

**Note:** This component is intentionally feature-scoped to `features/meetings/`. If it is ever needed in another feature it should be moved to `shared/components/`.

Reuses:
- `useGetAllTrades()` from `src/shared/services/notion/dal/trades/hooks/queries/use-get-trades`
- `useGetScopes({ query: tradeId, filterProperty: 'relatedTrade' })` from Notion scopes DAL
- `Select` for trade selection (one per row)
- `MultiSelect` for scope selection per trade

```ts
interface MeetingScopePickerProps {
  value: MeetingScopes
  onChange: (scopes: MeetingScopes) => void
}
```

Renders N rows of `[trade select] [scopes multi-select] [delete]` + `"+ Add trade"` button. No internal save — parent controls persistence.

**Used in:**
1. `CreateMeetingModal` — initial scope selection at meeting creation
2. `MeetingIntakeView` — persistent scopes panel (Section 5)

---

## 5. Meeting Intake: Scopes Panel

`MeetingScopePicker` is embedded as a **persistent header section** in `MeetingIntakeView`, sitting above the step content and below the step progress bar. It is always visible regardless of which intake step the agent is on.

**`MeetingIntakeView` prop change:** Add `onScopeChange: (scopes: MeetingScopes) => void` prop. The parent (`MeetingFlowView`) provides the handler, which calls `updateMeeting({ id: meetingId, meetingScopesJSON: updatedScopes })`. `MeetingIntakeView` passes the current `meeting.meetingScopesJSON ?? []` as the picker's `value`.

**Auto-save:** Each change triggers `onScopeChange` → parent calls `updateMeeting`. Same mutation already wired in `MeetingFlowView`. No separate save button needed.

**Initial value:** Pre-populated from `meeting.meetingScopesJSON` (set at creation time, possibly empty).

---

## 6. Proposal Snapshot

When `proposal.create` is called with a `meetingId`, the procedure:

1. Fetches `meetingScopesJSON` from the meeting
2. Transforms each entry into the proposal's `projectJSON.sow` format:
   ```ts
   meetingScopesJSON.map(entry => ({
     trade: entry.trade,
     scopes: entry.scopes,
     // SOW content fields (contentJSON, html, title, price) left empty — agent fills in
   }))
   ```
3. Sets this as the initial value for `projectJSON.sow`

The proposal then owns its scopes independently — no runtime link back to `meetingScopesJSON` after creation. The proposal form can add, remove, or modify scopes freely.

---

## 7. Dashboard Cleanup

### Removals

| Item | Location | Action |
|---|---|---|
| `CreatePicker` | `DashboardSidebar` | Remove component + import |
| `create-meeting` step | `DashboardHub` | Remove AnimatePresence block |
| `action-center` step | `DashboardHub` | Remove AnimatePresence block |
| `CreateMeetingView` | `features/meetings/ui/views/create-meeting-view.tsx` | Delete file |
| `'action-center'`, `'create-meeting'` | `features/agent-dashboard/constants/dashboard-steps.ts` | Remove from `dashboardSteps` const array |
| `action-center` sidebar item | `features/agent-dashboard/constants/sidebar-items.ts` | Remove entry |

**`dashboard-steps.ts` is a critical file:** removing `'action-center'` and `'create-meeting'` from the const array also removes them from the `DashboardStep` union type (inferred via `typeof dashboardSteps[number]`), which causes TypeScript to flag any stale references elsewhere in the codebase.

### Sidebar result

After cleanup, `dashboardSidebarItems` contains 4 items:

```ts
[
  { step: 'customer-pipelines', icon: GitBranchIcon, label: 'Pipeline',  enabled: true },
  { step: 'meetings',           icon: CalendarIcon,  label: 'Meetings',  enabled: true },
  { step: 'proposals',         icon: FileTextIcon,  label: 'Proposals', enabled: true },
  { step: 'showroom',          icon: ImageIcon,     label: 'Showroom',  enabled: true },
]
```

---

## 8. Action Center Sheet

### `ActionCenterSheet` (new component)

**Location:** `src/features/agent-dashboard/ui/components/action-center-sheet.tsx`

Wraps `ActionCenterView` inside `BaseSheet`. Note: `BaseSheet` uses `close` (not `onClose`) as its prop name:

```tsx
interface Props { isOpen: boolean; onClose: () => void }

export function ActionCenterSheet({ isOpen, onClose }: Props) {
  return (
    <BaseSheet isOpen={isOpen} close={onClose} title="Action Center">
      <ActionCenterView />
    </BaseSheet>
  )
}
```

### Placement in `CustomerPipelineView`

A `ZapIcon` icon button is added to the pipeline view header alongside the existing pipeline select and view toggle:

```
[metrics bar]    [⚡] [pipeline select] [view toggle]
```

Local `useState<boolean>` controls open state — no URL params needed.

### `getActionQueue` DAL update

`orphanMeetings` subquery adds a join to `customers` and uses `COALESCE` for backward compatibility with meetings that still have `contactName` but no `customerId`:

```ts
const orphanMeetings = await db
  .select({
    id: meetings.id,
    customerName: sql<string>`COALESCE(${customers.name}, ${meetings.contactName}, 'Unknown')`.as('customer_name'),
    program: meetings.program,
    createdAt: meetings.createdAt,
  })
  .from(meetings)
  .leftJoin(customers, eq(customers.id, meetings.customerId))
  .where(and(
    eq(meetings.ownerId, userId),
    eq(meetings.status, 'completed'),
  ))
  .orderBy(desc(meetings.createdAt))
```

Tier logic (HOT_NOW, HOT_LEAD, FOLLOW_UP_DUE, STALE, NO_PROPOSAL) is unchanged.

---

## Summary of Changes

| Area | Files touched |
|---|---|
| Enums | `shared/constants/enums/meetings.ts`, `shared/types/enums/meetings.ts` |
| Entity schemas | `shared/entities/meetings/schemas.ts` (MeetingScopes types + `.catch(undefined)` on legacy field) |
| DB schema | `shared/db/schema/meetings.ts` (`type` column + `meetingScopesJSON` column) + 2 migrations |
| DAL — pipeline | `features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (leftJoin + orderBy fix) |
| Stage machine | `features/customer-pipelines/constants/active-pipeline-stages.ts`, `features/customer-pipelines/lib/compute-customer-stage.ts` |
| New components | `features/meetings/ui/components/create-meeting-modal.tsx`, `features/meetings/ui/components/meeting-scopes-picker.tsx`, `features/agent-dashboard/ui/components/action-center-sheet.tsx` |
| Updated components | `features/customer-pipelines/ui/components/customer-kanban-card.tsx`, `features/customer-pipelines/ui/views/customer-pipeline-view.tsx`, `features/meetings/ui/views/meeting-intake-view.tsx` (+ `onScopeChange` prop) |
| tRPC | `trpc/routers/meetings.router.ts` (remove Notion dep, accept `customerId`/`type`/`scheduledFor?`/`meetingScopesJSON?`), `trpc/routers/proposal.router.tsx` (snapshot `meetingScopesJSON` on create) |
| Dashboard | `features/agent-dashboard/ui/views/dashboard-hub.tsx`, `features/agent-dashboard/ui/components/dashboard-sidebar.tsx`, `features/agent-dashboard/constants/sidebar-items.ts`, `features/agent-dashboard/constants/dashboard-steps.ts` |
| DAL — action center | `features/agent-dashboard/dal/server/get-action-queue.ts` |
| Deleted | `features/meetings/ui/views/create-meeting-view.tsx` |

---

## Out of Scope

- Customer creation UI/flow (separate feature)
- Dramatic UX improvements to the scopes picker (future iteration)
- Redesign of action center tier logic
- Cleanup of `situationProfileJSON.meetingType` redundant field
