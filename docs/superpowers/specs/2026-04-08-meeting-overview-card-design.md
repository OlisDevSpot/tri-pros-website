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
| File structure | Single file (`overview-card.tsx`) | ~200-300 lines for 6-8 sub-components. Matches BlogpostCard precedent. Avoids barrel file convention violation. |
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

| Sub-component | Reads from context | Props | Renders |
|---|---|---|---|
| `MeetingOverviewCard` (root) | — | `meeting: MeetingOverviewCardData`, `highlight?: boolean`, `className?: string`, `children: ReactNode` | Context provider + optional Card wrapper |
| `.Header` | — | `className?: string`, `children: ReactNode` | Flex row container |
| `.ScheduledDate` | `meeting.scheduledFor` | `format?: 'full' \| 'date-only' \| 'time-only' \| 'relative'`, `className?: string` | Formatted date text |
| `.Type` | `meeting.meetingType` | `className?: string` | Badge with meeting type |
| `.Status` | `meeting.meetingOutcome` | `variant?: 'badge' \| 'dot'`, `className?: string` | Outcome badge or colored dot |
| `.CreatedAt` | `meeting.createdAt` | `className?: string` | Relative timestamp ("created X ago") |
| `.Owner` | `meeting.ownerName`, `meeting.ownerImage` | `className?: string` | Avatar + name |
| `.CustomerName` | `meeting.customerName` | `className?: string` | Customer name text |
| `.Proposals` | `meeting.proposals` | `renderProposal?: (proposal) => ReactNode`, `className?: string` | Proposal list; default rendering or custom via render prop |
| `.Actions` | `meeting` (full) | `actions: EntityActionConfig[]`, `mode?: 'compact' \| 'full'`, `className?: string` | EntityActionMenu wrapper |
| `.Body` | — | `className?: string`, `children: ReactNode` | Generic content container |

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

```tsx
<Card className={cn(isHighlighted && 'outline-2 outline-primary -outline-offset-2')}>
  <CardContent className="p-0">
    <MeetingOverviewCard meeting={meeting}>
      <MeetingOverviewCard.Header className="px-3 py-2">
        <MeetingOverviewCard.ScheduledDate format="full" />
        <MeetingOverviewCard.Type />
        <MeetingOverviewCard.Status variant="badge" />
        <MeetingOverviewCard.CreatedAt />
        <MeetingOverviewCard.Actions actions={meetingActions} mode="compact" />
      </MeetingOverviewCard.Header>
      <MeetingOverviewCard.Proposals className="border-t px-3 py-2" />
    </MeetingOverviewCard>
  </CardContent>
</Card>
```

### Calendar Card (replaces `MeetingCalendarCard`)

```tsx
<div className={cn('rounded-md border p-2.5 text-xs', STATUS_BG_TINTS[event.meetingOutcome])}>
  <MeetingOverviewCard meeting={calendarEvent} className="flex flex-col gap-1.5">
    <MeetingOverviewCard.Header className="gap-1.5">
      <MeetingOverviewCard.Status variant="dot" />
      <MeetingOverviewCard.CustomerName className="font-medium truncate flex-1" />
      <MeetingOverviewCard.Actions actions={actions} mode="compact" />
    </MeetingOverviewCard.Header>
    <MeetingOverviewCard.ScheduledDate format="time-only" />
    <MeetingOverviewCard.Body>
      <PhoneAction phone={event.customerPhone} />
      <AddressAction address={fullAddress} />
    </MeetingOverviewCard.Body>
  </MeetingOverviewCard>
</div>
```

### Kanban Project Meeting (replaces inline `KanbanProjectMeeting`)

```tsx
<MeetingOverviewCard meeting={mtg} className="space-y-1">
  <MeetingOverviewCard.Header className="gap-1.5">
    <MeetingOverviewCard.Owner />
    <MeetingOverviewCard.Actions actions={mtgActions} mode="compact" />
  </MeetingOverviewCard.Header>
  <MeetingOverviewCard.Proposals />
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

---

## Migration Strategy

### Phase 1: Create the compound component
- Create `src/shared/components/entities/meetings/overview-card.tsx`
- Move meeting status constants to `src/shared/constants/meetings/` (update existing imports)
- Write the compound component with all sub-components

### Phase 2: Replace existing implementations one at a time
- Replace `MeetingEntityCard` usage in customer profile modal → compose with MeetingOverviewCard
- Replace `MeetingCalendarCard` usage in calendar views → compose with MeetingOverviewCard
- Replace `KanbanProjectMeeting` inline component in kanban card → compose with MeetingOverviewCard

### Phase 3: Cleanup
- Delete `meeting-entity-card.tsx` (once all usages replaced)
- Delete `meeting-calendar-card.tsx` (once all usages replaced)
- Remove inline `KanbanProjectMeeting` from `customer-kanban-card.tsx`

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
   - Action menus open and trigger correct callbacks
   - Click handlers (navigate, view profile) work
   - Drag-and-drop still works in kanban context
   - Date picker in calendar card still works
5. **No regressions:** Verify each view context after each replacement before moving to the next
