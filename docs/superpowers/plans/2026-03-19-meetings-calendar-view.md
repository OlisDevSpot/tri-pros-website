# Meetings Calendar View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a calendar view as the default display for the meetings dashboard step, with rich meeting cards, contact actions, and a shared stat bar component.

**Architecture:** Jeraidi Full Calendar installed via shadcn registry as owned source. Shared `CalendarBoard` component parallel to existing `KanbanBoard`/`DataTable`. Feature-specific card renderers in `meetings/ui/components/calendar/`. Shared `StatBar<T>` replaces per-feature metrics bars. Shared `ContactActions` extracted from customer profile header.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind v4, shadcn/ui, tRPC, TanStack React Query, CASL, date-fns, Drizzle ORM, Jeraidi Full Calendar (shadcn registry)

**Spec:** `docs/superpowers/specs/2026-03-19-meetings-calendar-view-design.md`

**Conventions:** Read `memory/coding-conventions.md` before writing any code. Key rules: one component per file, named exports only, no constants in component files, no barrel files in ui/components, helpers go in `lib/`.

---

## Task 1: Schema Change — Make `scheduledFor` Required

**Files:**
- Modify: `src/shared/db/schema/meetings.ts:24`

- [ ] **Step 1: Update the schema column**

In `src/shared/db/schema/meetings.ts`, change line 24:

```typescript
// Before
scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),

// After
scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }).notNull(),
```

- [ ] **Step 2: Push schema to database**

Run: `pnpm db:push`
Expected: Success. All existing rows already have `scheduledFor` populated.

- [ ] **Step 3: Verify downstream types**

Run: `pnpm tsc --noEmit`
Expected: May produce errors in `CreateMeetingView` or tests where `scheduledFor` was previously optional. Fix any type errors by ensuring `scheduledFor` is always provided in create/update calls.

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/schema/meetings.ts
git commit -m "feat(schema): make meetings.scheduledFor required"
```

---

## Task 2: Extend `getAll` Query with Customer Contact Fields

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts:14-25`

- [ ] **Step 1: Extend the select in getAll**

In `src/trpc/routers/meetings.router.ts`, update the `getAll` procedure's `.select()`:

```typescript
getAll: agentProcedure
  .query(async ({ ctx }) => {
    return db
      .select({
        ...getTableColumns(meetings),
        customerName: customers.name,
        customerPhone: customers.phone,
        customerAddress: customers.address,
        customerCity: customers.city,
        customerState: customers.state,
        customerZip: customers.zip,
      })
      .from(meetings)
      .leftJoin(customers, eq(customers.id, meetings.customerId))
      .where(eq(meetings.ownerId, ctx.session.user.id))
      .orderBy(desc(meetings.createdAt))
  }),
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: PASS. This is an additive change — existing consumers of `MeetingRow` are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/meetings.router.ts
git commit -m "feat(meetings): extend getAll with customer contact fields"
```

---

## Task 3: Extract Shared `copyToClipboard` Utility

**Files:**
- Create: `src/shared/lib/clipboard.ts`
- Modify: `src/features/customer-pipelines/ui/components/customer-profile-header.tsx`

- [ ] **Step 1: Create the shared utility**

Create `src/shared/lib/clipboard.ts`:

```typescript
import { toast } from 'sonner'

export function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Failed to copy ${label.toLowerCase()}`),
  )
}
```

- [ ] **Step 2: Update customer-profile-header to use shared utility**

In `src/features/customer-pipelines/ui/components/customer-profile-header.tsx`:

1. Add import: `import { copyToClipboard } from '@/shared/lib/clipboard'`
2. Remove the local `copyToClipboard` function (lines 23-26 inside the component)

- [ ] **Step 3: Verify no visual change**

Run: `pnpm build`
Expected: PASS. Same behavior, shared source.

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/clipboard.ts src/features/customer-pipelines/ui/components/customer-profile-header.tsx
git commit -m "refactor: extract copyToClipboard to shared utility"
```

---

## Task 4: Create Shared Contact Action Components

**Files:**
- Create: `src/shared/components/contact-actions/ui/phone-action.tsx`
- Create: `src/shared/components/contact-actions/ui/address-action.tsx`
- Modify: `src/features/customer-pipelines/ui/components/customer-profile-header.tsx`

