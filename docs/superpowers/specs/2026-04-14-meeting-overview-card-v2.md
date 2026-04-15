# MeetingOverviewCard v2 — Single Compound Component

**Date:** 2026-04-14
**Status:** Draft
**Replaces:** `2026-04-08-meeting-overview-card-design.md` (v1 had architectural flaws)

---

## Problem

Meeting entity data is rendered across 5+ divergent implementations. Each creates its own action configs, handles its own delete dialog, and renders meeting fields inline. When a new view context needs meeting data, developers create yet another one-off card with different actions and different behavior for the same entity.

## Goal

ONE compound component. ONE file. Lives in `shared/`. Owns data display AND actions. Every view context composes it with different sub-component arrangements but gets the same base behavior. No wrappers. No feature-level shims.

---

## Architecture

### Single Component

```
src/shared/components/entities/meetings/overview-card.tsx
```

Context-driven compound component. The root calls `useMeetingActionConfigs` internally, provides meeting data + actions via context. Sub-components read from context. Consumers never touch action hooks directly.

### Entity Hooks (moved to shared)

```
src/shared/entities/meetings/hooks/use-meeting-actions.ts      (tRPC mutations)
src/shared/entities/meetings/hooks/use-meeting-action-configs.ts (action config builder)
```

These are entity infrastructure, not feature logic. They use tRPC (available everywhere) and shared hooks (`useConfirm`, `useModalStore`). Moving them to `shared/entities/meetings/hooks/` co-locates them with the entity schemas.

### Constants (moved to shared)

```
src/shared/constants/meetings/status-colors.ts    (all 4 color/label maps merged)
src/shared/constants/meetings/outcome-options.ts   (selectable outcome options)
```

### SowTradeScope (moved to shared)

```
src/shared/entities/proposals/types.ts   (add SowTradeScope interface)
```

---

## Consumer API

```tsx
// EVERY view context. Same component. Same actions. Same behavior.
<MeetingOverviewCard meeting={meeting} customerId={customerId}>
  <MeetingOverviewCard.Header>
    <MeetingOverviewCard.Fields fields={[
      { field: 'scheduledDate', format: 'full' },
      { field: 'type' },
      { field: 'outcome' },
      { field: 'proposalCount' },
    ]} />
    <MeetingOverviewCard.CreatedAt />
    <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
  </MeetingOverviewCard.Header>
  <MeetingOverviewCard.Proposals showHeader={false} />
</MeetingOverviewCard>
```

### Root Props

```ts
interface MeetingOverviewCardProps {
  meeting: MeetingOverviewCardData
  customerId: string              // Required. View Meeting opens profile modal.
  className?: string
  children: ReactNode
  // Extension actions — only appear when provided
  onAssignOwner?: (entity: MeetingOverviewCardData) => void
  onAssignProject?: (entity: MeetingOverviewCardData) => void
}
```

### Fixed Base Actions (not overridable)

| Action | Behavior |
|---|---|
| View | Opens customer profile modal with meeting highlighted |
| Start | Navigates to meeting flow page |
| Duplicate | Clones meeting via tRPC mutation |
| Set Outcome | Dropdown selector, updates via tRPC mutation |
| Create Proposal | Navigates to new proposal page with meetingId |
| Delete | Confirm dialog + delete via tRPC mutation |

### Extension Actions (only appear when callback provided)

| Action | When |
|---|---|
| Assign Owner | `onAssignOwner` prop provided |
| Assign Project | `onAssignProject` prop provided |

---

## Context Shape

```ts
interface MeetingOverviewCardContextValue {
  meeting: MeetingOverviewCardData
  customerId: string
  actions: EntityActionConfig<any>[]
}
```

---

## Types

Derived from Drizzle schemas. No hand-rolled interfaces.

```ts
type MeetingOverviewCardProposal
  = Pick<Proposal, 'id' | 'status' | 'token' | 'createdAt'>
    & { label?: Proposal['label'], trade?: string | null, value?: number | null, viewCount?: number, sowSummary?: SowTradeScope[] }

type MeetingOverviewCardData
  = Pick<Meeting, 'id'>
    & Partial<Pick<Meeting, 'scheduledFor' | 'createdAt' | 'meetingType' | 'meetingOutcome' | 'ownerId' | 'customerId'>>
    & {
      ownerName?: string | null
      ownerImage?: string | null
      customerName?: string | null
      customerPhone?: string | null
      customerAddress?: string | null
      customerCity?: string | null
      customerState?: string | null
      customerZip?: string | null
      proposals?: MeetingOverviewCardProposal[]
    }
```

---

## Sub-Components

| Sub-component | Reads from context | Props |
|---|---|---|
| Root | — | `meeting`, `customerId`, `className?`, `children`, `onAssignOwner?`, `onAssignProject?` |
| `.Header` | — | `className?`, `children` |
| `.Body` | — | `className?`, `children` |
| `.Owner` | `ownerName`, `ownerImage` | `size?: 'sm' \| 'md'`, `showName?`, `className?`. Includes HybridPopoverTooltip. |
| `.CustomerName` | `customerName` | `className?` |
| `.CreatedAt` | `createdAt` | `className?` |
| `.Phone` | `customerPhone` | `className?`. Wraps PhoneAction. |
| `.Address` | `customerAddress/City/State/Zip` | `children?`, `className?`. Wraps AddressAction. Custom trigger via children. |
| `.Fields` | multiple | `fields: MeetingFieldConfig[]`, `className?` |
| `.Trades` | `proposals[].sowSummary` | `max?`, `className?` |
| `.Proposals` | `proposals` | `renderProposal?`, `showHeader?`, `className?` |
| `.Actions` | `actions` from context | `mode?: 'compact' \| 'bar'`, `className?`. No actions prop. |
| `.ContextMenu` | `actions` from context | `children`. No actions prop. |

