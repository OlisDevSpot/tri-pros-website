# Pipeline: Native Customer Management Design

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Active pipeline `needs_confirmation` stage, native meeting creation flow, `meetingScopesJSON`, dashboard cleanup, action center relocation.

---

## Context

The app is migrating away from Notion as the source of customer contacts. Customers are now first-class DB citizens. This spec covers the changes needed to reflect that shift in the active pipeline, meeting creation, and dashboard structure. Customer creation itself is handled in a separate feature.

---

## 1. Schema & Data Model

### 1a. `meetingTypes` enum

Replace `['Initial', 'Follow-up']` with `['Fresh', 'Follow-up', 'Rehash']` everywhere:

- `src/shared/constants/enums/meetings.ts` — update `meetingTypes` array
- `src/shared/types/enums/meetings.ts` — derived type updates automatically
- `src/shared/db/schema/meta.ts` — update `meetingTypeEnum` pgEnum values
- DB migration required to update the enum values in Postgres

### 1b. `meetingScopesJSON` — new JSONB column on `meetings`

**Entity schema** (`src/shared/entities/meetings/schemas.ts`):

```ts
// New types added
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

**Why JSONB over join table:** Meeting scopes are a simple selection list that changes atomically as the meeting progresses. JSONB gives single-round-trip updates, trivial proposal snapshot (copy value directly), and natural trade-grouping structure. The queryability and referential integrity advantages of a join table do not apply here — scope IDs are Notion text IDs, not DB UUIDs, and cross-meeting scope queries are not needed.

### 1c. `needs_confirmation` pipeline stage

- Added to `meetingPipelineStages` in `src/shared/constants/enums/meetings.ts` as the first entry
- Purely a computed/display stage — never stored independently; it is the fallback of `computeCustomerStage`
- Semantics: customer has no meeting with a valid `scheduledFor` datetime — they are in limbo awaiting confirmation of a meeting time

---

## 2. Stage Machine

### `meetingPipelineStages` (updated)

```ts
export const meetingPipelineStages = [
  'needs_confirmation',   // ← new: limbo, no valid scheduled meeting
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
  if (data.hasScheduledFutureMeeting) return 'meeting_scheduled'  // ← explicit check
  return 'needs_confirmation'                                       // ← true fallback
}
```

### `activeStageConfig` (updated, `src/features/customer-pipelines/constants/active-pipeline-stages.ts`)

`needs_confirmation` prepended with `UserCheckIcon` and `orange` color:

```ts
{ key: 'needs_confirmation', label: 'Needs Confirmation', icon: UserCheckIcon, color: 'orange' }
```

### Drag transition updates

```ts
export const ACTIVE_ALLOWED_DRAG_TRANSITIONS: Record<CustomerPipelineStage, readonly CustomerPipelineStage[]> = {
  needs_confirmation: ['meeting_scheduled'],  // ← intercepted → opens CreateMeetingModal
  meeting_scheduled: ['meeting_in_progress'],
  // rest unchanged
}
```

The drag from `needs_confirmation → meeting_scheduled` is **intercepted** in `CustomerPipelineView.handleMoveItem` — instead of calling `moveMutation`, it opens `CreateMeetingModal` with the customer pre-filled. If the user cancels, no DB write occurs and the card stays in `needs_confirmation`. On successful meeting creation, the next pipeline refetch places the customer in `meeting_scheduled` via `computeCustomerStage`.

### Stage entry rules for `needs_confirmation`

- **New customers** entering the system land here automatically (no meetings → `computeCustomerStage` returns `needs_confirmation`)
- **Customers moved from rehash/dead pipelines** with no scheduled meeting land here automatically via stage computation — no special handling needed
- **Exit:** only via creating a meeting with a `scheduledFor` datetime (card button or drag-to-modal)

---

## 3. Kanban Card & `CreateMeetingModal`

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
| Field | Component | Notes |
|---|---|---|
| Meeting Type | Pill radio group | `Fresh` / `Follow-up` / `Rehash` — required |
| Date & Time | `DateTimePicker` | Optional — meeting can be confirmed later |
| Trades & Scopes | `MeetingScopePicker` | Optional at creation — sets initial `meetingScopesJSON` |

**Header:** Customer name + address (available on `CustomerPipelineItem`).

**On submit:** Calls `meetingsRouter.create` with `{ customerId, meetingType, scheduledFor?, meetingScopesJSON? }`. On success, invalidates the pipeline query — customer moves to `meeting_scheduled` on next fetch.

**Entry points:**
1. "Schedule Meeting" button on kanban card — `onCreateMeeting(customerId)` in `CustomerPipelineView`
2. Drag from `needs_confirmation → meeting_scheduled` — intercepted in `handleMoveItem`

Both entry points open the same modal component via local `useState` in `CustomerPipelineView`.

### `MeetingScopePicker` (new shared component)

**Location:** `src/features/meetings/ui/components/meeting-scopes-picker.tsx`

Reuses:
- `useGetAllTrades()` from `src/shared/services/notion/dal/trades/hooks/queries/use-get-trades`
- `useGetScopes({ query: tradeId, filterProperty: 'relatedTrade' })` from Notion scopes DAL
- `Select` for trade selection (single per row)
- `MultiSelect` for scope selection per trade

Interface: renders N rows of `[trade select] [scopes multi-select] [delete]` + `"+ Add trade"` button. Accepts `value: MeetingScopes` and `onChange: (scopes: MeetingScopes) => void`. No internal save — parent controls persistence.

**Used in:**
1. `CreateMeetingModal` — initial scope selection
2. `MeetingIntakeView` — persistent scopes panel (Section 4)

---

## 4. Meeting Intake: Scopes Panel

`MeetingScopePicker` is embedded as a **persistent header section** in `MeetingIntakeView`, sitting above the step content and below the step progress bar. It is always visible regardless of which intake step the agent is on.

**Auto-save:** Each change calls `updateMeeting({ id: meetingId, meetingScopesJSON: updatedScopes })` — the same `updateMeeting` mutation already wired in `MeetingFlowView`. No separate save button.

**Initial value:** Pre-populated from `meeting.meetingScopesJSON` (set at creation time, possibly empty).

This satisfies the requirement that scopes can be updated on the fly as the customer rethinks their priorities during the meeting.

---

## 5. Proposal Snapshot

When a proposal is created from a meeting, `proposal.create` receives the `meetingId`. The procedure:

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

## 6. Dashboard Cleanup

### Removals

| Item | Location | Action |
|---|---|---|
| `CreatePicker` | `DashboardSidebar` | Remove component + import |
| `create-meeting` step | `DashboardHub` + `DashboardStep` type | Remove AnimatePresence block + type literal |
| `action-center` sidebar item | `dashboardSidebarItems` | Remove entry |
| `action-center` step | `DashboardHub` + `DashboardStep` type | Remove AnimatePresence block + type literal |
| `CreateMeetingView` | `features/meetings/ui/views/` | Delete file (replaced by `CreateMeetingModal`) |

### Sidebar result

After cleanup, `dashboardSidebarItems` contains 4 items:

```ts
[
  { step: 'customer-pipelines', icon: GitBranchIcon, label: 'Pipeline', enabled: true },
  { step: 'meetings',           icon: CalendarIcon,  label: 'Meetings', enabled: true },
  { step: 'proposals',         icon: FileTextIcon,  label: 'Proposals', enabled: true },
  { step: 'showroom',          icon: ImageIcon,     label: 'Showroom',  enabled: true },
]
```

---

## 7. Action Center Sheet

### `ActionCenterSheet` (new component)

**Location:** `src/features/agent-dashboard/ui/components/action-center-sheet.tsx`

Wraps `ActionCenterView` inside `BaseSheet` (`src/shared/components/dialogs/sheets/base-sheet.tsx`).

```tsx
interface Props { isOpen: boolean; onClose: () => void }

