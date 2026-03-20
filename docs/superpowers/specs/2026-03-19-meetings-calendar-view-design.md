# Meetings Calendar View — Design Spec

**Date:** 2026-03-19
**Branch:** `migrating-notion`
**Status:** Draft

---

## Overview

Add a calendar view as a new data display mode alongside kanban and table. The calendar is the default view for the meetings dashboard step, allowing reps to visually scan past, present, and future meetings on a week or month grid. Each meeting renders as a rich, actionable card with contact info, status, and program badges.

**Library:** Jeraidi Full Calendar, installed via shadcn registry as owned source code.

---

## Scope

### In Scope

- Shared `CalendarBoard` component (parallel to `KanbanBoard` and `DataTable`)
- Shared `StatBar` component (replaces feature-specific stat bars with a configurable shared one)
- Shared `ContactActions` components (extracted from `customer-profile-header.tsx`)
- `'calendar'` added to `DataViewType` union; toggle made configurable (accepts subset of views)
- New `MeetingsView` with `DataViewTypeToggle` (calendar default | table)
- Meeting calendar cards: rich week view card + compact month view dot with popover
- Today indicator, status color coding, program accent badges, stat bar
- Week view defaults to Sun–Fri with toggleable Saturday filter
- `scheduledFor` becomes required (`.notNull()`) in meetings schema
- `getAll` query extended with customer contact fields
- CASL permission checks on all calendar card actions
- Refactor `CustomerPipelineMetricsBar` to use shared `StatBar`

### Out of Scope

- Drag-to-reschedule (agents cannot reschedule, only create new meetings)
- Create meeting from calendar (click empty time slot)
- Quick-view hover popover on week cards
- Day, year, and agenda views
- Multi-agent calendar view (future: one-line conditional when super-admin scope is needed)

---

## Component Architecture

### Shared Layer

```
src/shared/components/
  calendar/
    ui/
      calendar-board.tsx              Main orchestrator (wraps Jeraidi, month + week only)
      calendar-header.tsx             View toggle, today button, date nav, Saturday filter
      calendar-week-view.tsx          Sun–Fri grid (Saturday toggleable)
      calendar-month-view.tsx         Standard 7-column month grid
      calendar-time-indicator.tsx     Red "now" line in week view (updates every minute)
    types.ts                          CalendarEvent, CalendarViewType, CalendarConfig

  stat-bar/
    ui/
      stat-bar.tsx                    Renders row of StatBarItem cards (responsive: 2-col mobile, N-col desktop)
      stat-bar-item.tsx               Single stat card (icon, label, value, optional color)
    types.ts                          StatBarItemConfig, StatBarProps

  contact-actions/
    ui/
      address-action.tsx              DropdownMenu: Google Maps / Google Earth / Copy
      phone-action.tsx                tel: link + copy button with toast

  data-view-type-toggle.tsx           EDIT: add 'calendar' to DataViewType + CalendarDaysIcon + availableViews prop
```

**Note:** `calendar/` has no `constants/` directory. Add one when constants are actually needed.

### Feature Layer

```
src/features/meetings/
  ui/
    components/
      calendar/
        meeting-calendar.tsx          Wrapper: passes renderCard, renderCompact, config to CalendarBoard
        meeting-calendar-card.tsx     Week view rich card
        meeting-calendar-dot.tsx      Month view compact dot + popover
    views/
      meetings-view.tsx               NEW: dashboard step (toggle + stat bar + calendar/table)
  lib/
    to-calendar-event.ts              toCalendarEvent(MeetingRow) → MeetingCalendarEvent mapping
  constants/
    meetings-stat-config.ts           Stat bar config for meetings
  types/
    index.ts                          EDIT: add MeetingCalendarEvent type
```

**Import note:** `calendar/` components are imported directly (e.g., `from '@/features/meetings/ui/components/calendar/meeting-calendar'`). No barrel file.

### Edited Existing Files