- [ ] **Step 1: Create `PhoneAction`**

Create `src/shared/components/contact-actions/ui/phone-action.tsx`:

```typescript
'use client'

import { CopyIcon, PhoneIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { formatAsPhoneNumber } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface PhoneActionProps {
  phone: string
  className?: string
  compact?: boolean
}

export function PhoneAction({ phone, className, compact = false }: PhoneActionProps) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <PhoneIcon size={14} className="shrink-0" />
      {!compact && (
        <a
          href={`tel:${phone}`}
          className="hover:text-foreground transition-colors truncate"
        >
          {formatAsPhoneNumber(phone)}
        </a>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          copyToClipboard(phone, 'Phone')
        }}
      >
        <CopyIcon size={11} />
      </Button>
    </span>
  )
}
```

- [ ] **Step 2: Create `AddressAction`**

Create `src/shared/components/contact-actions/ui/address-action.tsx`:

```typescript
'use client'

import { CopyIcon, ExternalLinkIcon, GlobeIcon, MapPinIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { cn } from '@/shared/lib/utils'

interface AddressActionProps {
  address: string
  className?: string
  compact?: boolean
}

export function AddressAction({ address, className, compact = false }: AddressActionProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MapPinIcon size={14} className="shrink-0" />
          {!compact && <span className="truncate">{address}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank')}
        >
          <ExternalLinkIcon size={14} />
          Open in Google Maps
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(`https://earth.google.com/web/search/${encodeURIComponent(address)}`, '_blank')}
        >
          <GlobeIcon size={14} />
          Open in Google Earth
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copyToClipboard(address, 'Address')}>
          <CopyIcon size={14} />
          Copy Address
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 3: Refactor `customer-profile-header.tsx` to use shared components**

Replace the inline phone, email, and address rendering in `src/features/customer-pipelines/ui/components/customer-profile-header.tsx` with imports from the shared components. The email action stays inline (it's only used here). Phone and address use the new shared components.

Import additions:
```typescript
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
```

Replace the phone `<span>` block (lines 34-51) with:
```tsx
{customer.phone && <PhoneAction phone={customer.phone} />}
```

Replace the address `<DropdownMenu>` block (lines 74-105) with:
```tsx
{address && <AddressAction address={address} />}
```

Keep the email block as-is (not extracted — only used in this component).

- [ ] **Step 4: Verify no visual regression**

Run: `pnpm build`
Expected: PASS. Customer profile header looks identical.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/contact-actions/ui/phone-action.tsx src/shared/components/contact-actions/ui/address-action.tsx src/features/customer-pipelines/ui/components/customer-profile-header.tsx
git commit -m "refactor: extract phone and address actions to shared components"
```

---

## Task 5: Create Shared `StatBar` Component

**Files:**
- Create: `src/shared/components/stat-bar/types.ts`
- Create: `src/shared/components/stat-bar/ui/stat-bar-item.tsx`
- Create: `src/shared/components/stat-bar/ui/stat-bar.tsx`

- [ ] **Step 1: Create types**

Create `src/shared/components/stat-bar/types.ts`:

```typescript
import type { LucideIcon } from 'lucide-react'

export interface StatBarItemConfig<T> {
  key: string
  label: string
  icon: LucideIcon
  color?: string
  getValue: (data: T[]) => number
  renderValue?: (value: number) => string   // e.g. (v) => `$${v.toLocaleString()}` or (v) => `${v}%`
}

export interface StatBarProps<T> {
  items: StatBarItemConfig<T>[]
  data: T[]
  className?: string
}
```

- [ ] **Step 2: Create `StatBarItem`**

Create `src/shared/components/stat-bar/ui/stat-bar-item.tsx`:

```typescript
import type { LucideIcon } from 'lucide-react'

import { Card } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface Props {
  icon: LucideIcon
  label: string
  value: number
  displayValue?: string   // pre-formatted display (e.g., "$150,000" or "33%")
  color?: string
}

export function StatBarItem({ icon: Icon, label, value, displayValue, color }: Props) {
  return (
    <>
      {/* Mobile */}
      <div className="flex items-center gap-2 rounded-lg border border-border/50 px-2 py-2 lg:hidden">
        <Icon size={14} className={cn('shrink-0 text-muted-foreground', color)} />
        <span className="text-sm font-semibold tabular-nums">{displayValue ?? value}</span>
        <span className="text-[10px] text-muted-foreground truncate">{label}</span>
      </div>

      {/* Desktop */}
      <Card className="hidden lg:flex items-center gap-3 px-4 py-3">
        <Icon size={16} className={cn('shrink-0 text-muted-foreground', color)} />
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums leading-tight">{displayValue ?? value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </Card>
    </>
  )
}
```

- [ ] **Step 3: Create `StatBar`**

Create `src/shared/components/stat-bar/ui/stat-bar.tsx`:

```typescript
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { SpinnerLoader } from '@/shared/components/loaders/spinner-loader'
import { cn } from '@/shared/lib/utils'

import { StatBarItem } from './stat-bar-item'

const LG_COLS_MAP: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

interface StatBarProps<T> {
  items: StatBarItemConfig<T>[]
  data: T[]
  isLoading?: boolean
  className?: string
}

export function StatBar<T>({ items, data, isLoading, className }: StatBarProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center h-12', className)}>
        <SpinnerLoader />
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-2 gap-1.5 lg:gap-3', LG_COLS_MAP[items.length] ?? 'lg:grid-cols-4', className)}>
      {items.map((item) => {
        const value = item.getValue(data)
        return (
          <StatBarItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            value={value}
            displayValue={item.renderValue?.(value)}
            color={item.color}
          />
        )
      })}
    </div>
  )
}
```

Note: `LG_COLS_MAP` is a Tailwind-safe lookup — Tailwind needs full class names at build time, so dynamic `grid-cols-${n}` won't work. The map covers 2–6 columns which is sufficient for all current and planned stat bar configs.

- [ ] **Step 4: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/stat-bar/
git commit -m "feat: add shared StatBar component"
```