### `.Fields` Config

```ts
type MeetingFieldConfig
  = | { field: 'outcome', variant?: 'badge' | 'dot', onSelect?: (outcome: string) => void, isLoading?: boolean }
    | { field: 'scheduledDate', format?: 'full' | 'date-only' | 'time-only' | 'relative', onChange?: (date: Date) => void }
    | { field: 'type' }
    | { field: 'proposalCount' }
```

---

## View Contexts — All Using This Component

### 1. Customer Profile Modal / Meetings Tab

```tsx
<Card className={cn('group', isHighlighted && 'outline-2 outline-primary -outline-offset-2')}>
  <CardContent className="p-0">
    <MeetingOverviewCard meeting={meeting} customerId={customerId}>
      <MeetingOverviewCard.Header className="px-3 py-2">
        <MeetingOverviewCard.Fields fields={[
          { field: 'scheduledDate', format: 'full' },
          { field: 'type' },
          { field: 'outcome' },
          { field: 'proposalCount' },
        ]} />
        <MeetingOverviewCard.CreatedAt />
        <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
      </MeetingOverviewCard.Header>
      <MeetingOverviewCard.Proposals showHeader={false} className="border-t px-3 py-2"
        renderProposal={...} />
    </MeetingOverviewCard>
  </CardContent>
</Card>
```

### 2. Customer Profile Modal / Projects Tab (meetings inside project)

Same composition as #1 — uses `MeetingOverviewCard` inside `ProjectEntityCard`.

### 3. Kanban / Projects Pipeline (meetings inside project card)

```tsx
<MeetingOverviewCard meeting={meeting} customerId={item.id} className="space-y-1">
  <MeetingOverviewCard.Header className="gap-1.5">
    <MeetingOverviewCard.Owner size="sm" showName />
    <MeetingOverviewCard.Fields fields={[{ field: 'proposalCount' }]} />
    <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
  </MeetingOverviewCard.Header>
  <MeetingOverviewCard.Proposals renderProposal={...} />
</MeetingOverviewCard>
```

### 4. Kanban / Fresh Pipeline (meeting section in customer card)

Currently renders meeting data inline with `EntityActionMenu` + `RepProfileSnapshot`. Must be converted to use `MeetingOverviewCard`:

```tsx
<MeetingOverviewCard meeting={freshMeeting} customerId={item.id} onAssignOwner={handleAssignOwner}>
  <MeetingOverviewCard.Header className="gap-1.5">
    <MeetingOverviewCard.Owner size="sm" showName />
    <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
  </MeetingOverviewCard.Header>
  {/* Meeting time badge, proposals — composed from sub-components */}
</MeetingOverviewCard>
```

### 5. Calendar Today + Week Views

```tsx
<MeetingOverviewCard meeting={calendarMeeting} customerId={event.customerId} onAssignOwner={handleAssignOwner}
  className={cn('group ...', STATUS_BG_TINTS[event.meetingOutcome])}>
  <MeetingOverviewCard.Header>
    <MeetingOverviewCard.Fields fields={[{ field: 'outcome', variant: 'dot' }]} />
    <MeetingOverviewCard.CustomerName className="font-medium truncate flex-1" />
    <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
  </MeetingOverviewCard.Header>
  <MeetingOverviewCard.Fields fields={[
    { field: 'scheduledDate', format: 'time-only', onChange: ... },
  ]} />
  <MeetingOverviewCard.Phone />
  <MeetingOverviewCard.Address>{/* custom trigger */}</MeetingOverviewCard.Address>
</MeetingOverviewCard>
```

---

## Migration Plan

### Phase 1: Move shared infrastructure
- Move constants to `shared/constants/meetings/`
- Move `SowTradeScope` to `shared/entities/proposals/types.ts`
- Move `useMeetingActions` + `useMeetingActionConfigs` to `shared/entities/meetings/hooks/`
- Update all imports across codebase

### Phase 2: Create the compound component
- Single file: `src/shared/components/entities/meetings/overview-card.tsx`
- All sub-components, context, types, action integration
- Root calls `useMeetingActionConfigs` internally, renders DeleteConfirmDialog

### Phase 3: Replace ALL consumers
- Replace `MeetingEntityCard` (profile modal meetings + projects tabs)
- Replace `MeetingCalendarCard` (calendar today/week views)
- Replace `KanbanProjectMeeting` inline component (kanban projects pipeline)
- Replace fresh pipeline inline meeting rendering (kanban fresh pipeline)
- Delete old components

### Phase 4: Cleanup
- Delete old component files
- Delete old constant files
- Delete old hook files (now in shared/)
- Grep for stale imports
- Verify tsc + lint

---

## Verification

1. `pnpm tsc --noEmit` — zero errors
2. `pnpm lint` — zero errors
3. All 5 view contexts render correctly
4. "View Meeting" opens customer profile modal in ALL contexts
5. "Assign Owner" only appears when callback provided
6. Delete confirms then deletes in ALL contexts
7. Set Outcome dropdown works in ALL contexts
8. No remaining imports from old file locations