```
src/shared/components/data-view-type-toggle.tsx         Add 'calendar' to union + icon + availableViews prop
src/shared/db/schema/meetings.ts                        scheduledFor → .notNull()
src/trpc/routers/meetings.router.ts                     getAll → add customer contact fields
src/features/customer-pipelines/                        Refactor metrics bar → shared StatBar
src/features/customer-pipelines/constants/
  pipeline-stat-config.ts                               NEW: StatBarItemConfig<CustomerPipelineItem>[] extracted from metrics bar
src/features/customer-pipelines/ui/components/
  customer-profile-header.tsx                           Extract contact actions → import from shared
src/features/agent-dashboard/ui/views/
  dashboard-hub.tsx                                     Swap PastMeetingsView → MeetingsView
src/features/meetings/ui/views/index.ts                 Add MeetingsView export, remove PastMeetingsView export
src/shared/lib/clipboard.ts                             NEW: extract copyToClipboard helper
```

---

## Type Contracts

### CalendarEvent (shared — `src/shared/components/calendar/types.ts`)

```typescript
export interface CalendarEvent {
  id: string
  startAt: string       // ISO timestamp (required)
  endAt?: string        // ISO timestamp (optional — point-in-time if absent)
  title: string         // Primary display text
}
```

### CalendarViewType

```typescript
export type CalendarViewType = 'week' | 'month'
```

### CalendarConfig

```typescript
export interface CalendarConfig {
  defaultView?: CalendarViewType       // defaults to 'week'
  hiddenDays?: number[]                // e.g. [6] to hide Saturday (0=Sun, 6=Sat)
  weekStartsOn?: 0 | 1                // 0=Sunday (default)
}
```

### CalendarBoardProps

```typescript
export interface CalendarBoardProps<T extends CalendarEvent> {
  events: T[]
  config?: CalendarConfig
  renderCard: (event: T) => React.ReactNode       // week view full card
  renderCompact: (event: T) => React.ReactNode     // month view compact dot
  onEventClick?: (event: T) => void
  onDateRangeChange?: (range: { from: Date; to: Date }) => void  // notifies parent of visible range
  className?: string
}
```

The `onDateRangeChange` callback fires when the user navigates between weeks/months. This allows `MeetingsView` to filter stat bar counts to the currently visible date range.

### MeetingCalendarEvent (feature — `src/features/meetings/types/index.ts`)

```typescript
export interface MeetingCalendarEvent extends CalendarEvent {
  meetingId: string
  status: MeetingStatus
  program: string | null
  contactName: string | null
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  createdAt: string
}
```

Extends `CalendarEvent` with all fields the card renderers need. The `toCalendarEvent` mapper in `lib/` constructs this from a `MeetingRow`.

### StatBar Types (shared — `src/shared/components/stat-bar/types.ts`)

```typescript
export interface StatBarItemConfig<T> {
  key: string
  label: string
  icon: LucideIcon
  color?: string
  getValue: (data: T[]) => number
}

export interface StatBarProps<T> {
  items: StatBarItemConfig<T>[]
  data: T[]
  className?: string
}
```

Generic `<T>` preserves type safety. Each feature passes its own concrete type:
- Pipelines: `StatBar<CustomerPipelineItem>`
- Meetings: `StatBar<MeetingRow>`

The `StatBar` component handles responsive layout: `grid-cols-2` on mobile, `grid-cols-N` (where N = items.length) on desktop, using the existing `StatCard` CSS pattern from customer pipelines.

### ContactAction Props (shared — `src/shared/components/contact-actions/`)

```typescript
export interface AddressActionProps {
  address: string
  className?: string
  compact?: boolean       // true = icon only, false = icon + text (default)
}

export interface PhoneActionProps {
  phone: string
  className?: string
  compact?: boolean       // true = icon only, false = icon + formatted number (default)
}
```

### DataViewType (updated — `src/shared/components/data-view-type-toggle.tsx`)

```typescript
// Before
type DataViewType = 'kanban' | 'table'

// After
type DataViewType = 'kanban' | 'table' | 'calendar'
```

The `DataViewTypeToggle` component gains an `availableViews` prop:

```typescript
interface DataViewTypeToggleProps {
  value: DataViewType
  onChange: (value: DataViewType) => void
  availableViews?: DataViewType[]    // defaults to ['kanban', 'table'] for backward compat
  className?: string
}
```

