# Entity Action System

Every business **Entity** (Customer, Meeting, Proposal, Project, User, future entities) exposes its action menu through a single shared `<EntityActionMenu>` component backed by a compile-time-typed **Entity Registry** mapping entity-type to a strict **Entity Spec**. We chose this over the prior pattern of one hand-written `useXActionConfigs` hook per entity because the four existing hooks (66–168 LoC each) had already drifted into three different implementation patterns despite a shared domain promise that they were "the single source of truth for an entity's available actions" — and convention alone wasn't holding the line.

## Context

The codebase had four `useXActionConfigs` hooks (proposals, meetings, projects, customers) that the glossary called "the single source of truth for an entity's available actions." In practice each hand-rolled its own boilerplate (action-list assembly, mutation wiring, toast handling, `useConfirm` dialogs, override merging) and they had quietly diverged: proposals reached into `useInvalidation` directly, meetings owned internal modal state for assign-owner, projects/meetings delegated to a separate `useXActions` mutations hook, and customers had no mutations layer at all (`delete` was a TODO comment). Adding a fifth entity (User, planned in `entities/users/`) meant another hand-written hook and another shape to maintain.

## Decision

A new **Entity Action System** with three pieces:

1. **`EntitySpec<E>`** — a typed declaration per entity at `entities/<entity>/spec.ts` with four required **Universal CRUD Slots** (`view`, `edit`, `delete`, `duplicate?`) plus a keyed `customActions: Record<string, ...>` for entity-unique actions. Each slot's user-facing label and icon are entity-provided so role consistency holds without forced vocabulary (Meeting's `view` slot renders as "Start" with a play icon; User's `delete` slot renders as "Deactivate").
2. **`entityRegistry`** — a compile-time `Record<EntityType, EntitySpec<...>>` static map. Adding a new entity is a TypeScript-enforced shape: the spec literally won't compile until all four required slots are wired.
3. **`<EntityActionMenu entity entityType disableActions actionOverrides customActions mode />`** — the single consumer entry point. Reads the registry, applies CASL via `useAbility()`, applies the three flat override props, owns its dialogs internally via Radix Portal. The four `useXActionConfigs` hooks are deleted entirely.

## Considered alternatives

- **Toolkit-by-convention** (a `crud.delete(...)` palette + free `actions: [...]` array per entity). Rejected: the existing four hooks were already convention-based and had drifted; types are the only mechanism that prevents re-drift.
- **Module-time `registerEntity('meeting', spec)` calls.** Rejected: registration-order, cyclic-import, and tree-shaking warts. Compile-time map is fully type-checked and statically enumerable.
- **Nested `actions={{ view: { handler }, delete: false, custom: [...] }}` consumer prop.** Rejected: three flat props (`disableActions`, `actionOverrides`, `customActions`) match React idioms and read more clearly at call sites.
- **Role-named slots** (`view` / `primary` / `destroy` / `duplicate?`) instead of verb-named. Rejected: keeping verb names with per-entity label/icon overrides reads more naturally in code while still letting the user-facing vocabulary vary by entity.

## Consequences

- The four `useXActionConfigs` hooks are deleted; ~13 consumer sites stop mounting their own `<DeleteConfirmDialog />` / `<AssignOwnerDialog />`.
- Customer's `delete` mutation must ship with this refactor — strict types refuse to compile the customer spec until `delete` is wired (the existing TODO becomes a forcing function).
- Meeting's `edit` modal must ship with this refactor for the same reason — `start` is now correctly modeled as Meeting's `view` slot, leaving `edit` as a real (not yet implemented) modal that opens the create-meeting form in edit mode.
- Adding a new business entity (e.g. User when its migration lands) is a single spec file plus one line in the registry — no new hook, no consumer-site changes for sites that already use `<EntityActionMenu>`.
