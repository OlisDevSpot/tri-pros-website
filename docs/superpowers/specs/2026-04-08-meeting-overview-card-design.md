# MeetingOverviewCard — Compound Component Design Spec

**Date:** 2026-04-08
**Status:** Draft
**Scope:** MeetingOverviewCard compound component + codebase audit of other entity card candidates

---

## Context

Meeting entity data is displayed across 3+ divergent implementations in the app:

1. **MeetingEntityCard** (`src/features/customer-pipelines/ui/components/meeting-entity-card.tsx`) — customer profile modal meetings tab and nested in ProjectEntityCard
2. **MeetingCalendarCard** (`src/features/meetings/ui/components/calendar/meeting-calendar-card.tsx`) — calendar week/month/today views
3. **KanbanProjectMeeting** (inline in `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx`) — kanban card project context section

Each renders overlapping but inconsistent subsets of meeting fields with different styling, creating maintenance burden and visual inconsistency. When a new view context needs meeting data, developers currently create yet another one-off card.

**Goal:** Create a single composable compound component that serves all view contexts through composition, enforcing a common starting point while remaining extensible for context-specific needs.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pattern | Context-driven compound component (`Component.SubComponent`) | Matches existing `BlogpostCard` pattern in codebase. Single import, self-documenting API via namespace. |
| Data flow | Full meeting entity in context; sub-components read what they need | Simplest approach, future-proof. Sub-components gracefully handle missing fields. |
| Customization | Sub-components accept `className`, event handlers, display variant props | Context provides data; props provide UI configuration. |
| File structure | Single file (`overview-card.tsx`) | ~350-450 lines for ~15 sub-components. Matches BlogpostCard precedent. Avoids barrel file convention violation. |
| Location | `src/shared/components/entities/meetings/overview-card.tsx` | Cross-feature component (used by customer-pipelines, meetings, project-management). `shared/components/entities/` is a new directory pattern for entity compound cards. |
| Scope | MeetingOverviewCard only; other entities tracked as follow-up audit | Validate pattern before scaling. Keep PR focused. |

---

## Architecture

### File

```
src/shared/components/entities/meetings/overview-card.tsx
```

### Pattern

Single file containing:
1. **Context** — `MeetingOverviewCardContext` + `useMeetingOverviewCard()` hook
2. **Root component** — `MeetingOverviewCard` (provider wrapper)
3. **Sub-components** — individual named functions, attached as static properties at end of file
4. **Types** — context value interface, data type, sub-component props

### Context Shape

```ts
interface MeetingOverviewCardData {
  id: string
  // Time & scheduling
  scheduledFor?: string | null
  createdAt?: string
  // Classification
  meetingType?: string | null
  meetingOutcome?: string
  // Ownership
  ownerId?: string | null
  ownerName?: string | null
  ownerImage?: string | null
  // Customer info (for calendar/contact contexts)
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  customerCity?: string | null
  customerState?: string | null
  customerZip?: string | null
  // Nested entities
  proposals?: Array<{
    id: string
    label?: string | null
    trade?: string | null
    value?: number | null
    status: string
    token?: string | null
    viewCount?: number
    createdAt: string
  }>
}

interface MeetingOverviewCardContextValue {
  meeting: MeetingOverviewCardData
  highlight?: boolean
}
```

The `MeetingOverviewCardData` type uses optional fields so it works with all existing meeting data shapes (`CustomerProfileMeeting`, `MeetingCalendarEvent`, `PipelineItemProjectMeeting`). Consumers pass whatever meeting data they have — sub-components render gracefully when fields are absent.

### Sub-Components

#### Layout

| Sub-component | Reads from context | Props | Renders |
|---|---|---|---|
| `MeetingOverviewCard` (root) | — | `meeting`, `highlight?`, `className?`, `children`, `onContextAction?` | Context provider div. If `onContextAction` provided, wraps in `ContextMenu` with meeting actions. |
| `.Header` | — | `className?`, `children` | Flex row container (`flex items-center gap-2`) |
| `.Body` | — | `className?`, `children` | Generic content container div |
| `.Footer` | — | `className?`, `children` | Footer container div |