Each feature passes only the views it supports:
- Pipelines: `availableViews={['kanban', 'table']}` (default, no change)
- Meetings: `availableViews={['calendar', 'table']}`

---

## Data Flow

### Single Data Source

`MeetingsView` fetches via `useQuery(trpc.meetingsRouter.getAll.queryOptions())`. The same `MeetingRow[]` feeds both calendar and table. No new tRPC procedures.

### getAll Query Extension

Currently returns:

```typescript
{ ...getTableColumns(meetings), customerName: customers.name }
```

Extended to include:

```typescript
{
  ...getTableColumns(meetings),
  customerName: customers.name,
  customerPhone: customers.phone,
  customerAddress: customers.address,
  customerCity: customers.city,
  customerState: customers.state,
  customerZip: customers.zip,
}
```

Backward-compatible additive change. `MeetingRow` inferred type automatically widens.

**Note on `contactName`:** Already included via `getTableColumns(meetings)` since it's a column on the meetings table. Used as the display name primary, with `customerName` as fallback.

**Ordering:** Stays as `desc(meetings.createdAt)`. The calendar library positions events by `startAt` regardless of array order, so no reordering needed. The table continues to display newest-first.

### Meetings → CalendarEvent Mapping

Lives in `src/features/meetings/lib/to-calendar-event.ts`:

```typescript
export function toCalendarEvent(meeting: MeetingRow): MeetingCalendarEvent {
  return {
    id: meeting.id,
    meetingId: meeting.id,
    startAt: meeting.scheduledFor,
    title: meeting.contactName ?? meeting.customerName ?? 'Unknown',
    status: meeting.status,
    program: meeting.program,
    contactName: meeting.contactName,
    customerName: meeting.customerName,
    customerPhone: meeting.customerPhone,
    customerAddress: meeting.customerAddress,
    customerCity: meeting.customerCity,
    customerState: meeting.customerState,
    customerZip: meeting.customerZip,
    createdAt: meeting.createdAt,
  }
}
```

### Calendar Date State

`CalendarBoard` owns the internal `currentDate` and `activeView` state. It exposes the currently visible date range to the parent via `onDateRangeChange`. This allows `MeetingsView` to:
1. Filter stat bar counts to the visible range (calendar mode)
2. Show full dataset stats when in table mode

Both the Saturday toggle and current date navigation are ephemeral component state inside `CalendarBoard` — they reset on unmount (navigating away from Meetings step and back). This matches the existing behavior of kanban column filters and table sort state.

---

## Schema Change

### meetings.scheduledFor → required

```typescript
// Before
scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),

// After
scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }).notNull(),
```

No migration needed — all existing rows already have `scheduledFor` populated. Run `pnpm db:push` to apply the constraint.

**Downstream impact:**
- `insertMeetingSchema` will require `scheduledFor` (was optional)
- `CreateMeetingView` already collects this via `DateTimePicker` — verify validation enforces it

---

## Calendar Views

### Week View (Default)

- **Columns:** Sun, Mon, Tue, Wed, Thu, Fri (Saturday hidden by default)
- **Saturday toggle:** Filter button in calendar header, styled like `KanbanColumnFilter` — small filter icon that opens a checkbox for "Show Saturday". Ephemeral component state (resets on unmount).
- **Time grid:** Vertical time slots (hour increments)
- **Today indicator:** Highlighted column header + red horizontal "now" line (`calendar-time-indicator.tsx`) that updates every minute via `setInterval`
- **Events:** Rendered via `renderCard` prop — full `MeetingCalendarCard`
- **Click event card:** Navigates to meeting intake form
- **"..." menu on card:** Edit setup, start flow, duplicate, delete (permission-gated)

### Month View

- **Grid:** Standard 7-column grid (always shows all days including Saturday)
- **Events:** Rendered via `renderCompact` prop — `MeetingCalendarDot`
- **Overflow:** When a day has too many meetings, show "+N more" with popover listing all
- **Click dot:** Opens popover anchored to dot with meeting detail + action buttons
- **Popover contents:** Customer name, time, status badge, program badge, phone action, address action, action buttons (view meeting, edit, start, duplicate, delete — permission-gated)

### Calendar Header

