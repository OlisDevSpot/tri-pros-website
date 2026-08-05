# Single Outcome-Change Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every meeting-outcome-change surface through the `useOutcomeChange` controller so the reason-capture gate can never be bypassed, and `updateOutcome`/`setOutcomeWithReason` are each called from exactly one place.

**Architecture:** Refactor `useOutcomeChange` to accept `meetingId` per call (not at construction). `useMeetingActionConfigs` owns one controller instance, routes its `setOutcome` action through it, and surfaces `changeOutcome` + `OutcomeReasonDialog` to consumers. The meetings table drops its duplicated inline gate and reuses that shared controller. Config consumers render the returned dialog exactly as they already render `DeleteConfirmDialog`.

**Tech Stack:** React 19, TypeScript, tRPC + TanStack Query, shadcn/ui Dialog.

**Spec:** `docs/superpowers/specs/2026-08-05-outcome-change-single-controller-design.md`

## Global Constraints

- Work directly on `main`. Stage explicitly by path — never `git add -A`.
- Verify with `pnpm tsc` and `pnpm lint` only. NEVER run `pnpm build`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- No behavior change to `setOutcomeWithReason`, the customer-note format, or pipeline staging.
- Reason-gate rule is unchanged and lives only in the controller: `outcomeRequiresReason(outcome)` → reason modal → `setOutcomeWithReason`; otherwise `updateOutcome`.
- Out of scope: disabling derived outcomes (`additional_work`, `converted_to_project`) from manual selection. Do not touch that.

---

### Task 1: Controller takes `meetingId` per call

Refactor `useOutcomeChange` so `meetingId` is a `changeOutcome` argument, then fix its only current consumer (`meeting-flow.tsx`). The meetings table uses `useOutcomeReason` directly (not this hook) and is untouched here.

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-outcome-change.tsx`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx:61,117-119`

**Interfaces:**
- Produces: `useOutcomeChange(): { changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>, OutcomeReasonDialog: () => JSX.Element }`

- [ ] **Step 1: Rewrite the hook to drop the `meetingId` param**

Replace the body of `src/shared/entities/meetings/hooks/use-outcome-change.tsx` (keep the file header comment, imports, and `'use client'`):

```tsx
/**
 * Single entry point for changing a meeting's outcome from any surface. If the
 * outcome requires a reason (negative or follow-up), opens the reason modal and
 * routes through setOutcomeWithReason; otherwise does a plain outcome update.
 * `meetingId` is passed per call so one instance serves rows, cards, and
 * calendar events. Render <OutcomeReasonDialog /> once wherever this hook is used.
 */
export function useOutcomeChange(): {
  changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>
  OutcomeReasonDialog: () => JSX.Element
} {
  const { updateOutcome, setOutcomeWithReason } = useMeetingActions()
  const [OutcomeReasonDialog, requestReason] = useOutcomeReason()

  const changeOutcome = async (meetingId: string, outcome: MeetingOutcome) => {
    if (outcomeRequiresReason(outcome)) {
      const { confirmed, reason } = await requestReason(outcome)
      if (!confirmed) {
        return
      }
      setOutcomeWithReason.mutate({ meetingId, outcome, reason })
      return
    }
    updateOutcome.mutate({ id: meetingId, data: { meetingOutcome: outcome } })
  }

  return { changeOutcome, OutcomeReasonDialog }
}
```

- [ ] **Step 2: Update the meeting-flow view call site**

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`:
- Line 61: `const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange(meetingId)` → `const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange()`
- Lines 117-119: pass `meetingId` at the call:

```tsx
  const handleOutcomeChange = useCallback((outcome: string) => {
    void changeOutcome(meetingId, outcome as MeetingOutcome)
  }, [changeOutcome, meetingId])
