# Entity Frontend — Compound Cards, Action Menus, Lists

Every business entity (Customer, Meeting, Proposal, Project, User, LeadSource, future entities) renders through a small, fixed set of frontend primitives so consumers can compose entity UI consistently across kanban cards, calendar events, profile modals, detail tables, and lists:

| Primitive | What it is | Lives at |
|---|---|---|
| `<XOverviewCard>` | Compound component — root + context + slotted sub-components | `entities/<x>/components/overview-card.tsx` |
| `<EntityActionMenu>` | Shared action dropdown driven by per-entity `EntitySpec` registry | `shared/components/entity-actions/ui/entity-action-menu.tsx` |
| `<EntityList>` | Generic header + count + empty-state + render-prop list wrapper | `shared/components/entity-list/ui/entity-list.tsx` |
| `<EntityViewButton>` | Inline "View" affordance for cell-level use | `shared/components/entity-actions/entity-view-button.tsx` |

This is the **frontend mirror of the backend Entity Server System** ([ADR-0002](../adr/0002-entity-server-system.md)). Backend: every entity declares an `EntityServerSpec` consumed by `createEntityRouter`. Frontend: every entity exposes a compound `<XOverviewCard>` + an `EntitySpec` ([ADR-0001](../adr/0001-entity-action-system.md)) driving its action menu. The intent is parallel — typed declarations per entity, generic primitives consume them.

## Rules

### one-overview-card-per-entity

Every entity that appears in 3+ view contexts (kanban + calendar + profile + list) has exactly one compound component at `entities/<x>/components/overview-card.tsx`. Consumers compose the slots they need at each call site — never import a family of standalone primitives (`UserAvatar`, `UserRow`, `UserAvatarStack`, etc.).

**Why**: mixing styles (some entities as compounds, others as primitive families) fragments the mental model. Compound + context lets sub-components share derived state (avatar URL, gated fields, action menu) without prop-drilling, and gives one ergonomic import per view.
**Reference impl**: `src/shared/entities/meetings/components/overview-card.tsx`, `src/shared/entities/proposals/components/overview-card.tsx`
**Enforced by**: convention

### data-type-derives-from-drizzle-schema

The card's data type uses `Pick<TEntity, 'id'>` + `Partial<Pick<TEntity, ...>>` from the Drizzle select type. Never hand-roll a parallel interface.

```ts
export type MeetingOverviewCardData
  = Pick<Meeting, 'id'>
    & Partial<Pick<Meeting, 'scheduledFor' | 'createdAt' | 'meetingType' | 'ownerId'>>
    & {
      ownerName?: string | null
      customerName?: string | null
      // …joined / enriched fields the row doesn't have
    }
```

Only `id` is required. Everything else is optional — slots gracefully return `null` when their data is missing.

**Why**: see [`database-schema.md#type-derivation-priority`](./database-schema.md) and `memory/feedback-typing-priority.md`. Hand-rolled types diverge silently from the schema and lose JSONB typing.
**Reference impl**: `src/shared/entities/meetings/components/overview-card.tsx:MeetingOverviewCardData`
**Enforced by**: convention

### context-provides-data-plus-actions

The Root creates a context with both data and resolved actions, and children consume via a `useXOverviewCard()` hook that throws if used outside the Root.

```ts
interface MeetingOverviewCardContextValue {
  meeting: MeetingOverviewCardData
  customerId: string
  actions: ReturnType<typeof useMeetingActionConfigs>['actions']
}

const MeetingOverviewCardContext = createContext<MeetingOverviewCardContextValue | null>(null)

function useMeetingOverviewCard() {
  const ctx = React.use(MeetingOverviewCardContext)
  if (!ctx) throw new Error('MeetingOverviewCard.* used outside <MeetingOverviewCard>')
  return ctx
}
```

Consumers **never** call `useXActionConfigs` directly — the Root does it internally and threads actions through context.

**Why**: every sub-component reads from one place; the consumer wires one provider and forgets. Eliminates prop drilling for shared state. Throw-on-no-context turns misuse into a compile-level mistake.
**Reference impl**: `src/shared/entities/proposals/components/overview-card.tsx:useProposalOverviewCard`
**Enforced by**: runtime throw + convention

### root-owns-default-click-and-confirm-dialogs

The Root wraps children in a clickable `<div onClick={handleView}>` where `handleView` opens the canonical detail view (e.g., `CustomerProfileModal` with the right default tab). Sub-components that have their own click targets use `e.stopPropagation()`.

The Root also renders shared dialogs (e.g., `<DeleteConfirmDialog />`) once at the top of the context provider — sub-components don't mount their own.

**Why**: predictable default action per entity; consumers don't reinvent "click to open detail." Centralized dialog hosting eliminates the ~13 redundant mount sites identified in ADR-0001.
**Reference impl**: `src/shared/entities/meetings/components/overview-card.tsx` (Root + onClick + DeleteConfirmDialog)
**Enforced by**: convention

### slots-return-null-when-data-missing