- **Left:** ← → date navigation arrows + date range label
  - Week: "Mar 15 – 21, 2026"
  - Month: "March 2026"
- **Center/Right:** "Today" button (snaps to current week/month)
- **Right:** Week/Month toggle + Saturday filter button (week view only)

---

## Meeting Calendar Cards

### Week View Card (`meeting-calendar-card.tsx`)

```
┌─────────────────────────────────┐
│ ● in_progress  TPR Monthly Spc  │  status dot (colored) + program badge (accent)
│ John Smith                      │  customer name (font-medium, truncated)
│ 📞 (555) 123-4567        ⋮     │  PhoneAction (shared) + "..." menu
│ 📍 123 Main St, Anaheim        │  AddressAction (shared, dropdown)
└─────────────────────────────────┘
```

- **Status dot:** Colored circle derived from `MEETING_STATUS_COLORS` (in `src/features/meetings/constants/status-colors.ts`) — sky (in_progress), emerald (completed), violet (converted). The dot uses solid fill variants of these colors (e.g., `bg-sky-500` for the dot vs the existing `bg-sky-500/15` badge style).
- **Program badge:** Pill using `program-accent-map.ts` (in `src/features/meetings/constants/program-accent-map.ts`) — amber (TPR Monthly Special), sky (Energy Savings), violet (Senior Citizen). Only shown if program set.
- **Customer name:** Primary text, `font-medium`, truncated with tooltip on overflow
- **Phone:** `PhoneAction` shared component (from `@/shared/components/contact-actions/ui/phone-action`) — `tel:` link + copy button with toast
- **Address:** `AddressAction` shared component (from `@/shared/components/contact-actions/ui/address-action`) — dropdown trigger with Google Maps / Google Earth / Copy. Shows `address, city` truncated.
- **"..." menu:** Edit setup, start flow, duplicate, delete (super-admin). Same actions as table row.
- **Click card body:** Navigates to meeting intake form
- **Background:** Subtle tint based on status color (10% opacity fill)

### Month View Dot (`meeting-calendar-dot.tsx`)

```
● 10:00 AM  John Smith
```

- Status-colored dot + time + name. Single line.
- Click → opens popover (not navigation).
- Multiple meetings per day stack vertically. Overflow: "+N more" popover.

### Month View Popover (on dot click)

Anchored to the clicked dot. Contains:
- Customer name (bold)
- Time + date
- Status badge (colored)
- Program badge (accent)
- `PhoneAction` (shared)
- `AddressAction` (shared)
- Action buttons: View Meeting, Edit Setup, Start Flow, Duplicate, Delete
- All actions permission-gated via `useAbility()` (from `@/shared/permissions/hooks`)

---

## MeetingsView — Loading, Error, Empty States

`MeetingsView` handles the same three states as the current `PastMeetingsView` before rendering content:

- **Loading:** `<LoadingState title="Loading Meetings" description="This might take a few seconds" />`
- **Error:** `<ErrorState title="Error: Could not load meetings" description="Please try again" />`
- **Empty:** `<EmptyState title="No Meetings Found" description="Create a new meeting to get started" />`

These render before the stat bar and toggle, matching the existing pattern.

---

## Stat Bar

### Shared `StatBar<T>` Component

Mirrors the `StatCard` CSS and layout from customer pipelines. Generic `<T>` for type safety. Responsive: `grid-cols-2` on mobile, `grid-cols-N` on desktop.

**Meetings config** (`meetings-stat-config.ts`):
- **Total meetings** — count for currently visible date range (calendar) or full dataset (table)
- **In Progress** — count with amber accent
- **Completed** — count with green accent
- **Converted** — count with blue accent

**Pipeline config** (refactored from `CustomerPipelineMetricsBar`):
- Same visual output, now uses shared `StatBar<CustomerPipelineItem>` with pipeline-specific config array

Each feature provides a `StatBarItemConfig<T>[]` — the shared component renders them uniformly.

---

## CASL Permission Integration

### Server-Side (No Changes Needed)

- `getAll` runs through `agentProcedure` → already gates behind `can('access', 'Dashboard')`
- Ownership filtering at DAL layer: `eq(meetings.ownerId, ctx.session.user.id)`

