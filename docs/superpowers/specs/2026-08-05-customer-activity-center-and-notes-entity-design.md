# Customer Activity Center rebuild + `customer-notes` as a first-class entity

**Status:** Design (awaiting review)
**Date:** 2026-08-05
**Surface:** Customer Profile modal → Overview tab → left "Activity" column (internal CRM, Operate mode)
**Origin:** `/impeccable critique` of the activity center (scored 14/36). Snapshot: `.impeccable/critique/2026-08-06T00-42-35Z__ustomers-components-timeline-customer-timeline-tsx.md`.

---

## 1. Problem

The activity center is a clean-but-hollow read-only feed. The critique's core findings:

- **Dead click-through** — every event carries `entityId`/`entityType`, but nothing is navigable (P0).
- **Notes are impoverished** — no author shown, no edit, no delete, no error handling, no optimistic insert (P1). The composer (`quick-note-input.tsx`) uses raw `useState` and router-wide invalidation.
- **No scanning affordances** — no date grouping, no filtering, no pagination; `proposal_viewed` telemetry buries real milestones (P2).
- **Half-built rail + colors that collide with the app's fixed stage semantics** (P3).

Two architecture problems sit underneath the UX:

1. **Note writes are ad-hoc.** Only `addNote` exists (`business.router.ts` → `addCustomerNote` DAL). There is no update/delete. Hand-coding them would duplicate CRUD that the **Entity Server System** already standardizes.
2. **Security gap (pre-existing).** `addCustomerNote` (`src/shared/entities/customers/dal/server/mutations.ts`) takes bare input with **no scope check** — a scoped agent can attach a note to any `customerId`.

## 2. Goals / non-goals

**Goals**
- Turn `customer_notes` into a **first-class entity** on the Entity Server System, exactly like `applications` (the minimal child-entity exemplar). Generic CRUD replaces all hand-coded note mutations.
- Note edit/delete ride the **standard Entity Action System** (`EntityActionMenu` + action-config hooks), the same infrastructure meetings/customers use.
- Rebuild the timeline UI: click-through, author display, date grouping, filtering, "show earlier", per-event expand, stage-safe colors, aggregated view telemetry.
- Fix the `addCustomerNote` scope gap as a side effect of the migration.
- Fix stale docs/ADRs discovered en route.

**Non-goals**
- No server-paginated notes endpoint — the timeline stays JIT-derived from the existing profile query; "show earlier" is a client-side cap (per `pattern-pagination-toolkit`: toolkit only required for server pagination).
- No `CustomerNoteOverviewCard` compound component — note actions render inline via `EntityActionMenu mode="compact"` on the row (matches the kanban-card precedent).
- No persisted timeline (JIT derivation stays; ADR-0005 JIT default).

## 3. Decisions (resolved with product owner)

| # | Decision |
|---|----------|
| Note authorization | **Author + admins.** Author may edit/delete their own note; super-admin (`manage:all`) may edit/delete any. |
| Density model | **Per-event expand on click + keep an "expand all" toggle.** Navigation moves to an explicit affordance so a row-click can still expand. Row layout reworked. |
| Security gap | **Fix `addCustomerNote` now** — migration to `createCrudDal` + a `create.before` customer-visibility probe closes it. |
| Proposal-event highlight | **Parent meeting row** (reuses the existing `meeting.id` outline-highlight in the meetings list). |
| Note row actions | **`EntityActionMenu mode="compact"` on the row** (not a compound overview card). |
| Docs | **Fix in this pass** — ADR-0001, add-an-entity signature, DOCS migration table. |

## 4. Architecture

### 4.1 New entity — `src/shared/entities/customer-notes/`

Mirrors `applications/`. Schema already exists (`src/shared/db/schema/customer-notes.ts`: `customerNotes`, `insertCustomerNoteSchema`, `selectCustomerNoteSchema`, `CustomerNote`).

**New files**

- `lib/constants.ts` — `export const CUSTOMER_NOTE = 'CustomerNote' as const`
- `lib/visibility.ts` — `customerNoteVisibility({ userId }: VisibilityScope): SQL` that asserts the note's `customerId` is a visible customer, reusing `userCanSeeCustomer` from `customers/dal/server/visibility.ts` (correlated `exists`/predicate on `customerNotes.customerId`). Signature is the **object param** `({ userId, ability })`, per code (not the stale docs).
- `lib/assert-note-author.ts` — pure helper: `assertNoteAuthorOrAdmin(note, ctx)` → throws `ThrowableDalError({ type: 'forbidden' })` unless `note.authorId === ctx.session.user.id || ctx.ability?.can('manage', 'all')`.
- `lib/server-spec.ts` — `customerNoteServerSpec` + `customerNoteSchemas`:
  - `schemas.insert` = `insertCustomerNoteSchema`; `schemas.update` = `insertCustomerNoteSchema.pick({ content: true })` (only `content` mutable — `customerId`/`authorId` immutable).
  - `hooks.create.before(input, ctx)` — probe the target customer via `customerCrud.getById(ctx, { id: input.customerId })`; throw `not-found` if invisible. Also stamp `authorId = ctx.session.user.id` here (session-derived, per layering) rather than trusting client input. **This closes the security gap.**
  - `hooks.update.before(data, ctx, { id })` — `getById` the note, run `assertNoteAuthorOrAdmin`, return `data`.
  - `hooks.delete.before(id, ctx)` — `getById` the note, run `assertNoteAuthorOrAdmin`.