Sub-components like `<Phone>`, `<Address>`, `<Owner>` read from context and return `null` when their field is missing. No `showX` boolean props. Consumers compose the slots they want; missing data disappears gracefully.

**Why**: every `showX` prop creates a combinatorial explosion of consumer configs. Null-on-missing-data is automatic and consistent.
**Reference impl**: `src/shared/entities/proposals/components/overview-card.tsx:Status` / `Trade` / `Value`
**Enforced by**: convention

### fields-slot-is-discriminated-union-config

When a slot renders 2+ different field types in a row, use a discriminated-union config array — not boolean props per field.

```ts
type MeetingFieldConfig
  = | { field: 'outcome', variant?: 'badge' | 'dot' }
    | { field: 'scheduledDate', format?: 'full' | 'date-only' | 'time-only' | 'relative' }
    | { field: 'type' }
    | { field: 'proposalCount' }

<MeetingOverviewCard.Fields fields={[
  { field: 'scheduledDate', format: 'relative' },
  { field: 'outcome', variant: 'badge' },
  { field: 'proposalCount' },
]} />
```

Each field type maps to a private render function. Consumers pick which fields appear and in what order without conditional prop blooming.

**Why**: kanban shows a compact set; profile shows a wider set; tables show columns. The same data shape with different render orderings is exactly what a discriminated-union config gives you.
**Reference impl**: `src/shared/entities/meetings/components/overview-card.tsx:MeetingFieldConfig`
**Enforced by**: tsc (discriminated union catches typos)

### compound-export-via-object-assign

```ts
export const MeetingOverviewCard = Object.assign(MeetingOverviewCardRoot, {
  Header, Body, Owner, CustomerName, CreatedAt, Phone, Address,
  Fields, Trades, Proposals, Actions, ContextMenu,
})
```

Consumer API: `<MeetingOverviewCard><MeetingOverviewCard.Header>...</MeetingOverviewCard.Header></MeetingOverviewCard>`.

**Why**: dotted-namespace API reads as one component family without N separate imports. Aligned with shadcn's compound idiom.
**Reference impl**: all entity overview cards
**Enforced by**: convention

### layout-is-consumer-controlled

The Root renders `<div className={className}>{children}</div>` — no built-in card chrome, padding, or border. The consumer decides whether the card is inside a `<Card>`, has padding, etc. This is why the same compound works for kanban (compact), calendar (tiny), profile (full-width with card wrapper).

**Why**: every view context has different layout requirements; baking layout into the compound kills reusability.
**Reference impl**: `MeetingOverviewCardRoot` returns a div with only `className` from props
**Enforced by**: convention

### nested-entity-lists-use-render-props

A card slot that renders nested entities (e.g., `<MeetingOverviewCard.Proposals>`) accepts a `renderItem` (or `renderProposal`) render prop. The default render is a simple row; consumers pass a custom render for their context (e.g., `MeetingProposalRow` in the profile modal which has action menus).

```tsx
<MeetingOverviewCard.Proposals renderProposal={p => <MeetingProposalRow proposal={p} />} />
```

**Why**: nested entity rendering varies more than the parent. Render props delegate without forcing a god-component.
**Reference impl**: `src/shared/entities/meetings/components/overview-card.tsx:Proposals`
**Enforced by**: convention

### actions-slot-plugs-in-entity-action-menu

The Card's `<Actions>` slot renders `<EntityActionMenu>` (or `<EntityViewButton>` for cell-level surfaces). Per [ADR-0001](../adr/0001-entity-action-system.md), `<EntityActionMenu>` reads from the `entityRegistry` and applies CASL via `useAbility()`. Consumers stop mounting their own `<DeleteConfirmDialog />` / `<AssignOwnerDialog />` — `<EntityActionMenu>` owns those internally via Radix Portal.

**Three flat consumer props** on `<EntityActionMenu>` (no nested config object):
- `disableActions={[...]}` — suppress specific actions
- `actionOverrides={{ key: handler }}` — swap a handler for any keyed action
- `customActions={{ ... }}` — append entity-unique actions at the call site