#### Data Display (read-only)

| Sub-component | Reads from context | Props | Renders |
|---|---|---|---|
| `.ScheduledDate` | `meeting.scheduledFor` | `format?: 'full' \| 'date-only' \| 'time-only' \| 'relative'`, `className?` | Formatted date text span |
| `.Type` | `meeting.meetingType` | `className?` | Badge with meeting type label |
| `.Outcome` | `meeting.meetingOutcome` | `variant?: 'badge' \| 'dot' \| 'tint'`, `className?` | Read-only outcome display. `badge` = colored Badge, `dot` = small colored circle, `tint` = background color class (for parent containers). |
| `.CreatedAt` | `meeting.createdAt` | `className?` | Relative timestamp ("created X ago") |
| `.Owner` | `ownerName`, `ownerImage` | `size?: 'sm' \| 'md'`, `showName?: boolean`, `className?` | Avatar + optional name. Uses `Avatar`/`AvatarFallback` from shadcn. Renders initials fallback. |
| `.CustomerName` | `meeting.customerName` | `className?` | Customer name text span |
| `.Trades` | `meeting.proposals[].trade` | `max?: number`, `className?` | Inline badges of unique trades derived from all proposals. Deduplicates, shows up to `max` (default 3) with "+N more" overflow badge. Returns null if no trades. |
| `.ProposalCount` | `meeting.proposals` | `className?` | Icon + count text (e.g., `FileTextIcon` + "3 proposals") |

#### Editable Fields

| Sub-component | Reads from context | Props | Renders |
|---|---|---|---|
| `.OutcomeSelect` | `meeting.meetingOutcome` | `onSelect: (outcome: string) => void`, `isLoading?: boolean`, `className?` | Inline dropdown (Select or DropdownMenu) to change meeting outcome. Shows current outcome as trigger with colored indicator. Uses `MEETING_OUTCOME_OPTIONS`. |
| `.ScheduledDatePicker` | `meeting.scheduledFor` | `onChange: (date: Date) => void`, `className?` | Inline DateTimePicker (wraps existing `DateTimePicker` component). Renders as a clickable Badge showing current time. |

#### Nested Entities

| Sub-component | Reads from context | Props | Renders |
|---|---|---|---|
| `.Proposals` | `meeting.proposals` | `renderProposal?: (proposal) => ReactNode`, `className?`, `emptyMessage?: string` | Proposal list container with header (icon + count). Iterates proposals — uses `renderProposal` if provided, otherwise renders a default compact row. When `ProposalOverviewCard` is built later, consumers will pass `renderProposal={(p) => <ProposalOverviewCard proposal={p} />}`. |

#### Interaction

| Sub-component | Reads from context | Props | Renders |
|---|---|---|---|
| `.Actions` | `meeting` (full entity) | `actions: EntityActionConfig[]`, `mode?: 'compact' \| 'full'`, `className?` | Wraps `EntityActionMenu`. In `compact` mode renders as `MoreHorizontalIcon` trigger (existing behavior). In `full` mode renders primary button + overflow dropdown. |
| `.ContextMenu` | `meeting` (full entity) | `actions: EntityActionConfig[]`, `children: ReactNode` | Wraps children in shadcn `ContextMenu` + `ContextMenuTrigger` + `ContextMenuContent`. Right-click on the wrapped area opens the same actions as the dropdown. Reuses the same `EntityActionConfig` array. |

**Note on `.ContextMenu`:** This is an **alternative** to passing `onContextAction` to the root. The root-level approach is simpler (actions array in one place), but `.ContextMenu` as a sub-component gives more control over which area of the card is right-clickable. **Recommendation:** Support both — root-level for the common case, `.ContextMenu` sub-component for advanced composition.

### Sub-Component Summary

