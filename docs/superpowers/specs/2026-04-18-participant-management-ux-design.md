# Participant Management UX Redesign

**Date:** 2026-04-18
**Status:** Draft
**Scope:** Replace the legacy `AssignRepDialog` and `MeetingOwnerSelect` with a participant-aware UX that exposes owner / co-owner / helper semantics introduced by the participants spec (`2026-04-17-meeting-participants-gcal-sync-design.md`).
**Depends on:** `feat/meeting-participants-gcal-sync` branch (merged or open).

## Problem

The current UI treats meeting ownership as a single-rep field:

1. **`MeetingOwnerSelect`** is a `<Select>` dropdown with one slot. Reassigning silently calls `manageParticipants(change_role, owner)`, which auto-demotes the previous owner to co-owner. Users have no awareness of this side effect.
2. **`AssignRepDialog`** is a single-pick modal that uses the same mutation. Same silent demotion.
3. Neither surface can express **co-owner** or **helper** assignment, even though the schema, mutation, and GCal attendee logic all support it.
4. The "swap" semantic is unintentionally destructive in the user's mental model — they expect "Reassign to Oliver" to remove the previous rep, not keep them.

The participant model is fully implemented at the API/data layer. The UI is the only thing blocking real multi-rep meetings.

## Solution Overview

Two coordinated surfaces, both consuming `meetings.manageParticipants`:

1. **Inline owner/co-owner picker** (replaces `MeetingOwnerSelect` and `AssignRepDialog` for the common case)
   - Trigger button shows current owner + co-owner avatars
   - Popover stays open across interactions
   - Top section: static list of currently assigned owner + co-owner with role swap and remove controls
   - Middle: search input
   - Bottom: filtered results (agents not yet selected) with "+ add as co-owner" affordance
   - Footer: helper count + link to the full Manage Participants modal
   - Constraints enforced visually: max 1 owner, max 1 co-owner, min 1 owner

2. **Manage Participants modal** (full management — opened via gear icon next to inline picker, or footer link inside it)
   - Lists all participants with role badges
   - Allows add/remove/role-change for **all three roles** including helpers (no helper limit)
   - Reuses the same `manageParticipants` mutation
   - This is the only surface that exposes helpers

The inline picker handles ~95% of cases (rep swap). The modal exists for the remaining cases (helpers, audit trail, bulk operations later).

## Architecture

### New components

```
src/shared/entities/meetings/components/
  participant-picker/
    participant-picker.tsx              # The trigger + popover wrapper
    participant-picker-trigger.tsx      # Avatar group + names button
    participant-picker-content.tsx      # Popover body (current + search + results + footer)
    current-participant-row.tsx         # Row for an assigned participant
    available-participant-row.tsx       # Row for a search result
    participant-role-icon.tsx           # The crown — filled / outlined states
    use-participant-picker-state.tsx    # Local state hook (search query, optimistic updates)
    index.ts                            # Public entry: exports `ParticipantPicker`

  manage-participants-modal/
    manage-participants-modal.tsx       # Modal shell using BaseModal
    participants-list.tsx               # Full list grouped by role
    add-participant-row.tsx             # Search + add affordance for any role
    index.ts                            # Public entry: exports `ManageParticipantsModal`
```

### Removed / deprecated

- `src/shared/entities/meetings/components/assign-rep-dialog.tsx` — delete
- `src/features/meeting-flow/ui/components/meeting-owner-select.tsx` — delete (currently dead code, no consumers)

### Modified

- `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` — swap `AssignRepDialog` for `ManageParticipantsModal` (the dropdown action is "Manage participants", a deeper interaction than inline pick)
- All four call sites that mounted `AssignRepDialog` get the new `ManageParticipantsModal`:
  - `src/features/meeting-flow/ui/views/meetings-view.tsx`
  - `src/features/schedule-management/ui/views/schedule-view.tsx`
  - `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`
  - `src/features/meeting-flow/ui/components/table/index.tsx`

### New mount points for `ParticipantPicker`

The inline picker is the new "default surface" for participant management. Mount in (priority order):

1. **Meeting detail page** — visible at the top of `MeetingFlowView` (or a new header band). This is the primary place users land when working on a meeting. Today the page has no owner control rendered at all (MeetingOwnerSelect was orphaned).
2. **Meeting cards in pipeline kanban** — replace the static avatar with the picker, so super-admins can reassign without opening a card.
3. **Meeting rows in tables / schedule view** — replace the "Owner" cell display with a compact picker variant (avatars only, name in tooltip).