- `dal/server/crud.ts` — `export const customerNoteCrud = createCrudDal(customerNoteServerSpec)`.
- `constants/actions.ts` — `NOTE_ACTIONS` (`edit`, `delete` with `destructive: true`) as `EntityAction` metadata.
- `hooks/use-customer-note-actions.ts` — `useMutation` wrappers over `trpc.customerNotesRouter.crud.{create,update,delete}` with toast + optimistic cache update + precise invalidation via `useInvalidation().cross.customerProfile(customerId)` (the exact query the modal renders). Follows `pattern-optimistic-updates` (`onMutate`/`onError`/`onSettled`).
- `hooks/use-customer-note-action-configs.ts` — binds `NOTE_ACTIONS` to handlers, wires `useConfirm` for delete, exposes an `onEdit` slot, and **gates edit/delete by author-or-admin** on the client (`note.authorId === session user || ability.can('manage','all')`) by conditionally including the configs. Returns `{ actions, DeleteConfirmDialog }`.

**Edited files**

- `src/trpc/routers/customer-notes.router/index.ts` — `createEntityRouter(customerNoteServerSpec, entity => createTRPCRouter({ crud: createCrudRouter({ spec, schemas: { ...customerNoteSchemas, id: z.string().uuid() }, authedProcedure: entity.authedProcedure, shareableProcedure: entity.shareableProcedure }) }))`. No `business.list` — reads stay in the profile query (§4.4).
- `src/trpc/routers/app.ts` — mount `customerNotesRouter` (object shorthand → client path `trpc.customerNotesRouter.*`).
- `src/shared/domains/permissions/abilities.ts` — import `CUSTOMER_NOTE`, add to `ENTITY_NAMES`; grant the `agent` role `read/create/update/delete` on `CustomerNote` (subject-level). Row-ownership narrowing lives in the spec hooks + client configs, **not** CASL (CASL subjects are plain strings here — no per-row conditions). This is a deliberate new grant despite the general "agents get no delete" stance, because notes are user-authored content the author owns; documented in DOCS.md (§4.6).

**Generic CRUD surface obtained for free:** `trpc.customerNotesRouter.crud.create | update | delete | getById | duplicate`, each `ctx.scope`-guarded by `customerNoteVisibility`.

### 4.2 Remove the ad-hoc path (migration)

- Delete `addNote` from `src/trpc/routers/customers.router/business.router.ts`.
- Delete `addCustomerNote` from `src/shared/entities/customers/dal/server/mutations.ts`.
- Repoint the composer → `customerNotesRouter.crud.create` (via `use-customer-note-actions`).
- Repoint the intake note-write (`createFromIntake` → `customer-intake.service.ts`) → `customerNoteCrud.create(SYSTEM_CONTEXT-or-actor-ctx, …)`.
- Grep-sweep any other `addNote`/`addCustomerNote` callers.

### 4.3 Note actions via the Entity Action System

The note timeline row calls `useCustomerNoteActionConfigs({ onEdit })`, renders `<DeleteConfirmDialog />` once, and mounts `<EntityActionMenu entity={note} actions={noteActions} mode="compact" />`.

- **Edit** → the `onEdit` handler flips the row into an inline RHF textarea (edit-in-place) that submits `crud.update`.
- **Delete** → `useConfirm` → `crud.delete`.
- Actions are only present for author-or-admin. Meeting/proposal rows have **no** action menu (read-only pointers); they navigate instead (§4.5).

> **Follows the real code, not ADR-0001** — see §4.6. `EntityActionMenu` props are `{ entity, actions, mode, className }`.

### 4.4 Read path — author display