---

## Task 6: Refactor `CustomerPipelineMetricsBar` to Use Shared `StatBar`

**Files:**
- Create: `src/features/customer-pipelines/constants/pipeline-stat-config.ts`
- Modify: `src/features/customer-pipelines/ui/components/customer-pipeline-metrics-bar.tsx`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx:149`

- [ ] **Step 1: Create pipeline stat config**

Create `src/features/customer-pipelines/constants/pipeline-stat-config.ts`:

```typescript
import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { CalendarIcon, DollarSignIcon, PercentIcon, UsersIcon } from 'lucide-react'

export const pipelineStatConfig: StatBarItemConfig<CustomerPipelineItem>[] = [
  {
    key: 'total',
    label: 'Total Customers',
    icon: UsersIcon,
    getValue: (data) => data.length,
  },
  {
    key: 'value',
    label: 'Active Pipeline Value',
    icon: DollarSignIcon,
    getValue: (data) => data
      .filter(item => item.stage !== 'declined' && item.stage !== 'approved')
      .reduce((sum, item) => sum + item.totalPipelineValue, 0),
    renderValue: (v) => `$${v.toLocaleString()}`,
  },
  {
    key: 'conversion',
    label: 'Conversion Rate',
    icon: PercentIcon,
    getValue: (data) => {
      const eligible = data.filter(item =>
        ['proposal_sent', 'contract_sent', 'approved'].includes(item.stage),
      )
      if (eligible.length === 0) return 0
      const approved = eligible.filter(item => item.stage === 'approved').length
      return Math.round((approved / eligible.length) * 100)
    },
    renderValue: (v) => `${v}%`,
  },
  {
    key: 'meetings',
    label: 'Meetings This Week',
    icon: CalendarIcon,
    getValue: (data) => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return data.filter(item =>
        (item.stage === 'meeting_scheduled' || item.stage === 'meeting_in_progress')
        && item.latestActivityAt
        && new Date(item.latestActivityAt) >= weekAgo,
      ).length
    },
  },
]
```

- [ ] **Step 2: Replace `CustomerPipelineMetricsBar` implementation**

Rewrite `src/features/customer-pipelines/ui/components/customer-pipeline-metrics-bar.tsx` to be a thin wrapper:

```typescript
import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

import { pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'

interface Props {
  items: CustomerPipelineItem[]
  isLoading?: boolean
}

export function CustomerPipelineMetricsBar({ items, isLoading }: Props) {
  return <StatBar items={pipelineStatConfig} data={items} isLoading={isLoading} />
}
```

- [ ] **Step 3: Verify pipeline view still works**

Run: `pnpm build`
Expected: PASS. The pipeline metrics bar renders identically using the shared `StatBar`.

- [ ] **Step 4: Commit**

```bash
git add src/features/customer-pipelines/constants/pipeline-stat-config.ts src/features/customer-pipelines/ui/components/customer-pipeline-metrics-bar.tsx
git commit -m "refactor: migrate pipeline metrics bar to shared StatBar"
```

---

## Task 7: Update `DataViewTypeToggle` with Calendar + `availableViews`

**Files:**
- Modify: `src/shared/components/data-view-type-toggle.tsx`

- [ ] **Step 1: Update the component**

Replace the full contents of `src/shared/components/data-view-type-toggle.tsx`:

```typescript
'use client'

import { CalendarDaysIcon, KanbanIcon, TableIcon } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

export type DataViewType = 'kanban' | 'table' | 'calendar'

const VIEW_CONFIG: Record<DataViewType, { icon: typeof KanbanIcon; label: string }> = {
  kanban: { icon: KanbanIcon, label: 'Kanban view' },
  table: { icon: TableIcon, label: 'Table view' },
  calendar: { icon: CalendarDaysIcon, label: 'Calendar view' },
}

interface Props {
  value: DataViewType
  onChange: (value: DataViewType) => void
  availableViews?: DataViewType[]
  className?: string
}

export function DataViewTypeToggle({
  value,
  onChange,
  availableViews = ['kanban', 'table'],
  className,
}: Props) {
  return (
    <ToggleGroup
      className={cn('', className)}
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => {
        if (v) {
          onChange(v as DataViewType)
        }
      }}
    >
      {availableViews.map((view) => {
        const config = VIEW_CONFIG[view]
        return (
          <ToggleGroupItem key={view} value={view} aria-label={config.label}>
            <config.icon className="h-4 w-4" />
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
```

- [ ] **Step 2: Verify existing usages still work**

Run: `pnpm tsc --noEmit`
Expected: PASS. `CustomerPipelineView` passes no `availableViews` → defaults to `['kanban', 'table']`.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/data-view-type-toggle.tsx
git commit -m "feat: add calendar to DataViewTypeToggle with availableViews prop"
```

---

## Task 8: Install Jeraidi Full Calendar via shadcn Registry

**Files:**
- Creates files in the codebase via shadcn registry install

- [ ] **Step 1: Install from registry**

Run: `pnpm dlx shadcn@latest add "https://calendar.jeraidi.dev/r/full-calendar.json"`

Expected: Source files installed into the project. Inspect where they land (likely `src/components/` or similar). Note the exact paths.

- [ ] **Step 2: Review installed files**

Read the installed files to understand:
- What views are included (day, week, month, year, agenda)
- How events are typed
- How the calendar context works
- What shadcn primitives it uses

- [ ] **Step 3: Move and restructure**

Move the installed files to `src/shared/components/calendar/` following the spec's architecture. Strip views we don't need (day, year, agenda). Keep only month and week views. Adapt the existing Jeraidi code to match our component structure:
- `calendar-board.tsx` — the main orchestrator
- `calendar-header.tsx` — navigation, today button, view toggle, Saturday filter
- `calendar-week-view.tsx` — the week grid
- `calendar-month-view.tsx` — the month grid
- `calendar-time-indicator.tsx` — the red "now" line

- [ ] **Step 4: Create `types.ts`**

Create `src/shared/components/calendar/types.ts` with the types from the spec:

```typescript
export interface CalendarEvent {
  id: string
  startAt: string
  endAt?: string
  title: string
}

export type CalendarViewType = 'week' | 'month'

export interface CalendarConfig {
  defaultView?: CalendarViewType
  hiddenDays?: number[]
  weekStartsOn?: 0 | 1
}

export interface CalendarBoardProps<T extends CalendarEvent> {
  events: T[]
  config?: CalendarConfig
  renderCard: (event: T) => React.ReactNode
  renderCompact: (event: T) => React.ReactNode
  onEventClick?: (event: T) => void
  onDateRangeChange?: (range: { from: Date; to: Date }) => void
  className?: string
}
```

- [ ] **Step 5: Implement CalendarBoard to match props contract**

Adapt the Jeraidi orchestrator component to accept `CalendarBoardProps<T>`. Key behaviors:
- Internal state: `currentDate` (Date), `activeView` (CalendarViewType)
- `config.defaultView` sets initial `activeView` (default: `'week'`)
- `config.hiddenDays` passed to week view (default: `[6]` for Saturday)
- Fires `onDateRangeChange` when `currentDate` or `activeView` changes
- Passes `renderCard` to week view, `renderCompact` to month view
- No drag-and-drop

- [ ] **Step 6: Implement Saturday toggle in CalendarHeader**

Add a filter button to `calendar-header.tsx` styled like `KanbanColumnFilter` (reference: `src/shared/components/kanban/ui/kanban-column-filter.tsx`):
- Popover with a checkbox for "Show Saturday"
- Only visible when `activeView === 'week'`
- Toggles Saturday in/out of `hiddenDays` state
- Uses `FilterIcon` from lucide-react

- [ ] **Step 7: Implement `calendar-time-indicator.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'

export function CalendarTimeIndicator() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const topPercent = ((hours * 60 + minutes) / (24 * 60)) * 100

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${topPercent}%` }}
    >
      <div className="flex items-center">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 border-t border-red-500" />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verify calendar renders standalone**

Create a temporary test page or render `CalendarBoard` with dummy data to verify:
- Week view shows Sun–Fri by default
- Month view shows full 7-day weeks
- Saturday toggle works
- Today indicator appears
- Navigation arrows change the visible week/month
- "Today" button snaps back

- [ ] **Step 9: Commit**

```bash
git add src/shared/components/calendar/
git commit -m "feat: add shared CalendarBoard component (Jeraidi base)"
```

---

## Task 9: Add `MeetingCalendarEvent` Type and Mapping

**Files:**
- Modify: `src/features/meetings/types/index.ts`
- Create: `src/features/meetings/lib/to-calendar-event.ts`

- [ ] **Step 1: Add the type**

Add to `src/features/meetings/types/index.ts`:

```typescript
import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { MeetingStatus } from '@/shared/types/enums'

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

- [ ] **Step 2: Create the mapping function**

Create `src/features/meetings/lib/to-calendar-event.ts`:

```typescript
import type { inferRouterOutputs } from '@trpc/server'
import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { AppRouter } from '@/trpc/routers/app'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

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

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/types/index.ts src/features/meetings/lib/to-calendar-event.ts
git commit -m "feat(meetings): add MeetingCalendarEvent type and mapping"
```

---

## Task 10: Build Meeting Calendar Card Components

**Files:**
- Create: `src/features/meetings/ui/components/calendar/meeting-calendar-card.tsx`
- Create: `src/features/meetings/ui/components/calendar/meeting-calendar-dot.tsx`

- [ ] **Step 1: Create week view card**

Create `src/features/meetings/ui/components/calendar/meeting-calendar-card.tsx`.

This component renders the rich week view card. Reference the spec wireframe:
```
┌─────────────────────────────────┐
│ ● in_progress  TPR Monthly Spc  │
│ John Smith                      │
│ 📞 (555) 123-4567        ⋮     │
│ 📍 123 Main St, Anaheim        │
└─────────────────────────────────┘
```

Key implementation details:
- Props: `event: MeetingCalendarEvent`, plus callback props for actions (onEdit, onStart, onDuplicate, onDelete, onNavigate)
- Status dot: small circle with solid fill. Define a constant at the top of the file (not extracted — only used here):
```typescript
const STATUS_DOT_COLORS: Record<MeetingStatus, string> = {
  in_progress: 'bg-sky-500',
  completed: 'bg-emerald-500',
  converted: 'bg-violet-500',
}
```
- Program badge: use `MEETING_PROGRAMS` from `src/features/meetings/constants/programs.ts` to find the program name and accent color. Use `programAccentMap` from `src/features/meetings/constants/program-accent-map.ts` for badge styling.
- Customer name: `font-medium`, truncated with `Tooltip` on overflow
- Phone: `<PhoneAction phone={event.customerPhone} />` from `@/shared/components/contact-actions/ui/phone-action` (only if phone exists)
- Address: format as `[address, city].filter(Boolean).join(', ')`, render `<AddressAction address={formatted} />` from `@/shared/components/contact-actions/ui/address-action` (only if address exists)
- "..." menu: `DropdownMenu` with Edit, Start, Duplicate, Delete. Gate Delete behind `ability.can('delete', 'Meeting')` via `useAbility()` from `@/shared/permissions/hooks`.
- Click card body: calls `onNavigate(event.meetingId)`
- Background: subtle status tint, e.g., `bg-sky-500/5` for in_progress

- [ ] **Step 2: Create month view dot with popover**

Create `src/features/meetings/ui/components/calendar/meeting-calendar-dot.tsx`.

This component renders the compact month dot + click popover:
- Dot display: `● 10:00 AM  John Smith` — status-colored dot + formatted time + name
- Click opens a `Popover` (from shadcn/ui) anchored to the dot
- Popover contents: customer name (bold), time + date, status badge, program badge, `PhoneAction`, `AddressAction`, action buttons (View Meeting, Edit Setup, Start Flow, Duplicate, Delete)
- All action buttons gated via `useAbility()`:
  - View: `ability.can('read', 'Meeting')`
  - Edit/Start: `ability.can('update', 'Meeting')`
  - Duplicate: `ability.can('create', 'Meeting')`
  - Delete: `ability.can('delete', 'Meeting')`
- Format time with `date-fns`: `format(new Date(event.startAt), 'h:mm a')`

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/ui/components/calendar/
git commit -m "feat(meetings): add calendar card and dot components"
```

---

## Task 11: Build `MeetingCalendar` Wrapper

**Files:**
- Create: `src/features/meetings/ui/components/calendar/meeting-calendar.tsx`

- [ ] **Step 1: Create the wrapper**

Create `src/features/meetings/ui/components/calendar/meeting-calendar.tsx`:

This is a thin wrapper that:
1. Accepts `MeetingRow[]` and callback props
2. Maps rows to `MeetingCalendarEvent[]` via `toCalendarEvent`
3. Renders `CalendarBoard<MeetingCalendarEvent>` with:
   - `config={{ defaultView: 'week', hiddenDays: [6], weekStartsOn: 0 }}`
   - `renderCard` → `MeetingCalendarCard`
   - `renderCompact` → `MeetingCalendarDot`
   - `onEventClick` → navigate to meeting form
   - `onDateRangeChange` → forwarded to parent

```typescript
'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { useCallback, useMemo } from 'react'

import { toCalendarEvent } from '@/features/meetings/lib/to-calendar-event'
import { CalendarBoard } from '@/shared/components/calendar/ui/calendar-board'

import { MeetingCalendarCard } from './meeting-calendar-card'
import { MeetingCalendarDot } from './meeting-calendar-dot'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

interface Props {
  data: MeetingRow[]
  onNavigateToMeeting: (meetingId: string) => void
  onEditMeeting: (meetingId: string) => void
  onStartMeeting: (meetingId: string) => void
  onDuplicateMeeting: (meetingId: string) => void
  onDeleteMeeting: (meetingId: string) => void
  onDateRangeChange?: (range: { from: Date; to: Date }) => void
}

export function MeetingCalendar({
  data,
  onNavigateToMeeting,
  onEditMeeting,
  onStartMeeting,
  onDuplicateMeeting,
  onDeleteMeeting,
  onDateRangeChange,
}: Props) {
  const events = useMemo(() => data.map(toCalendarEvent), [data])

  const renderCard = useCallback(
    (event: ReturnType<typeof toCalendarEvent>) => (
      <MeetingCalendarCard
        event={event}
        onNavigate={onNavigateToMeeting}
        onEdit={onEditMeeting}
        onStart={onStartMeeting}
        onDuplicate={onDuplicateMeeting}
        onDelete={onDeleteMeeting}
      />
    ),
    [onNavigateToMeeting, onEditMeeting, onStartMeeting, onDuplicateMeeting, onDeleteMeeting],
  )

  const renderCompact = useCallback(
    (event: ReturnType<typeof toCalendarEvent>) => (
      <MeetingCalendarDot
        event={event}
        onNavigate={onNavigateToMeeting}
        onEdit={onEditMeeting}
        onStart={onStartMeeting}
        onDuplicate={onDuplicateMeeting}
        onDelete={onDeleteMeeting}
      />
    ),
    [onNavigateToMeeting, onEditMeeting, onStartMeeting, onDuplicateMeeting, onDeleteMeeting],
  )

  return (
    <CalendarBoard
      events={events}
      config={{ defaultView: 'week', hiddenDays: [6], weekStartsOn: 0 }}
      renderCard={renderCard}
      renderCompact={renderCompact}
      onDateRangeChange={onDateRangeChange}
    />
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/meetings/ui/components/calendar/meeting-calendar.tsx
git commit -m "feat(meetings): add MeetingCalendar wrapper component"
```

---

## Task 12: Create Meetings Stat Config

**Files:**
- Create: `src/features/meetings/constants/meetings-stat-config.ts`

- [ ] **Step 1: Create the config**

Create `src/features/meetings/constants/meetings-stat-config.ts`:

```typescript
import type { inferRouterOutputs } from '@trpc/server'
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'
import type { AppRouter } from '@/trpc/routers/app'

import { CalendarDaysIcon, CheckCircleIcon, PlayCircleIcon, SparklesIcon } from 'lucide-react'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export const meetingsStatConfig: StatBarItemConfig<MeetingRow>[] = [
  {
    key: 'total',
    label: 'Total Meetings',
    icon: CalendarDaysIcon,
    getValue: (data) => data.length,
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    icon: PlayCircleIcon,
    color: 'text-sky-500',
    getValue: (data) => data.filter(m => m.status === 'in_progress').length,
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircleIcon,
    color: 'text-emerald-500',
    getValue: (data) => data.filter(m => m.status === 'completed').length,
  },
  {
    key: 'converted',
    label: 'Converted',
    icon: SparklesIcon,
    color: 'text-violet-500',
    getValue: (data) => data.filter(m => m.status === 'converted').length,
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/features/meetings/constants/meetings-stat-config.ts
git commit -m "feat(meetings): add stat bar config"
```

---

## Task 13: Build `MeetingsView` — The New Dashboard Step

**Files:**
- Create: `src/features/meetings/ui/views/meetings-view.tsx`
- Modify: `src/features/meetings/ui/views/index.ts`
- Modify: `src/features/agent-dashboard/ui/views/dashboard-hub.tsx:12,69`

- [ ] **Step 1: Create `MeetingsView`**

Create `src/features/meetings/ui/views/meetings-view.tsx`.

This mirrors the structure of `CustomerPipelineView` (`src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`). Key elements:

**State:**
- `useState<DataViewType>('calendar')` — calendar is default
- `useQuery(trpc.meetingsRouter.getAll.queryOptions())` — single data source
- `useState<{ from: Date; to: Date } | null>(null)` — visible date range from calendar

**Mutations** (from `useMeetingActions()` at `src/features/meetings/hooks/use-meeting-actions.ts`):
- `deleteMeeting.mutate({ id })` — delete
- `duplicateMeeting.mutate({ id })` — duplicate

**Navigation callbacks** (these are NOT in `useMeetingActions` — they are routing actions, defined in `MeetingsView` itself):
```typescript
const [, setStep] = useQueryState('step', dashboardStepParser)
const [, setEditMeetingId] = useQueryState('editMeetingId', editMeetingIdParser)
const router = useRouter()

// Navigate to meeting intake form (click card in week view, or "View Meeting" in popover)
const handleNavigateToMeeting = useCallback((meetingId: string) => {
  router.push(`/meeting/${meetingId}`)
}, [router])

// Edit meeting setup (opens edit-meeting step in dashboard)
const handleEditMeeting = useCallback((meetingId: string) => {
  setStep('edit-meeting')
  setEditMeetingId(meetingId)
}, [setStep, setEditMeetingId])

// Start meeting flow (same as navigate — opens the meeting program flow)
const handleStartMeeting = useCallback((meetingId: string) => {
  router.push(`/meeting/${meetingId}`)
}, [router])
```

These are threaded down through `MeetingCalendar` → `MeetingCalendarCard` / `MeetingCalendarDot` via props.

**Loading/Error/Empty states** before content (same pattern as `PastMeetingsView`).

**Stat bar date-range filtering:**
```typescript
const statsData = useMemo(() => {
  if (layout !== 'calendar' || !dateRange || !meetings.data) return meetings.data ?? []
  return meetings.data.filter((m) => {
    const d = new Date(m.scheduledFor)
    return d >= dateRange.from && d <= dateRange.to
  })
}, [layout, dateRange, meetings.data])
```
Pass `statsData` to `StatBar` instead of the full dataset.

**Layout:** stat bar at top, toggle at top-right, conditional render of `MeetingCalendar` or `PastMeetingsTable` below.

Reference `PastMeetingsView` at `src/features/meetings/ui/views/past-meetings-view.tsx` for the loading/error/empty pattern.
Reference `CustomerPipelineView` at `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` for the stat bar + toggle + conditional render pattern.

- [ ] **Step 2: Update views entrypoint**

Modify `src/features/meetings/ui/views/index.ts`:

```typescript
export { CreateMeetingView } from './create-meeting-view'
export { EditMeetingSetupView } from './edit-meeting-setup-view'
export { MeetingsView } from './meetings-view'
```

Note: `PastMeetingsView` is removed from the public entrypoint. It's now internal to the meetings feature (used by `MeetingsView` for the table sub-view).

- [ ] **Step 3: Update DashboardHub**

In `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`:

1. Update import (line 12): Replace `PastMeetingsView` with `MeetingsView`:
```typescript
import { CreateMeetingView, EditMeetingSetupView, MeetingsView } from '@/features/meetings/ui/views'
```

2. Update render (line 69): Replace `<PastMeetingsView>` with `<MeetingsView>`:
```tsx
{step === 'meetings' && (
  <MeetingsView key="meetings" />
)}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: PASS. The meetings dashboard step now renders the calendar view by default with the toggle to switch to table.

- [ ] **Step 5: Manual verification**

Open the app, navigate to Dashboard → Meetings. Verify:
- Calendar view is default (week view, Sun–Fri)
- Stat bar shows total, in_progress, completed, converted counts
- Toggle switches to table view (same as before)
- Toggle switches back to calendar
- Meeting cards show correct data

- [ ] **Step 6: Commit**

```bash
git add src/features/meetings/ui/views/meetings-view.tsx src/features/meetings/ui/views/index.ts src/features/agent-dashboard/ui/views/dashboard-hub.tsx
git commit -m "feat(meetings): add MeetingsView with calendar/table toggle"
```

---

## Task 14: Final Integration Verification

- [ ] **Step 1: Run full lint**

Run: `pnpm lint`
Expected: PASS. Fix any import sorting or style issues.

- [ ] **Step 2: Run full type check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run full build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Manual E2E walkthrough**

Verify each feature from the spec:
1. ✅ Week view shows Sun–Fri by default
2. ✅ Saturday toggle shows/hides Saturday column
3. ✅ Month view shows full 7-day weeks
4. ✅ Week/Month toggle works
5. ✅ "Today" button snaps back
6. ✅ Red "now" indicator line appears in week view
7. ✅ Meeting cards show status dot, program badge, name, phone, address
8. ✅ Phone: tap to call works, copy works
9. ✅ Address dropdown: Google Maps, Google Earth, Copy all work
10. ✅ Click week card → navigates to meeting form
11. ✅ Click month dot → opens popover with detail + actions
12. ✅ "..." menu on card: edit, start, duplicate all work
13. ✅ Delete only visible for super-admin
14. ✅ Stat bar updates when navigating weeks/months (calendar mode)
15. ✅ Stat bar shows full dataset in table mode
16. ✅ Pipeline view still works with refactored stat bar
17. ✅ Customer profile header still works with extracted contact actions

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: final integration fixes for calendar view"
```