Picker has two visual variants: `default` (avatars + names + chevron, used on detail page) and `compact` (avatar group + chevron only, used in dense surfaces).

### New tRPC procedure

The router has `manageParticipants` already (from the participants spec). For the picker UI we need one more query:

```ts
// src/trpc/routers/meetings.router.ts
getParticipants: agentProcedure
  .input(z.object({ meetingId: z.string().uuid() }))
  .query(async ({ input }) => {
    return getParticipantsForMeeting(input.meetingId)  // already exists in DAL
  })
```

This returns rows shaped as `{ id, userId, role, userName, userEmail, userImage }` — the picker uses it for both the inline trigger badge and the popover's "Current" section.

### Data flow

```
ParticipantPicker (mounted on meeting detail header)
  ├── useQuery(meetingsRouter.getParticipants)
  ├── useQuery(meetingsRouter.getInternalUsers)        // already exists
  └── useMutation(meetingsRouter.manageParticipants)
       ├── optimistic update on getParticipants cache
       └── invalidate on settle

ManageParticipantsModal
  ├── Same three queries/mutation
  └── Same optimistic pattern
```

## The Inline Picker — detailed spec

### Trigger button

- Renders as a `<Button variant="outline" size="sm">` from shadcn
- Content (left to right):
  - Avatar group (overlapping circles): owner avatar first, co-owner avatar second
  - Text: `"{owner.name} + {coOwner.name}"` or `"{owner.name}"` if no co-owner or `"Unassigned"` if no owner
  - `<ChevronDown className="size-3.5 text-muted-foreground" />`
- Adjacent to the trigger: a separate `<Button variant="outline" size="icon" aria-label="Open full participant manager"><Settings2 /></Button>` that opens the modal directly

### Popover

- Built with **Radix `Popover`** + **shadcn `Command` (cmdk)** — gives focus trap, Escape, ARIA listbox, arrow-key navigation, click-outside, focus return for free
- Width: `min-w-[320px] max-w-[min(420px,calc(100vw-2rem))]`
- `align="start" sideOffset={8} collisionPadding={16}`

### Sections (top to bottom)

#### 1. Current section
- Header: `"Current · {n} of 2 max"` with `tabular-nums`
- One row per current owner + co-owner (helpers are not shown here)
- Row shape:
  ```
  [Avatar] [Name              ]              [Crown] [✕]
           [ROLE TAG · email…]
  ```
- Background: `bg-card`, border: `border-border`, radius `rounded-md`
- Avatar: 24×24, deterministic color from user ID hash
- Name block: two lines, both truncate with ellipsis on overflow
  - Line 1: name, `text-sm font-medium text-foreground`
  - Line 2: `<RoleTag />` + email, both `text-xs text-muted-foreground`
- `<RoleTag />`: small caps, `text-[10px] font-semibold tracking-wide`. Owner = `text-primary`. Co-owner = `text-teal-700 dark:text-teal-400`.
- Crown icon: `<Crown />` from lucide
  - **Owner state**: `bg-primary text-primary-foreground` (or `text-amber-300` if we want the gold tone), padding `p-2`, `rounded-md`. Cursor `default`. Wrapped in `<button disabled aria-label="Already owner — cannot promote self">`.
  - **Co-owner state**: `<button aria-label="Promote {name} to owner — demotes {currentOwner} to co-owner">` with `<Crown className="text-muted-foreground/30" stroke-width={1.5} />`. Hover: `text-primary opacity-100 bg-accent`.
- Remove ✕: `<button aria-label="Remove {name} from this meeting">` with `<X className="size-4" />`. Touch target ≥40px (size-10 wrapper). Hover: `text-destructive bg-destructive/10`.
- Disabled remove (last owner): `<button disabled aria-disabled="true">` with `<X className="opacity-30" />`. Wrap in `<Tooltip>` showing `"Cannot remove — meeting requires at least one owner"`.