`get-customer-profile.ts` reads notes as `SELECT *` today. Change to an explicit projection with a null-safe `leftJoin(user)` on `customerNotes.authorId = user.id`, selecting `author name` + `image`. Widen `CustomerProfileData.notes` by deriving from the Drizzle `user` columns + `CustomerNote` (typing-priority: derive, don't hand-mirror). `build-timeline-events.ts` feeds the resolved author into each `note_added` event. `author_id` is nullable (`ON DELETE set null`; system notes) — degrade to no-avatar/"System".

### 4.5 Timeline UI rebuild (`components/timeline/` + `lib/` + `constants/`)

- `lib/build-timeline-events.ts` *(already edited)* — parent `meetingId` on proposal/meeting events, aggregated `proposal_viewed` ("viewed N×", latest drives position), humanized meeting-outcome tokens. Add author into `note_added` events.
- `lib/bucket-timeline-events.ts` *(new, pure)* — group the sorted events into `{ label, events }[]` (Today / Yesterday / `MMM d, yyyy`).
- `constants/timeline-event-config.ts` *(already edited)* — stage-safe colors (neutral + Cobalt only) + `category`.
- `constants/timeline-view.ts` *(new)* — filter-chip definitions + the client page-cap constant (no file-level constants in components — Rule 2).
- `components/timeline/customer-timeline.tsx` *(rebuilt)* — orchestrator: header + **expand-all** toggle, **filter chips**, composer, **date-grouped** list, **"show earlier"** (client cap ~25), shared `EmptyState` with a CTA at the composer. Local state: `expandedIds: Set<string>` (expand-all fills/clears; row-click toggles one), `activeFilter`, `showAll`.
- `components/timeline/timeline-filter-chips.tsx` *(new)* — All / Notes / Meetings / Proposals from `config.category`.
- `components/timeline/timeline-event-item.tsx` *(rebuilt)* — icon becomes a **rail node**; **in-row timestamp** (relative text + absolute via native `title`, dropping the per-row `TooltipProvider`); **row-click toggles `aria-expanded`**; config `label` rendered for SR. Per type:
  - **note** → author avatar + name + time; expanded shows full content + `EntityActionMenu` (edit/delete). Edit = inline RHF textarea.
  - **meeting/proposal** → compact; expanded shows description/metadata + an **"Open in Meetings →"** control (and a hover arrow) that navigates.
- `components/timeline/quick-note-input.tsx` *(rebuilt)* — **RHF + zodResolver** (mirror `content` min 1 / max 2000), Cobalt-primary submit, "Add note", discoverable Cmd/Ctrl+Enter hint, error surfaced, input preserved on failure. Submits via `use-customer-note-actions` → `crud.create` with optimistic insert.

**Navigation wiring** — `customer-profile-modal-content.tsx` lifts `<Tabs>` to **controlled** `value`/`onValueChange` + an `activeHighlightId`. `handleOpenMeeting(meetingId)` sets `tab='meetings'` + highlight, threaded overview → timeline → item. Meetings/Projects lists already outline on `meeting.id` with `outline-2 outline-primary -outline-offset-2` (Rule: highlight-with-outline, not ring). Proposal events carry `metadata.meetingId` → highlight the parent meeting.

### 4.6 Docs & business-rule records

- `src/shared/entities/customers/DOCS.md` (or a new `customer-notes/DOCS.md`) — new rule `note-authorship`: author + admins may edit/delete; note the timeline is JIT-derived, not persisted. Referenced from code by short ID (Rule 29).
- `docs/adr/0001-entity-action-system.md` — amend: the registry/`EntitySpec`/`entityType`-prop design was **not** built; the as-shipped system is toolkit-by-convention (`constants/actions.ts` + `use-*-actions` + `use-*-action-configs` + `<EntityActionMenu entity actions mode />`).
- `docs/how-to/add-an-entity.md` + `src/trpc/DOCS.md` — fix the visibility signature to `({ userId, ability }) => SQL`, client paths to `trpc.<name>Router.crud.*`, and refresh the migration table (16 registered entities, not 1).

## 5. Conventions honored (from the convention audit)

Backend: DAL is the only DB importer (Rule 19); entity owns its mutations (now the note entity does); `createCrudDal`/`createEntityRouter`/`createCrudRouter` factories; `dalToTrpc` bridge; no manual `updatedAt`; no raw `sql NOW()`; child scope via visibility predicate; author-or-admin via spec hooks. Frontend: one component per file, named exports, entity co-location, constants in `constants/`, derivations pure in `lib/`, RHF+Zod composer, `useConfirm` for delete, optimistic 3-callback + precise `getCustomerProfile` invalidation, outline-highlight, controlled shadcn Tabs, `motion/react` for the expand animation (read `feedback-motion-patterns` + `project-sidebar-animation` before writing it).

## 6. Testing

- **DAL/spec hooks:** author-or-admin update/delete (author allowed, non-author blocked, admin allowed); `create.before` rejects an invisible customer; scope predicate blocks CRUD on a note under an invisible customer.
- **Pure lib:** `build-timeline-events` (view aggregation counts + latest-timestamp ordering, parent-meeting mapping, outcome humanization); `bucket-timeline-events` (Today/Yesterday/date boundaries).
- **UI:** composer optimistic insert + error rollback; per-event expand + expand-all interaction; filter + show-earlier; click-through switches tab + outlines the parent meeting; note action menu visibility by author-or-admin.

## 7. Risks / notes

- **`createFromIntake` note-write** currently runs server-side; routing it through `customerNoteCrud.create` must preserve its system-actor semantics (no session user → `authorId` null). Verify `SYSTEM_CONTEXT` passes the `create.before` customer probe (system context is unscoped).
- **`get-customer-profile.ts` is a feature DAL importing `db`** (a known Rule-19 migration exception). Adding the author join in place is tolerated; do not spawn a new `db`-importing feature file.
- **ADR-0001 divergence** is load-bearing: anyone following the ADR literally will build the wrong thing. The amendment is part of this work, not optional.