export function ActionCenterSheet({ isOpen, onClose }: Props) {
  return (
    <BaseSheet isOpen={isOpen} onClose={onClose} title="Action Center">
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

`orphanMeetings` subquery adds a join to the `customers` table to pull `customers.name` instead of `meetings.contactName`:

```ts
const orphanMeetings = await db
  .select({
    id: meetings.id,
    customerName: sql<string>`COALESCE(${customers.name}, ${meetings.contactName}, 'Unknown')`,
    // ...
  })
  .from(meetings)
  .leftJoin(customers, eq(customers.id, meetings.customerId))
  .where(...)
```

`COALESCE` keeps backward compatibility with any meetings that still have `contactName` but no `customerId`. Tier logic (HOT_NOW, HOT_LEAD, FOLLOW_UP_DUE, STALE, NO_PROPOSAL) is unchanged.

---

## Summary of Changes

| Area | Files touched |
|---|---|
| Enums | `shared/constants/enums/meetings.ts`, `shared/types/enums/meetings.ts`, `shared/db/schema/meta.ts` |
| Schema | `shared/db/schema/meetings.ts`, `shared/entities/meetings/schemas.ts` + migration |
| Stage machine | `features/customer-pipelines/constants/active-pipeline-stages.ts`, `features/customer-pipelines/lib/compute-customer-stage.ts` |
| New components | `features/meetings/ui/components/create-meeting-modal.tsx`, `features/meetings/ui/components/meeting-scopes-picker.tsx`, `features/agent-dashboard/ui/components/action-center-sheet.tsx` |
| Updated components | `features/customer-pipelines/ui/components/customer-kanban-card.tsx`, `features/customer-pipelines/ui/views/customer-pipeline-view.tsx`, `features/meetings/ui/views/meeting-intake-view.tsx` |
| tRPC | `trpc/routers/meetings.router.ts` (remove Notion dep, add `customerId`/`meetingType`/`meetingScopesJSON`), `trpc/routers/proposal.router.tsx` (snapshot on create) |
| Dashboard | `features/agent-dashboard/ui/views/dashboard-hub.tsx`, `features/agent-dashboard/ui/components/dashboard-sidebar.tsx`, `features/agent-dashboard/constants/sidebar-items.ts` |
| Deleted | `features/meetings/ui/views/create-meeting-view.tsx` |
| DAL | `features/agent-dashboard/dal/server/get-action-queue.ts` |

---

## Out of Scope

- Customer creation UI/flow (separate feature)
- Dramatic UX improvements to the scopes picker (future iteration)
- Redesign of action center tier logic