#### 2. Search input
- `<CommandInput placeholder="Search team to add…" />` (cmdk's input — no separate `<Input>`)
- Has visually-hidden `<label>` for screen readers

#### 3. Results
- `<CommandList>` containing `<CommandGroup>` of `<CommandItem>`s
- Filters out users already in the Current section
- Each item:
  - Avatar (24px)
  - Name + email (same two-line shape as Current)
  - On hover/focus: row gets `bg-accent`, "+ add as co-owner" pill becomes visible (or alternatively: pill always shown at `opacity-60`, full opacity on hover/focus — final choice up to implementer based on density tests)
- Click → call `manageParticipants({ action: 'add', userId, role: <inferred> })` where role is:
  - `'owner'` if no current owner exists
  - `'co_owner'` otherwise (assuming co-owner slot is free)
  - **disabled** if both slots full → row is dimmed, click is no-op, footer shows hint "Open Manage Participants to add as helper"
- `CommandEmpty`: `"No team members match '{query}'. Open Manage Participants to add by email."`

#### 4. Footer
- Single row, `bg-muted/50`, `border-t`
- Left: `"+ {n} helpers"` text — clickable area when n > 0, opens modal scrolled to helpers section
- Right: `"Manage participants →"` link button — opens modal

### State semantics

| User action | Mutation called | Cache update |
|---|---|---|
| Click outlined crown on co-owner | `change_role(owner)` | Swap roles in cache, GCal updates |
| Click ✕ on owner (when co-owner exists) | `change_role(owner)` on co-owner first, then `remove(originalOwner)` — sequenced | Or use a single new mutation `transferOwnerAndRemove` if the round-trip latency hurts UX |
| Click ✕ on co-owner | `remove(userId)` | Cache: drop row |
| Click result row | `add(userId, role: inferred)` | Cache: insert row in Current |
| Search input | client-side filter only | none |

### Optimistic updates

All mutations use the `onMutate` / `onError` / `onSettled` pattern referenced in [pattern-optimistic-updates.md](pattern-optimistic-updates.md). Optimistic state is rendered immediately; reverts on error with a toast.

### Loading / error states

- **Initial load**: 2 skeleton rows in Current section + skeleton list in Results
- **Mutation in flight**: the affected row gets a subtle `opacity-70` + `pointer-events-none`; the crown/✕ that was clicked shows a `<Loader2 className="size-3 animate-spin" />` overlay
- **Error**: toast via `sonner` with `"Couldn't update participant"` + retry button. Cache reverts.
- **Empty results**: `<CommandEmpty>` message
- **No participants yet** (theoretically possible during create): show "No one assigned yet — search above to add" hint in the Current section

## The Manage Participants Modal — outline

This is the fallback path. Less constrained design than the inline picker.

- Built on `BaseModal` (existing in `src/shared/components/dialogs/`)
- Title: `"Manage participants — {customerName}"` (or `"Manage participants — {n} meetings"` for bulk)
- Body has two stacked sections:
  1. **Current participants** — grouped by role (Owner, Co-owner, Helpers)
     - Each group shows role label + count + max constraint
     - Each row: avatar, name, email, role dropdown (`<Select>` to change role), remove button
  2. **Add a participant** — search input + filtered results, add button per row with role selector defaulted to "helper"
- Footer: `"Done"` button (closes; mutations are immediate, no apply step)
- Bulk mode: when `meetingIds.length > 1`, shows a banner explaining changes apply to all selected meetings; confirms each mutation per meeting

The modal does not need to be perfect in v1 — its job is to expose helper management. The inline picker is the polished surface.

## Accessibility requirements (non-negotiable)

- All interactive elements use semantic HTML (`<button>`, `<input>`, never `<div onClick>`)
- All icon-only buttons have `aria-label`
- Visible `focus-visible` ring on every interactive element (use shadcn ring tokens)
- Keyboard navigation throughout: Tab through trigger → search → results; arrow keys within results; Enter to activate; Escape to close
- Focus moves to search input on open; returns to trigger on close
- Tooltips on disabled controls explain why
- All mutation success/failure toasts use `aria-live="polite"` (sonner does this by default)
- All text passes WCAG AA 4.5:1 contrast (use `text-muted-foreground`, not arbitrary grays)
- All transitions wrapped in `motion-safe:` so `prefers-reduced-motion` users get instant state changes
- Touch targets ≥40px (use larger hit-area wrapper for visually small icons)
- Search input: `text-base` (16px) to prevent iOS zoom; rest of popover content can be `text-sm`/`text-xs`
- Crown icon and lock icon are lucide components, not emojis

## Behavior contracts (mutation invariants — must not regress)

The existing `manageParticipants` mutation already enforces:
- Max 1 owner, max 1 co-owner
- Adding owner when one exists → CONFLICT (use change_role)
- Removing the only owner → auto-reassigns to system owner

This UX must:
- Surface CONFLICT errors to the user as toasts (don't silently swallow)
- Use `change_role` for the "promote co-owner to owner" path (atomic swap)
- Sequence mutations correctly when removing an owner who has a co-owner present (transfer first, then remove — or hold the line and call `remove`, letting the server's auto-reassign-to-system handle it; latter is simpler if we accept a brief flash of "system" as owner)

**Decision needed in implementation**: which sequencing approach for "remove owner when co-owner exists". I recommend the latter (let server auto-reassign) for simplicity; users can always promote the co-owner first if they want surgical control.

## Affected files

### New
- `src/shared/entities/meetings/components/participant-picker/participant-picker.tsx`
- `src/shared/entities/meetings/components/participant-picker/participant-picker-trigger.tsx`
- `src/shared/entities/meetings/components/participant-picker/participant-picker-content.tsx`
- `src/shared/entities/meetings/components/participant-picker/current-participant-row.tsx`
- `src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx`
- `src/shared/entities/meetings/components/participant-picker/participant-role-icon.tsx`
- `src/shared/entities/meetings/components/participant-picker/use-participant-picker-state.tsx`
- `src/shared/entities/meetings/components/participant-picker/index.ts`
- `src/shared/entities/meetings/components/manage-participants-modal/manage-participants-modal.tsx`
- `src/shared/entities/meetings/components/manage-participants-modal/participants-list.tsx`
- `src/shared/entities/meetings/components/manage-participants-modal/add-participant-row.tsx`
- `src/shared/entities/meetings/components/manage-participants-modal/index.ts`

### Modified
- `src/trpc/routers/meetings.router.ts` — add `getParticipants` query
- `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` — swap dialog reference
- `src/features/meeting-flow/ui/views/meetings-view.tsx` — swap dialog reference
- `src/features/schedule-management/ui/views/schedule-view.tsx` — swap dialog reference
- `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` — swap dialog reference
- `src/features/meeting-flow/ui/components/table/index.tsx` — swap dialog reference + use compact picker variant in owner column
- `src/features/meeting-flow/ui/views/meeting-flow.tsx` — mount `ParticipantPicker` (default variant) in the meeting detail header

### Deleted
- `src/shared/entities/meetings/components/assign-rep-dialog.tsx`
- `src/features/meeting-flow/ui/components/meeting-owner-select.tsx`

## Out of scope

- **Bulk participant management** in the inline picker. Bulk stays in the modal.
- **Bug #2** (per-agent calendar naming + super-admin visibility into agent activities) — separate spec.
- **Audit trail UI** ("who assigned Oliver, when?") — future enhancement.
- **Drag-and-drop role swap** — reach-goal, not v1.
- **Mobile-first redesign of the meeting detail page header** — only this component is being swapped, broader page layout untouched.
- **Server-side bulk mutation** — current implementation calls `manageParticipants` per meeting in a loop; acceptable for v1.

## Verification plan

1. **Inline picker — basic flow**
   - Open meeting with owner only → trigger shows owner avatar + "Unassigned" hint
   - Click trigger → popover opens, focus in search
   - Click result row → user is added as co-owner; popover stays open; trigger updates
2. **Role swap**
   - Click outlined crown on co-owner → atomic swap, both rows reorder, GCal attendees unchanged
3. **Remove constraints**
   - Try removing the only owner → ✕ is disabled, tooltip explains
   - Promote co-owner first → owner becomes co-owner → original owner can now be removed
4. **Slots full**
   - With both owner + co-owner set, search a 3rd person → row dimmed, footer shows hint
5. **Modal flow**
   - Click gear button → modal opens with full role-grouped list
   - Add a helper → appears in modal, helper count in inline picker footer increments
   - Remove helper → vanishes, count updates
6. **Accessibility**
   - Tab through entire popover with keyboard only — all controls reachable, focus visible
   - Activate via Enter/Space — works
   - Escape closes popover, focus returns to trigger
   - Screen reader announces role changes ("Oliver Lim, owner" → after swap → "Oliver Lim, co-owner")
   - Reduced motion enabled → no transitions
7. **Error path**
   - Force a `manageParticipants` failure (e.g., disable network) → toast shows, cache reverts, UI consistent
8. **Visual**
   - Light + dark mode tested
   - 360px viewport: popover doesn't overflow
   - Lint + typecheck pass