**Why**: action menus are the most-divergent compound surface — strict types in the registry are the only mechanism preventing re-drift.
**Reference impl**: `src/shared/components/entity-actions/ui/entity-action-menu.tsx`; per-entity hook still at `entities/<x>/hooks/use-<x>-action-configs.{ts,tsx}` (being migrated to spec under ADR-0001 issues #171–#175)
**Enforced by**: ADR-0001 + `EntitySpec<E>` types

### list-rendering-uses-entitylist

When rendering multiple entities inside a parent view (participants under a meeting, proposals under a meeting, projects under a customer), use `<EntityList>` with `renderItem` returning the entity's compound card.

```tsx
<EntityList
  title="Proposals"
  icon={FileTextIcon}
  items={proposals}
  getItemKey={(p) => p.id}
  emptyState={{ message: 'No proposals yet.', action: <CreateProposalButton /> }}
  renderItem={(p) => (
    <ProposalOverviewCard proposal={p}>
      <ProposalOverviewCard.Header>…</ProposalOverviewCard.Header>
    </ProposalOverviewCard>
  )}
/>
```

`<EntityList>` owns chrome (header, count, empty state, loading). `renderItem` owns per-entity presentation via the entity's compound. Sibling lists (Participants vs Proposals) inside one detail view feel visually uniform without duplication.

**Variants**: `variant="card"` (default — rounded border + bg + padding; standalone) vs `variant="flush"` (no border, no padding, transparent; for sibling lists under one outer card).

**Why**: list chrome is universal; per-entity content varies. Generic + render prop is the right split.
**Reference impl**: `src/shared/components/entity-list/ui/entity-list.tsx`
**Enforced by**: convention

### parent-enriched-meta-flows-via-context-not-cross-entity-imports

When a parent context (e.g., `<MeetingOverviewCard>`) renders a child entity card (e.g., `<UserOverviewCard>` as a participant), the parent passes situational metadata via the child's `meta` prop — the child does NOT import the parent's context.

```tsx
<UserOverviewCard
  user={participant.user}
  meta={{ role: participant.role, isOwner: participant.role === 'owner' }}
>
  <UserOverviewCard.Avatar />
  <UserOverviewCard.Name />
  <UserOverviewCard.RoleBadge />
</UserOverviewCard>
```

Child sub-components (`<RoleBadge>`) read `meta.role` from their own context. When no `meta` is provided (standalone render), `<RoleBadge>` returns `null`.

**Why**: preserves a one-way dependency direction (`meetings/ → users/`, never the reverse). Keeps the child compound usable standalone without pulling in meeting/proposal concerns.
**Reference impl**: `src/shared/entities/users/components/overview-card.tsx:UserOverviewCardMeta` + meeting's `ParticipantsSlot`
**Enforced by**: convention (cross-entity import direction)

## Future direction — unified EntityClientSpec (open)

Backend has `EntityServerSpec` (ADR-0002) and the action system has `EntitySpec<E>` (ADR-0001). The next architectural step is a **unified `EntityClientSpec`** that declares per entity:

- `defaultIcon` (LucideIcon)
- `defaultColor` (color token for badges / dots)
- `defaultClickHandler` (which modal opens on row click)
- `overviewCard` (reference to the compound component — type-only or import)
- `actions` (the existing `EntitySpec<E>` from ADR-0001)
- `listEmptyState({ entity, viewer })` — empty-state copy per surface
- `field config defaults` — which fields appear in compact vs wide variants

Like the server registry, a static `entityClientRegistry: Record<EntityType, EntityClientSpec>` would make adding a new entity a compile-time forcing function for client rendering.

**Status**: not yet designed. When a third entity-rendering generalization opportunity earns its slot (lists, kanban cards, calendar events being divergent today), promote this to an ADR — `0004-entity-client-system.md`. Until then, the rules above are the canonical contract.

**Trigger to promote**:
- 5th entity gets an overview-card (currently: meetings, proposals, users, lead-sources, customers → if Project, Activity, Note, etc. land)
- A 4th generic primitive (after `<EntityActionMenu>`, `<EntityList>`, `<EntityViewButton>`) needs to read per-entity config
- A consumer feature wants to render "any entity" generically (e.g., universal search results, activity feeds)

## Anti-patterns

- **A family of standalone `UserAvatar` + `UserRow` + `UserAvatarStack` primitives.** Replace with `<UserOverviewCard>` compound + slots.
- **Hand-rolled data interface mirroring the Drizzle select type.** Use `Pick<TEntity, ...>` + `Partial<Pick<...>>`. See [`database-schema.md`](./database-schema.md).
- **Consumer calling `useXActionConfigs` and passing `actions` as a prop.** The Root calls it internally and threads via context.
- **Boolean `showX` props on slots.** Slots return `null` when their data is missing — no consumer-side toggles.
- **Mounting `<DeleteConfirmDialog />` next to a card.** `<EntityActionMenu>` owns its dialogs internally.
- **Adding card chrome (border / padding / `<Card>`) inside the Root.** Layout is consumer-controlled.
- **Child entity card importing the parent's context.** Use the `meta` prop pattern instead.
- **Bypassing `<EntityList>` to render a custom container with header + count + empty state.** Use the primitive and pass `renderItem`.

## See also

- [ADR-0001 — Entity Action System](../adr/0001-entity-action-system.md) — the typed registry that drives `<EntityActionMenu>`
- [ADR-0002 — Entity Server System](../adr/0002-entity-server-system.md) — the backend mirror
- [`frontend-stack.md`](./frontend-stack.md) — one-component-per-file + named-exports + barrel-file rules
- [`database-schema.md`](./database-schema.md) — `Pick<>` + `Partial<Pick<>>` derivation
- `memory/pattern-entity-overview-card.md` — historical reflection on the pattern's discovery
- `memory/feedback-user-overview-card-compound.md` — historical reflection on the User-as-compound decision
- `src/shared/entities/<entity>/components/overview-card.tsx` — per-entity compound implementations
