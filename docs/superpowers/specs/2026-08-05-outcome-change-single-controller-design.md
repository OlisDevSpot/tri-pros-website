# Single Outcome-Change Controller — Design

**Date:** 2026-08-05
**Status:** Approved, ready for planning
**Related:** `project-meeting-outcome-sentiment` memory · `docs/superpowers/plans/2026-08-04-meeting-outcome-reason-capture.md`

## Problem

Setting a meeting's outcome must always route through the reason gate: a
non-positive outcome (`outcomeRequiresReason` = negatives ∪ `follow_up_needed`)
opens the reason modal and persists via `setOutcomeWithReason` (outcome + a
customer note, atomically); every other outcome does a plain `updateOutcome`.

A canonical controller already exists — `useOutcomeChange(meetingId)` in
`src/shared/entities/meetings/hooks/use-outcome-change.tsx` — but it is
inconsistently adopted. One surface bypasses it entirely and another
re-implements its gate logic inline:

| Surface | Path today | Gated? |
|---|---|---|
| Meeting-flow closing step | `changeOutcome` (canonical hook) | ✅ |
| Meeting-flow context panel | `changeOutcome` (canonical hook) | ✅ |
| Meetings table **column** | inline `handleTableOutcome` (duplicated gate) | ✅ but ad-hoc |
| Entity-action menu **"Set Outcome"** | `updateOutcome.mutate` **direct** | ❌ bypass |

The bypass lives in `use-meeting-action-configs.tsx` (the `setOutcome` select
action's `onSelect`). That action menu is rendered in **three** surfaces —
the customer-profile meeting overview card, the meetings-table row menu, and
the schedule calendar — so the leak is systemic, not limited to the profile.

**Root cause:** `useOutcomeChange(meetingId)` binds a single `meetingId` at
construction. Config-driven actions operate on an arbitrary entity per
invocation (`onSelect(entity, value)`), so they cannot use the per-meeting
hook and reach for the raw mutation instead.

## Goal

Every surface that changes a meeting outcome funnels through one controller.
After this change, `updateOutcome.mutate` and `setOutcomeWithReason.mutate`
(for outcome changes) are called from **exactly one place** — inside
`useOutcomeChange`. Any future direct call is a documented violation.

## The change

### 1. Controller takes `meetingId` per call

`useOutcomeChange` stops binding `meetingId` at construction:

```ts
// before
const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange(meetingId)
await changeOutcome(outcome)

// after
const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange()
await changeOutcome(meetingId, outcome)
```

Internals are otherwise unchanged: `outcomeRequiresReason(outcome)` → open
reason modal → `setOutcomeWithReason.mutate({ meetingId, outcome, reason })`;
otherwise `updateOutcome.mutate({ id: meetingId, data: { meetingOutcome } })`.

### 2. `useMeetingActionConfigs` is the aggregation point

It already owns action-scoped dialogs consumers render (`DeleteConfirmDialog`,
`AssignOwnerDialog`). It calls `useOutcomeChange()` internally and:

- `setOutcome` action's `onSelect` → `void changeOutcome(entity.id, value as MeetingOutcome)` (removes the direct `updateOutcome.mutate`)
- return type grows by `{ changeOutcome, OutcomeReasonDialog }`

Sharing one controller instance means the table's outcome **column** and its
row **action menu** resolve against the same reason dialog.

### 3. Per-surface wiring

| File | Change |
|---|---|
| `src/shared/entities/meetings/hooks/use-outcome-change.tsx` | signature → `changeOutcome(meetingId, outcome)`; drop the `meetingId` param |
| `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` | call `useOutcomeChange()`; route `setOutcome.onSelect` through it; return `changeOutcome` + `OutcomeReasonDialog`; drop `updateOutcome` usage |
| `src/features/meeting-flow/ui/components/table/index.tsx` | delete inline `handleTableOutcome` + local `useOutcomeReason()`; take `changeOutcome`/`OutcomeReasonDialog` from `useMeetingActionConfigs`; `meta.onUpdateOutcome` → `void changeOutcome(meetingId, outcome)`; render `<OutcomeReasonDialog/>` |
| `src/shared/entities/meetings/components/overview-card.tsx` | render `<OutcomeReasonDialog/>` beside `<DeleteConfirmDialog/>` |
| `src/features/schedule-management/ui/views/schedule-view.tsx` | render `<OutcomeReasonDialog/>` |
| `src/features/meeting-flow/ui/views/meeting-flow.tsx` | `useOutcomeChange()` + `changeOutcome(meetingId, outcome)` at the call site |

`meeting-flow.tsx` does not consume `useMeetingActionConfigs`, so it keeps its
own `useOutcomeChange()` instance — the controller is reusable by design.

## Non-goals

- Disabling derived outcomes (`additional_work`, `converted_to_project`) from
  manual selection in the entity-action select and the context panel. That is
  a distinct disabled-option concern, tracked as a separate follow-up.
- Any change to `setOutcomeWithReason`, the note format, or pipeline staging.

## Testing

No unit-test infrastructure exists for these hooks; verification is
`pnpm tsc` + `pnpm lint` (both must pass) plus a manual pass on each surface:

1. Customer-profile meetings tab → row "⋯" → **Set Outcome** → pick a negative
   (e.g. Cancelled) → the reason modal appears; saving writes the customer note.
2. Same from the schedule calendar event menu.
3. Same from the meetings-table row "⋯" menu **and** its inline outcome column —
   both open the one shared dialog.
4. A positive/neutral-only outcome (e.g. `proposal_created`) skips the modal.

## Invariant to document

Add to `src/shared/entities/meetings/` business docs: *outcome changes go
through `useOutcomeChange` only; `updateOutcome`/`setOutcomeWithReason` are
never called for an outcome change outside that controller.*