```

(The `<OutcomeReasonDialog />` render at line 298 is unchanged.)

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. `useOutcomeChange` now has no callers passing a construction-time `meetingId`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/hooks/use-outcome-change.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx
git commit -m "refactor(meetings): useOutcomeChange takes meetingId per call

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Route all config-driven surfaces through the controller

`useMeetingActionConfigs` calls `useOutcomeChange()`, routes its `setOutcome` action through `changeOutcome`, and returns `changeOutcome` + `OutcomeReasonDialog`. All three consumers adopt it: the meetings table drops its inline gate and shares the dialog; the overview card and schedule view render the dialog. This closes the entity-action bypass on every surface at once — no transient broken state.

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`
- Modify: `src/features/meeting-flow/ui/components/table/index.tsx`
- Modify: `src/shared/entities/meetings/components/overview-card.tsx:116,152-155`
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx:98,159`

**Interfaces:**
- Consumes: `useOutcomeChange()` from Task 1.
- Produces: `useMeetingActionConfigs(...)` return type gains `changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>` and `OutcomeReasonDialog: () => JSX.Element`.

- [ ] **Step 1: Wire the controller into `useMeetingActionConfigs`**

In `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`:

1. Add the import:

```tsx
import { useOutcomeChange } from './use-outcome-change'
```

2. In `useMeetingActionConfigs`, drop `updateOutcome` from the `useMeetingActions()` destructure and add the controller. Change line 76 from:

```tsx
  const { deleteMeeting, duplicateMeeting, updateOutcome } = useMeetingActions()
```

to:

```tsx
  const { deleteMeeting, duplicateMeeting } = useMeetingActions()
  const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange()
```

3. Replace the `setOutcome` action config (lines 118-127) so `onSelect` routes through the controller and `isLoading` is dropped (the controller owns its own mutation state):

```tsx
      {
        action: MEETING_ACTIONS.setOutcome,
        type: 'select' as const,
        options: MEETING_OUTCOME_OPTIONS,
        getCurrentValue: (entity: T) => entity.meetingOutcome ?? 'not_set',
        onSelect: (entity: T, value: string) => {
          void changeOutcome(entity.id, value as MeetingOutcome)
        },
      },
```

4. Update the `actions` `useMemo` dependency array: remove `updateOutcome`, add `changeOutcome`.

5. Update the result type `MeetingActionConfigsResult<T>` and the return statement to include the two new fields:

```tsx
interface MeetingActionConfigsResult<T extends MeetingEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
  AssignOwnerDialog: () => JSX.Element
  OutcomeReasonDialog: () => JSX.Element
  changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>
}
```

```tsx
  return { actions, DeleteConfirmDialog, AssignOwnerDialog, OutcomeReasonDialog, changeOutcome }
```

- [ ] **Step 2: Collapse the meetings table onto the shared controller**

In `src/features/meeting-flow/ui/components/table/index.tsx`:

1. Remove the now-unused imports and mutations:
   - Delete the `import { useOutcomeReason } from '@/shared/hooks/use-outcome-reason'` line (29).
   - Delete the `import { outcomeRequiresReason } from '@/shared/constants/enums/meetings'` line (20).
   - Line 37: `const { updateOutcome, updateScheduledFor, setOutcomeWithReason } = useMeetingActions()` → `const { updateScheduledFor } = useMeetingActions()`.
   - Delete line 38: `const [OutcomeReasonDialog, requestReason] = useOutcomeReason()`.

2. Delete the entire `handleTableOutcome` callback (lines 69-79).

3. Destructure the shared controller from the existing `useMeetingActionConfigs` call (lines 81-85):

```tsx
  const { actions: sharedActions, DeleteConfirmDialog, OutcomeReasonDialog, changeOutcome } = useMeetingActionConfigs<MeetingRow>({
    onView: handleView,
    onAssignOwner: handleAssignOwner,
    onAssignProject: handleAssignProject,
  })
```

4. Point the column's `onUpdateOutcome` at the shared controller (in the `meta` `useMemo`, replacing the `handleTableOutcome` call):

```tsx
    onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => {
      void changeOutcome(meetingId, outcome)
    },