```
MeetingOverviewCard          (root provider + optional ContextMenu)
├── .Header                  (flex row)
├── .Body                    (generic container)
├── .Footer                  (generic container)
├── .ScheduledDate           (read-only date display)
├── .ScheduledDatePicker     (editable date)
├── .Type                    (badge)
├── .Outcome                 (read-only outcome: badge/dot/tint)
├── .OutcomeSelect           (editable outcome dropdown)
├── .CreatedAt               (relative time)
├── .Owner                   (avatar + name)
├── .CustomerName            (text)
├── .Trades                  (unique trade badges from proposals)
├── .ProposalCount           (icon + count)
├── .Proposals               (proposal list with render prop)
├── .Actions                 (MoreHorizontal dropdown menu)
└── .ContextMenu             (right-click context menu wrapper)
```

### Root Component Behavior

The root `MeetingOverviewCard` wraps children in the context provider. It does **not** render a `<Card>` by default — the consumer decides the outer shell. This keeps it flexible for:
- Shadcn Card wrapper (profile modal)
- Plain div with status-tinted background (calendar)
- No wrapper at all (inline in kanban card)

If the consumer wants a Card, they wrap it themselves:

```tsx
<Card className={cn(highlight && 'outline-2 outline-primary -outline-offset-2')}>
  <CardContent>
    <MeetingOverviewCard meeting={meeting}>
      {/* sub-components */}
    </MeetingOverviewCard>
  </CardContent>
</Card>
```

Or for the simple case, they can just use:

```tsx
<MeetingOverviewCard meeting={meeting} className="space-y-1.5">
  {/* sub-components */}
</MeetingOverviewCard>
```

The root renders a `<div>` with the passed `className`.

---

## Usage Examples

### Profile Modal — Meetings Tab (replaces `MeetingEntityCard`)

Full detail card with right-click context menu, editable outcome, trades, and nested proposals.

```tsx
<Card className={cn(isHighlighted && 'outline-2 outline-primary -outline-offset-2')}>
  <CardContent className="p-0">
    <MeetingOverviewCard meeting={meeting}>
      <MeetingOverviewCard.ContextMenu actions={meetingActions}>
        <MeetingOverviewCard.Header className="px-3 py-2">
          <MeetingOverviewCard.ScheduledDate format="full" />
          <MeetingOverviewCard.Type />
          <MeetingOverviewCard.OutcomeSelect
            onSelect={(outcome) => updateOutcome.mutate({ id: meeting.id, outcome })}
            isLoading={updateOutcome.isPending}
          />
          <MeetingOverviewCard.Trades max={2} />
          <div className="flex items-center gap-1 ml-auto">
            <MeetingOverviewCard.CreatedAt />
            <MeetingOverviewCard.Actions actions={meetingActions} mode="compact" />
          </div>
        </MeetingOverviewCard.Header>
      </MeetingOverviewCard.ContextMenu>
      <MeetingOverviewCard.Proposals className="border-t px-3 py-2" />
    </MeetingOverviewCard>
  </CardContent>
</Card>
```

### Calendar Card (replaces `MeetingCalendarCard`)

Compact card with outcome dot, editable scheduled time, customer contact info, and right-click menu.

```tsx
<MeetingOverviewCard.ContextMenu actions={actions}>
  <div className={cn('rounded-md border p-2.5 text-xs cursor-pointer')}>
    <MeetingOverviewCard meeting={calendarEvent} className="flex flex-col gap-1.5">
      <MeetingOverviewCard.Header className="gap-1.5">
        <MeetingOverviewCard.Outcome variant="dot" />
        <MeetingOverviewCard.CustomerName className="font-medium truncate flex-1" />
        <MeetingOverviewCard.Actions actions={actions} mode="compact" />
      </MeetingOverviewCard.Header>
      <MeetingOverviewCard.ScheduledDatePicker
        onChange={(date) => onUpdateScheduledFor(event.meetingId, date)}
      />
      <MeetingOverviewCard.Body className="space-y-1">
        <PhoneAction phone={event.customerPhone} />
        <AddressAction address={fullAddress} />
      </MeetingOverviewCard.Body>
    </MeetingOverviewCard>
  </div>
</MeetingOverviewCard.ContextMenu>
```