### Client-Side — Calendar Card Actions

All card actions use `useAbility()` hook (from `@/shared/permissions/hooks`):

| Action | Permission Check | Roles |
|--------|-----------------|-------|
| View meeting (navigate) | `ability.can('read', 'Meeting')` | agent, super-admin |
| Edit setup | `ability.can('update', 'Meeting')` | agent, super-admin |
| Start flow | `ability.can('update', 'Meeting')` | agent, super-admin |
| Duplicate | `ability.can('create', 'Meeting')` | agent, super-admin |
| Delete | `ability.can('delete', 'Meeting')` | super-admin only |
| Status dropdown | `ability.can('update', 'Meeting')` | agent, super-admin |

### Month View Popover Actions

Same permission checks as week view card "..." menu. The popover action buttons are conditionally rendered based on `useAbility()`.

### Future Multi-Agent Scope

When super-admins need to see all agents' meetings, the change is a one-line conditional in the `getAll` router:

```typescript
const whereClause = ctx.ability.can('manage', 'Meeting')
  ? undefined                                    // super-admin sees all
  : eq(meetings.ownerId, ctx.session.user.id)    // agent sees own
```

No architectural changes needed.

---

## Contact Actions Extraction

### Current State

Address dropdown and phone link + copy are inline in `customer-profile-header.tsx` with a component-scoped `copyToClipboard` function.

### Target State

```
src/shared/components/contact-actions/
  ui/
    address-action.tsx     DropdownMenu: Google Maps / Google Earth / Copy
    phone-action.tsx       tel: link + copy button with toast

src/shared/lib/clipboard.ts
  copyToClipboard(text: string, label: string)    Uses navigator.clipboard + sonner toast
```

### Refactor Path

1. Extract `copyToClipboard` to `src/shared/lib/clipboard.ts`
2. Create `AddressAction` and `PhoneAction` in `src/shared/components/contact-actions/ui/`
3. Refactor `customer-profile-header.tsx` to import from shared — zero visual change
4. `meeting-calendar-card.tsx` and `meeting-calendar-dot.tsx` (popover) import the same shared components

Both components accept a `compact` prop for dense rendering (icon only vs icon + text).

No barrel files in `contact-actions/`. Direct imports only.

---

## Dashboard Integration

### DashboardHub Change

```typescript
// Line 69 — Before
{step === 'meetings' && <PastMeetingsView key="meetings" />}

// After
{step === 'meetings' && <MeetingsView key="meetings" />}
```

Import updated from `@/features/meetings/ui/views`.

### MeetingsDashboard (Standalone Route)

`src/features/meetings/ui/views/meetings-dashboard.tsx` is a separate standalone dashboard that also renders `PastMeetingsView` directly (via `step === 'past-meetings'`). This file is **out of scope** for this iteration — the calendar view is introduced through the agent `DashboardHub` only. The standalone `MeetingsDashboard` continues to import `PastMeetingsView` directly (not via the public entrypoint), so removing the entrypoint export does not break it. A future iteration can add the calendar toggle to this route if needed.

### Public Entrypoint Update

`src/features/meetings/ui/views/index.ts`:
- **Add** `MeetingsView` export
- **Remove** `PastMeetingsView` export (becomes internal to `MeetingsView`, no longer consumed externally)

### PastMeetingsView

Remains as a component file but is no longer exported from the views entrypoint. It's used internally by `MeetingsView` as the table sub-view (same pattern as `CustomerPipelineTable` inside `CustomerPipelineView`). The existing `PastMeetingsTable` sub-component inside it continues to work unchanged.

---

## Dependencies

### New (via shadcn registry)

```bash
npx shadcn@latest add "https://calendar.jeraidi.dev/r/full-calendar.json"
```

Installs as source files into the codebase. We strip to month + week views and customize.

### Existing (no new npm packages)

- `@casl/ability` — already installed
- `lucide-react` — CalendarDaysIcon for toggle
- `sonner` — toast for copy actions
- shadcn/ui primitives — DropdownMenu, Popover, Button, Badge, ToggleGroup
- `date-fns` — date formatting
- `motion/react` — animations (existing pattern)