```

Update that `useMemo`'s dependency array: replace `handleTableOutcome` with `changeOutcome`.

5. The `<OutcomeReasonDialog />` render at line 106 stays — it now comes from `useMeetingActionConfigs` instead of the deleted local `useOutcomeReason`. No JSX change needed.

- [ ] **Step 3: Render the dialog in the overview card**

In `src/shared/entities/meetings/components/overview-card.tsx`:
- Line 116: add `OutcomeReasonDialog` to the destructure:

```tsx
  const { actions, DeleteConfirmDialog, AssignOwnerDialog, OutcomeReasonDialog } = useMeetingActionConfigs({
```

- Render it beside the other dialogs (after line 154 `<DeleteConfirmDialog />`):

```tsx
      <DeleteConfirmDialog />
      <AssignOwnerDialog />
      <OutcomeReasonDialog />
```

- [ ] **Step 4: Render the dialog in the schedule view**

In `src/features/schedule-management/ui/views/schedule-view.tsx`:
- Line 98: add the dialog to the destructure:

```tsx
  const { actions: meetingActions, DeleteConfirmDialog: CalendarDeleteDialog, OutcomeReasonDialog } = useMeetingActionConfigs<ScheduleCalendarEvent>({
```

- Render it next to `<CalendarDeleteDialog />` (line 159):

```tsx
      <CalendarDeleteDialog />
      <OutcomeReasonDialog />
```

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. Confirm no remaining direct outcome mutation outside the controller:

Run: `grep -rn "updateOutcome" src/features src/shared/entities/meetings/components src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`
Expected: no matches (the only `updateOutcome` reference left is inside `use-outcome-change.tsx` and its definition in `use-meeting-actions.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/features/meeting-flow/ui/components/table/index.tsx src/shared/entities/meetings/components/overview-card.tsx src/features/schedule-management/ui/views/schedule-view.tsx
git commit -m "refactor(meetings): route every outcome surface through useOutcomeChange

Entity-action 'Set Outcome' no longer bypasses the reason gate; table drops
its duplicated inline gate and shares one controller + dialog with the row
action menu.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Document the single-caller invariant

Record the rule so a future direct call is a documented violation.

**Files:**
- Modify: `src/shared/entities/meetings/DOCS.md` (add a rule under `## Rules`, after `### outcome-flips-on-proposal-sent`)

- [ ] **Step 1: Add the invariant rule**

In `src/shared/entities/meetings/DOCS.md`, add a new rule anchor in the `## Rules` section:

```markdown
### outcome-change-single-controller

All meeting-outcome changes go through `useOutcomeChange` (`hooks/use-outcome-change.tsx`) — the ONE controller that applies the reason gate (`outcomeRequiresReason` → reason modal → `setOutcomeWithReason`; else `updateOutcome`). `updateOutcome`/`setOutcomeWithReason` are never called for an outcome change outside that controller. Config-driven surfaces get it via `useMeetingActionConfigs`, which owns one instance and returns `changeOutcome` + `OutcomeReasonDialog`; consumers render the dialog like they render `DeleteConfirmDialog`. Adding a direct `updateOutcome.mutate` at a call site is the bypass this rule exists to prevent.
```

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: PASS (markdown only; no code change).

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/meetings/DOCS.md
git commit -m "docs(meetings): document outcome-change single-controller invariant

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** controller refactor (Task 1), bypass fix + table collapse + all three consumers (Task 2), single-caller invariant doc (Task 3) — all spec items covered. Manual-verification steps from the spec are the acceptance test run after Task 2.

**Placeholder scan:** none — every step carries exact code and exact line anchors.

**Type consistency:** `changeOutcome(meetingId, outcome)` signature is identical across the controller (Task 1), the config hook return (Task 2), and every call site. `OutcomeReasonDialog: () => JSX.Element` matches the existing `useOutcomeReason` return element type.