### Kanban Project Meeting (replaces inline `KanbanProjectMeeting`)

Minimal card — just owner avatar, trades summary, and proposal rows.

```tsx
<MeetingOverviewCard meeting={mtg} className="space-y-1">
  <MeetingOverviewCard.Header className="gap-1.5">
    <MeetingOverviewCard.Owner size="sm" />
    <MeetingOverviewCard.Trades max={2} />
    <MeetingOverviewCard.Actions actions={mtgActions} mode="compact" />
  </MeetingOverviewCard.Header>
  <MeetingOverviewCard.Proposals />
</MeetingOverviewCard>
```

### Read-Only Summary (e.g., in a tooltip or preview popover)

Fully read-only — no actions, no editable fields.

```tsx
<MeetingOverviewCard meeting={meeting} className="space-y-1 text-sm">
  <MeetingOverviewCard.Header>
    <MeetingOverviewCard.ScheduledDate format="full" />
    <MeetingOverviewCard.Outcome variant="badge" />
  </MeetingOverviewCard.Header>
  <MeetingOverviewCard.Owner size="sm" showName />
  <MeetingOverviewCard.Trades />
  <MeetingOverviewCard.ProposalCount />
</MeetingOverviewCard>
```

---

## Existing Constants to Reuse

These constants already exist and should be imported, not recreated:

| Constant | Location | Used by |
|---|---|---|
| `MEETING_LIST_STATUS_COLORS` | `src/features/customer-pipelines/constants/meeting-status-colors.ts` | `.Status` (badge variant) |
| `MEETING_OUTCOME_DOT_COLORS` | `src/features/meetings/constants/status-colors.ts` | `.Status` (dot variant) |
| `MEETING_OUTCOME_LABELS` | `src/features/meetings/constants/status-colors.ts` | `.Status` (badge label) |
| `PROPOSAL_ROW_STYLES` | `src/features/customer-pipelines/constants/proposal-row-styles.ts` | `.Proposals` default rendering |

**Note:** These constants currently live in feature directories. Since the new component is in `shared/`, and shared cannot import from features, these constants will need to be **moved to `shared/constants/`** or the sub-components that need them will accept the styling via props/render props.

**Recommended approach:** Move the meeting status color constants to `src/shared/constants/meetings/` since they're now genuinely cross-feature. The proposal row styles stay in the customer-pipelines feature since `.Proposals` accepts a `renderProposal` render prop — each consumer provides their own proposal row rendering.

Additionally, the following existing components are reused by sub-components:

| Component | Location | Used by |
|---|---|---|
| `EntityActionMenu` | `src/shared/components/entity-actions/ui/entity-action-menu.tsx` | `.Actions` sub-component |
| `EntityActionDropdown` | `src/shared/components/entity-actions/ui/entity-action-dropdown.tsx` | `.Actions` sub-component |
| `ContextMenu` (shadcn) | `src/shared/components/ui/context-menu.tsx` | `.ContextMenu` sub-component |
| `Avatar`, `AvatarFallback`, `AvatarImage` | `src/shared/components/ui/avatar.tsx` | `.Owner` sub-component |
| `Badge` | `src/shared/components/ui/badge.tsx` | `.Type`, `.Outcome`, `.Trades` sub-components |
| `DateTimePicker` | `src/shared/components/date-time-picker.tsx` | `.ScheduledDatePicker` sub-component |
| `MEETING_OUTCOME_OPTIONS` | `src/features/meetings/constants/outcome-options.ts` | `.OutcomeSelect` — needs to move to `shared/constants/meetings/` |

---

## Migration Strategy

### Phase 1: Move shared constants
- Move `MEETING_LIST_STATUS_COLORS` from `src/features/customer-pipelines/constants/meeting-status-colors.ts` → `src/shared/constants/meetings/status-colors.ts`
- Move `MEETING_OUTCOME_DOT_COLORS` and `MEETING_OUTCOME_LABELS` from `src/features/meetings/constants/status-colors.ts` → `src/shared/constants/meetings/status-colors.ts`
- Move `MEETING_OUTCOME_OPTIONS` from `src/features/meetings/constants/outcome-options.ts` → `src/shared/constants/meetings/outcome-options.ts`
- Update all existing imports across the codebase
- Leave feature-specific constants (like `STATUS_BG_TINTS` in calendar card) where they are — those are view-context specific

### Phase 2: Create the compound component
- Create `src/shared/components/entities/meetings/overview-card.tsx`
- Implement all ~16 sub-components:
  - Layout: Root, Header, Body, Footer
  - Data display: ScheduledDate, Type, Outcome, CreatedAt, Owner, CustomerName, Trades, ProposalCount
  - Editable: OutcomeSelect, ScheduledDatePicker
  - Nested: Proposals
  - Interaction: Actions, ContextMenu

### Phase 3: Replace existing implementations one at a time
- Replace `MeetingEntityCard` usage in customer profile modal → compose with MeetingOverviewCard
- Replace `MeetingCalendarCard` usage in calendar views → compose with MeetingOverviewCard
- Replace `KanbanProjectMeeting` inline component in kanban card → compose with MeetingOverviewCard
- Each replacement should be verified for visual + functional parity before moving to the next

### Phase 4: Cleanup
- Delete `meeting-entity-card.tsx` (once all usages replaced)
- Delete `meeting-calendar-card.tsx` (once all usages replaced)
- Remove inline `KanbanProjectMeeting` from `customer-kanban-card.tsx`
- Remove the original constant files if they're now empty (redirect any remaining imports)

---

## Codebase Audit — Other Entities Needing This Pattern

| Entity | Current Components | Divergence | Priority | Notes |
|---|---|---|---|---|
| **Proposal** | `ProposalRow`, `MeetingProposalRow`, `KanbanProposalRow` | **High** — 3 variants with different fields and completely different styling strategies | P1 | Tightly coupled to meetings; should be next after MeetingOverviewCard |
| **Project** | `ProjectEntityCard`, `PortfolioProjectCard`, landing `ProjectCard` | **Medium** — different purposes (admin vs public) but could share header/status sub-components | P2 | Portfolio cards are very image-driven; may only share a few sub-components |
| **Customer** | `CustomerKanbanCard` (complex), `ProfileCard` (form-like) | **Medium** — very different interaction models | P3 | CustomerKanbanCard is more of a *container* than a card; may not benefit as much |
| **Timeline Event** | `TimelineEventItem` (single implementation) | **Low** — only 1 variant currently | P4 | Only worth doing if new timeline contexts emerge |

Each should become a separate GitHub issue after MeetingOverviewCard validates the pattern.

---

## Verification Plan

1. **Type safety:** Run `pnpm tsc` — no type errors in the new component or any consumer
2. **Lint:** Run `pnpm lint` — passes with sorted imports, no duplicate sources
3. **Visual parity:** Each replacement must render identically to the current implementation in its view context:
   - Customer profile modal → meetings tab cards look the same
   - Calendar view → calendar cards look the same
   - Kanban board → project meeting sections look the same
4. **Functional parity:** All interactions work identically:
   - Action menus (MoreHorizontal dropdown) open and trigger correct callbacks
   - Right-click context menus open with same action options
   - Click handlers (navigate, view profile) work
   - Drag-and-drop still works in kanban context
   - Date picker in calendar card still works
   - Outcome select dropdown changes outcome and shows loading state
   - Trades badges render unique trades from proposals correctly
5. **Sub-component isolation:** Each sub-component gracefully handles missing context data:
   - `.Trades` returns null when no proposals have trades
   - `.Owner` renders without crashing when ownerName is null
   - `.OutcomeSelect` shows "Not set" when meetingOutcome is undefined
   - `.ScheduledDatePicker` handles null scheduledFor
6. **No regressions:** Verify each view context after each replacement before moving to the next
7. **Constants migration:** After moving constants, grep the codebase to confirm zero remaining imports from old paths
