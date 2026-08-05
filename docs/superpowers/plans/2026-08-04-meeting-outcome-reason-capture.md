# Meeting Outcome Reason Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `cancelled` + `nra` (No Rep Available) meeting outcomes and an auto-derived `additional_work` outcome, require agents to document a reason (stored as a customer note) whenever they set any non-positive outcome, and collapse every outcome-sentiment classification in the codebase onto one canonical constant.

**Architecture:** A single `MEETING_OUTCOME_SENTIMENT` map (co-located with the outcome enum) becomes the sole classifier of positive/neutral/negative/unset. Every color map and sentiment-group list consumes it. A `useOutcomeReason()` hook (mirroring the existing `useConfirm` promise pattern) collects a required reason in a shadcn `Dialog`; a new `meetingsRouter.business.setOutcomeWithReason` procedure sets the outcome and appends the customer note atomically. All three outcome-selection surfaces route through one shared helper. `additional_work` is derived server-side when an `additional-work`-kind proposal is approved.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), TypeScript, shadcn/ui, TanStack Query, `motion/react`.

## Global Constraints

- **No test runner in this repo.** The verification gate for every task is `pnpm tsc` (type-check) + `pnpm lint`. Never run `pnpm build`. UI tasks add a manual browser check. This mirrors the project's `verification-workflow` convention.
- **Package manager: `pnpm`.** Path alias `@/` → `src/`.
- **DB pushes use `pnpm db:push:dev` only.** Prod push (`db:push:prod`) is explicit and out of scope for this plan.
- **Enum value casing:** meeting-outcome enum values are `snake_case` (`converted_to_project`, `lost_to_competitor`). New values follow suit: `cancelled`, `nra`, `additional_work`. (`additional_work` mirrors the proposal `kind: 'additional-work'` semantically; the value itself is snake_case for enum consistency.)
- **Reason is required** for every non-positive, non-`unset` outcome. Sentiment buckets are fixed as: positive = `converted_to_project`, `additional_work`; negative = `not_good`, `pns`, `npns`, `ftd`, `no_show`, `lost_to_competitor`, `cancelled`, `nra`; neutral = `follow_up_needed`, `proposal_created`, `proposal_sent`; unset = `not_set`.
- **`outcomeRequiresReason(o)` = `sentiment === 'negative' || o === 'follow_up_needed'`.** `not_set` and positives never require a reason.
- **Note format:** `Meeting outcome set to "{label}". {reason}` — one `customer_notes` row, `authorId` = session user.
- **Reason modal, not RHF/Zod.** Mirror `useConfirm` (`src/shared/hooks/use-confirm.tsx`) exactly: promise-based, raw `useState`, shadcn `Dialog`/`Textarea`/`Button`. No new form library.
- **Follow the backend three-layer convention:** tRPC → Service/DAL → DB. Services/procedures never inline `db.insert/update`; route through DAL mutations (`addCustomerNote`, `meetingCrud.update`).

---

## File Structure

**Created:**
- `src/shared/hooks/use-outcome-reason.tsx` — reason-capture Dialog hook (sibling of `use-confirm.tsx`).
- `src/trpc/routers/meetings.router/business.router.ts` — meetings business procedures (`setOutcomeWithReason`).

**Modified:**
- `src/shared/constants/enums/meetings.ts` — new enum values + `MEETING_OUTCOME_SENTIMENT` + helpers (`outcomeRequiresReason`, `ATTENTION_OUTCOMES`, `DECIDED_OUTCOMES`).
- `src/shared/db/schema/meta.ts` — (no code change; `meetingOutcomeEnum` reads the array — DB push picks up new values).
- `src/shared/entities/meetings/constants/status-colors.ts` — color maps rebuilt via a sentiment-driven builder + `Record<MeetingOutcome,…>` typing + label fix.
- `src/features/schedule-management/constants/schedule-calendar-config.ts` — `STATUS_BG_TINTS` rebuilt via the same builder.
- `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` — add `cancelled`/`nra` → `rehash`, `additional_work` → `null`.
- `src/features/meeting-flow/constants/meetings-stat-config.ts` — negative-bucket list → `isNegativeOutcome`.
- `src/features/agent-dashboard/dal/server/get-action-queue.ts` — attention list → `ATTENTION_OUTCOMES`.
- `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` — `has_past` SQL list → `DECIDED_OUTCOMES` (fixes `proposal_sent` omission).
- `src/shared/entities/meetings/hooks/use-meeting-actions.ts` — reason-aware outcome setter mutation.
- `src/features/meeting-flow/ui/components/steps/closing-step.tsx`, `src/features/meeting-flow/ui/components/context-panel.tsx`, `src/features/meeting-flow/ui/components/table/index.tsx` — route outcome changes through the reason flow.
- `src/shared/entities/meetings/dal/server/mutations.ts` — `deriveOutcomeOnAdditionalWorkApproved` DAL mutation.
- `src/shared/services/contracts.service.ts` — call the derivation in `applyContractEvent`'s auto-approve branch.

---

### Task 1: Enum values + `MEETING_OUTCOME_SENTIMENT` source of truth

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts`
- DB: `pnpm db:push:dev`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `selectableMeetingOutcomes` now includes `'cancelled'`, `'nra'`.
  - `derivedMeetingOutcomes` now includes `'additional_work'`.
  - `type MeetingOutcomeSentiment = 'positive' | 'neutral' | 'negative' | 'unset'`
  - `MEETING_OUTCOME_SENTIMENT: Record<MeetingOutcome, MeetingOutcomeSentiment>`
  - `isNegativeOutcome(o: MeetingOutcome): boolean`
  - `outcomeRequiresReason(o: MeetingOutcome): boolean`
  - `ATTENTION_OUTCOMES: MeetingOutcome[]`
  - `DECIDED_OUTCOMES: MeetingOutcome[]`

- [ ] **Step 1: Add the two selectable outcomes**

In `src/shared/constants/enums/meetings.ts`, extend `selectableMeetingOutcomes`:

```ts
export const selectableMeetingOutcomes = [
  'not_set',
  'not_good',
  'pns',
  'npns',
  'ftd',
  'no_show',
  'lost_to_competitor',
  'follow_up_needed',
  'cancelled',
  'nra',
] as const
export type SelectableMeetingOutcome = (typeof selectableMeetingOutcomes)[number]
```

- [ ] **Step 2: Add the derived outcome**

```ts
/** Derived outcomes — set automatically, visible but disabled in dropdowns. */
export const derivedMeetingOutcomes = [
  'proposal_created',
  'proposal_sent',
  'converted_to_project',
  'additional_work',
] as const
export type DerivedMeetingOutcome = (typeof derivedMeetingOutcomes)[number]
```

- [ ] **Step 3: Add the sentiment map + helpers**

Append below the `meetingOutcomes` / `MeetingOutcome` declarations:

```ts
export type MeetingOutcomeSentiment = 'positive' | 'neutral' | 'negative' | 'unset'

/**
 * THE canonical classifier for a meeting outcome's sentiment. Every color map,
 * stat bucket, and negative/positive branch in the app derives from this — do
 * not re-encode outcome sentiment anywhere else.
 *
 * - unset:    no decision recorded yet (not_set). Never colored like a neutral
 *             result; never requires a reason.
 * - neutral:  a real, in-progress / non-terminal result (follow-up, proposal
 *             created/sent). Each keeps its own distinct hue.
 * - positive: revenue outcome (new project or additional work).
 * - negative: lost / failed meeting.
 */
export const MEETING_OUTCOME_SENTIMENT: Record<MeetingOutcome, MeetingOutcomeSentiment> = {
  not_set: 'unset',
  follow_up_needed: 'neutral',
  proposal_created: 'neutral',
  proposal_sent: 'neutral',
  converted_to_project: 'positive',
  additional_work: 'positive',
  not_good: 'negative',
  pns: 'negative',
  npns: 'negative',
  ftd: 'negative',
  no_show: 'negative',
  lost_to_competitor: 'negative',
  cancelled: 'negative',
  nra: 'negative',
}

export function isNegativeOutcome(outcome: MeetingOutcome): boolean {
  return MEETING_OUTCOME_SENTIMENT[outcome] === 'negative'
}

/**
 * An agent must document a reason (stored as a customer note) whenever they set
 * a non-positive, decided outcome. That is every negative outcome plus
 * follow_up_needed. not_set (unset) and the positive outcomes never require one.
 */
export function outcomeRequiresReason(outcome: MeetingOutcome): boolean {
  return isNegativeOutcome(outcome) || outcome === 'follow_up_needed'
}

/** Outcomes that flag a meeting as needing agent attention (action queue). */
export const ATTENTION_OUTCOMES: MeetingOutcome[] = meetingOutcomes.filter(outcomeRequiresReason)

/** Outcomes that represent a decided/terminal state (anything but not_set). */
export const DECIDED_OUTCOMES: MeetingOutcome[] = meetingOutcomes.filter(o => o !== 'not_set')
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (Downstream `Record<string,string>` maps still compile at this point because their keys are strings; Task 2/3 re-type them.)

- [ ] **Step 5: Push the enum values to the dev DB**

Run: `pnpm db:push:dev`
Expected: drizzle-kit adds `cancelled`, `nra`, `additional_work` to the `meeting_outcome` pg enum. Confirm the interactive summary lists exactly those three additions and no destructive drops.

- [ ] **Step 6: Commit**

```bash
git add src/shared/constants/enums/meetings.ts
git commit -m "feat(meetings): add cancelled/nra/additional_work outcomes + MEETING_OUTCOME_SENTIMENT source of truth"
```

---

### Task 2: Collapse color maps onto sentiment (DERIVE) + fix typing/label staleness

**Files:**
- Modify: `src/shared/entities/meetings/constants/status-colors.ts`
- Modify: `src/features/schedule-management/constants/schedule-calendar-config.ts`

**Interfaces:**
- Consumes: `MEETING_OUTCOME_SENTIMENT`, `meetingOutcomes`, `MeetingOutcome` from Task 1.
- Produces: `MEETING_LIST_STATUS_COLORS`, `MEETING_OUTCOME_COLORS`, `MEETING_OUTCOME_DOT_COLORS`, `MEETING_OUTCOME_LABELS` (all now `Record<MeetingOutcome, string>`); `STATUS_BG_TINTS: Record<MeetingOutcome, string>`. A local `buildOutcomeColorMap` helper.

- [ ] **Step 1: Add the sentiment-driven builder + rebuild the three color maps**

Replace the three color maps in `src/shared/entities/meetings/constants/status-colors.ts` (`MEETING_LIST_STATUS_COLORS`, `MEETING_OUTCOME_COLORS`, `MEETING_OUTCOME_DOT_COLORS`). Add imports at the top:

```ts
import type { MeetingOutcome } from '@/shared/constants/enums'
import { meetingOutcomes, MEETING_OUTCOME_SENTIMENT } from '@/shared/constants/enums/meetings'
```

Add the builder and maps:

```ts
interface OutcomeColorScheme {
  positive: string
  negative: string
  unset: string
  /** Neutral outcomes each keep a distinct hue, so they are specified per-outcome. */
  neutralByOutcome: Record<'follow_up_needed' | 'proposal_created' | 'proposal_sent', string>
}

/**
 * Builds a complete outcome→className map from a sentiment scheme. Negative,
 * positive, and unset colors come straight from MEETING_OUTCOME_SENTIMENT;
 * neutrals are named individually because they are intentionally different hues.
 * Returning Record<MeetingOutcome,string> makes a missing outcome a compile error.
 */
function buildOutcomeColorMap(scheme: OutcomeColorScheme): Record<MeetingOutcome, string> {
  return Object.fromEntries(
    meetingOutcomes.map((outcome) => {
      const sentiment = MEETING_OUTCOME_SENTIMENT[outcome]
      const color
        = sentiment === 'negative'
          ? scheme.negative
          : sentiment === 'positive'
            ? scheme.positive
            : sentiment === 'unset'
              ? scheme.unset
              : scheme.neutralByOutcome[outcome as keyof OutcomeColorScheme['neutralByOutcome']]
      return [outcome, color]
    }),
  ) as Record<MeetingOutcome, string>
}

// Profile modal badge colors (used with Badge variant="outline")
export const MEETING_LIST_STATUS_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'bg-red-500/10 text-red-600',
  positive: 'bg-green-500/10 text-green-600',
  unset: 'bg-zinc-500/10 text-zinc-600',
  neutralByOutcome: {
    follow_up_needed: 'bg-purple-500/10 text-purple-600',
    proposal_created: 'bg-amber-500/10 text-amber-600',
    proposal_sent: 'bg-lime-500/10 text-lime-600',
  },
})

// Table badge colors (used with StatusDropdownCell default Badge)
export const MEETING_OUTCOME_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'border-red-500/30 bg-red-500/10 text-red-400',
  positive: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  unset: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  neutralByOutcome: {
    follow_up_needed: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    proposal_created: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    proposal_sent: 'border-lime-500/30 bg-lime-500/10 text-lime-400',
  },
})

// Dot colors for status indicators and sub-menu option indicators
export const MEETING_OUTCOME_DOT_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'bg-red-500',
  positive: 'bg-emerald-500',
  unset: 'bg-zinc-500',
  neutralByOutcome: {
    follow_up_needed: 'bg-purple-500',
    proposal_created: 'bg-amber-500',
    proposal_sent: 'bg-lime-500',
  },
})
```

> Note: `converted_to_project` was `green-600` in the list map and `emerald` in the table/dot maps before; the positive scheme above preserves each map's original positive hue and applies the same hue to `additional_work`.

- [ ] **Step 2: Re-type + patch the labels map (staleness fixes)**

Replace `MEETING_OUTCOME_LABELS` (kept explicit — labels are exact text, not sentiment) with a complete `Record<MeetingOutcome,string>`, fixing the `lost_to_competitor` wording and adding the three new labels:

```ts
// Human-readable labels for display
export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
  not_set: 'Not Set',
  converted_to_project: 'Converted to Project',
  additional_work: 'Additional Work',
  proposal_sent: 'Proposal Sent',
  proposal_created: 'Proposal Created',
  follow_up_needed: 'Follow-up Needed',
  not_good: 'Not Good',
  pns: 'PNS',
  npns: 'NPNS',
  ftd: 'FTD',
  no_show: 'No Show',
  lost_to_competitor: 'Lost to Competitor',
  cancelled: 'Cancelled',
  nra: 'NRA',
}
```

- [ ] **Step 3: Rebuild `STATUS_BG_TINTS` via the same sentiment approach**

In `src/features/schedule-management/constants/schedule-calendar-config.ts`, replace the `STATUS_BG_TINTS` object (currently a `Partial<Record<...>>` with only a subset of keys) with a complete map. Add imports:

```ts
import type { MeetingOutcome } from '@/shared/constants/enums'
import { meetingOutcomes, MEETING_OUTCOME_SENTIMENT } from '@/shared/constants/enums/meetings'
```

```ts
const CALENDAR_TINT_BY_SENTIMENT = {
  negative: 'bg-red-500/5 border-red-500/20',
  positive: 'bg-emerald-500/5 border-emerald-500/20',
  unset: 'bg-zinc-500/5 border-zinc-500/20',
} as const

const CALENDAR_TINT_NEUTRAL: Record<'follow_up_needed' | 'proposal_created' | 'proposal_sent', string> = {
  follow_up_needed: 'bg-purple-500/5 border-purple-500/20',
  proposal_created: 'bg-amber-500/5 border-amber-500/20',
  proposal_sent: 'bg-lime-500/5 border-lime-500/20',
}

export const STATUS_BG_TINTS: Record<MeetingOutcome, string> = Object.fromEntries(
  meetingOutcomes.map((outcome) => {
    const sentiment = MEETING_OUTCOME_SENTIMENT[outcome]
    const tint
      = sentiment === 'neutral'
        ? CALENDAR_TINT_NEUTRAL[outcome as keyof typeof CALENDAR_TINT_NEUTRAL]
        : CALENDAR_TINT_BY_SENTIMENT[sentiment]
    return [outcome, tint]
  }),
) as Record<MeetingOutcome, string>
```

> If the original `STATUS_BG_TINTS` intentionally omitted some outcomes (rendered no tint), verify the calendar still looks right — a complete map now tints every outcome. This is the intended behavior (new outcomes must have a tint).

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. The `Record<MeetingOutcome,string>` return types now force every outcome (including the 3 new ones) to be colored — a missing one would fail here.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/meetings/constants/status-colors.ts src/features/schedule-management/constants/schedule-calendar-config.ts
git commit -m "refactor(meetings): drive outcome color maps from MEETING_OUTCOME_SENTIMENT; type as Record<MeetingOutcome>; fix lost_to_competitor label"
```

---

### Task 3: Collapse sentiment-group lists (REPLACE) + pipeline map + fix `has_past` omission

**Files:**
- Modify: `src/features/meeting-flow/constants/meetings-stat-config.ts`
- Modify: `src/features/agent-dashboard/dal/server/get-action-queue.ts`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
- Modify: `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`

**Interfaces:**
- Consumes: `isNegativeOutcome`, `ATTENTION_OUTCOMES`, `DECIDED_OUTCOMES` from Task 1.
- Produces: no new exports; three call sites now read the canonical helpers, and the pipeline map covers the new outcomes.

- [ ] **Step 1: Stat config — negative bucket → helper**

In `src/features/meeting-flow/constants/meetings-stat-config.ts`, replace the hardcoded negative-outcome `.includes(...)` check (the "Not Interested"/not-good stat, ~line 43) with the helper. Add import:

```ts
import { isNegativeOutcome } from '@/shared/constants/enums/meetings'
```

Change the `getValue` predicate from the inline array `.includes(m.meetingOutcome)` to:

```ts
getValue: data => data.filter(m => isNegativeOutcome(m.meetingOutcome)).length,
```

> This intentionally extends the stat to count `cancelled` + `nra` as negative — correct behavior.

- [ ] **Step 2: Action queue — attention list → `ATTENTION_OUTCOMES`**

In `src/features/agent-dashboard/dal/server/get-action-queue.ts` (~line 154), replace the inline `inArray(meetingOutcome, ['follow_up_needed', ...negatives])` array with `ATTENTION_OUTCOMES`. Add import:

```ts
import { ATTENTION_OUTCOMES } from '@/shared/constants/enums/meetings'
```

```ts
inArray(meetings.meetingOutcome, ATTENTION_OUTCOMES)
```

> Verify the surrounding `inArray` column reference matches the file's existing alias (`meetings.meetingOutcome` vs a destructured column). Keep the file's existing style.

- [ ] **Step 3: Pipeline-items `has_past` — decided list → `DECIDED_OUTCOMES` (fixes `proposal_sent` omission)**

In `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (~line 161), the `has_past` SQL currently hardcodes an `IN (...)` list that omits `proposal_sent`. Replace the literal list with a parameterized fragment built from `DECIDED_OUTCOMES`. Add import:

```ts
import { DECIDED_OUTCOMES } from '@/shared/constants/enums/meetings'
```

Build a SQL value list. Using Drizzle's `sql` + `inArray` semantics inside the existing `sql<boolean>` template — replace the inline `IN ('proposal_created', 'converted_to_project', ...)` with a joined placeholder list:

```ts
import { sql } from 'drizzle-orm'
// ...
const decidedList = sql.join(DECIDED_OUTCOMES.map(o => sql`${o}`), sql`, `)
// inside the has_past expression, replace the IN (...) literal with:
//   OR (${meetings.scheduledFor} IS NULL AND ${meetings.meetingOutcome} IN (${decidedList}))
```

Full replacement of the `hasPastMeeting` line:

```ts
hasPastMeeting: sql<boolean>`bool_or(${meetings.scheduledFor} <= now() - interval '2 hours' OR (${meetings.scheduledFor} IS NULL AND ${meetings.meetingOutcome} IN (${sql.join(DECIDED_OUTCOMES.map(o => sql`${o}`), sql`, `)})))`.as('has_past'),
```

> `not_set` remains excluded (an undecided meeting with no schedule is not "past"). All other outcomes — including the previously-missing `proposal_sent` and the new `cancelled`/`nra`/`additional_work` — now count as decided. This is the intended bug fix.

- [ ] **Step 4: Pipeline map — add the three new keys**

In `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`, add entries so every selectable/derived outcome is mapped:

```ts
export const OUTCOME_PIPELINE_MAP: Record<string, MeetingPipeline | null> = {
  not_set: null,
  proposal_created: null,
  proposal_sent: null,
  follow_up_needed: null,
  converted_to_project: null,
  additional_work: null,
  not_good: 'rehash',
  pns: 'rehash',
  npns: 'rehash',
  ftd: 'rehash',
  no_show: 'rehash',
  cancelled: 'rehash',
  nra: 'rehash',
  lost_to_competitor: 'dead',
}
```

> This map keeps its finer split (`lost_to_competitor → 'dead'` vs other negatives → `'rehash'`), so it is NOT collapsed onto sentiment — sentiment (3-way) cannot reproduce it. `cancelled`/`nra` → `'rehash'` per decision.

- [ ] **Step 5: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/constants/meetings-stat-config.ts src/features/agent-dashboard/dal/server/get-action-queue.ts src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/shared/domains/pipelines/lib/outcome-pipeline-map.ts
git commit -m "refactor(meetings): route outcome-group lists through canonical helpers; fix has_past proposal_sent omission; map cancelled/nra/additional_work pipelines"
```

---

### Task 4: `useOutcomeReason()` reason-capture Dialog hook

**Files:**
- Create: `src/shared/hooks/use-outcome-reason.tsx`

**Interfaces:**
- Consumes: `MEETING_OUTCOME_LABELS` (Task 2); shadcn `Dialog`, `Textarea`, `Button`, `Label`.
- Produces:
  - `useOutcomeReason(): [() => JSX.Element, (outcome: MeetingOutcome) => Promise<{ confirmed: boolean, reason: string }>]`
  - Named export `useOutcomeReason` and component `OutcomeReasonDialog`.

- [ ] **Step 1: Write the hook (mirror `use-confirm.tsx`)**

Create `src/shared/hooks/use-outcome-reason.tsx`:

```tsx
'use client'

import type { JSX } from 'react'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

interface PendingReason {
  outcome: MeetingOutcome
  resolve: (value: { confirmed: boolean, reason: string }) => void
}

/**
 * Reason-capture modal for non-positive meeting outcomes. Mirrors useConfirm's
 * promise pattern: requestReason(outcome) resolves once the agent confirms with
 * a non-empty reason or cancels. Reason is required — confirm is disabled until
 * the textarea is non-empty.
 */
export function useOutcomeReason(): [
  () => JSX.Element,
  (outcome: MeetingOutcome) => Promise<{ confirmed: boolean, reason: string }>,
] {
  const [pending, setPending] = useState<PendingReason | null>(null)
  const [reason, setReason] = useState('')

  const requestReason = (outcome: MeetingOutcome) => {
    setReason('')
    return new Promise<{ confirmed: boolean, reason: string }>((resolve) => {
      setPending({ outcome, resolve })
    })
  }

  const handleClose = () => {
    pending?.resolve({ confirmed: false, reason: '' })
    setPending(null)
  }

  const handleConfirm = () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      return
    }
    pending?.resolve({ confirmed: true, reason: trimmed })
    setPending(null)
  }

  const OutcomeReasonDialog = () => (
    <Dialog open={pending !== null} onOpenChange={open => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pending ? `Why "${MEETING_OUTCOME_LABELS[pending.outcome]}"?` : ''}
          </DialogTitle>
          <DialogDescription>
            Add a short note explaining this outcome. It will be saved to the customer's timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="sr-only" htmlFor="outcome-reason">Reason</Label>
          <Textarea
            autoFocus
            className="min-h-[96px] resize-none text-sm"
            id="outcome-reason"
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Homeowner postponed until spring; no rep available for the slot…"
            value={reason}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button onClick={handleClose} variant="outline">Cancel</Button>
          <Button disabled={!reason.trim()} onClick={handleConfirm}>Save outcome</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return [OutcomeReasonDialog, requestReason]
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (Confirm `@/shared/components/ui/textarea` and `label` exist — they are used by `quick-note-input.tsx` and `closing-step.tsx` respectively.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/hooks/use-outcome-reason.tsx
git commit -m "feat(meetings): useOutcomeReason hook — required-reason modal mirroring useConfirm"
```

---

### Task 5: `setOutcomeWithReason` business procedure (outcome + note, atomic)

**Files:**
- Create: `src/trpc/routers/meetings.router/business.router.ts`
- Modify: `src/trpc/routers/meetings.router/index.ts`

**Interfaces:**
- Consumes: `meetingCrud.update`, `addCustomerNote`, `MEETING_OUTCOME_LABELS`, `outcomeRequiresReason`, `selectMeetingSchema` (for the meeting's `customerId`), `EntityToolkit` (`entity.authedProcedure`).
- Produces: `meetingsRouter.business.setOutcomeWithReason` — input `{ meetingId: string, outcome: MeetingOutcome, reason: string }`, returns the updated meeting row.

- [ ] **Step 1: Write the business router**

Create `src/trpc/routers/meetings.router/business.router.ts`, mirroring the customers business-router shape (`createXBusinessRouter(entity)` returning a `createTRPCRouter`):

```ts
import type { EntityToolkit } from '../../lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import z from 'zod'

import { meetingOutcomes, MEETING_OUTCOME_SENTIMENT, outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'
import { addCustomerNote } from '@/shared/entities/customers/dal/server/mutations'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'

import { createTRPCRouter } from '../../init'

export function createMeetingBusinessRouter(entity: EntityToolkit) {
  return createTRPCRouter({
    /**
     * Sets a meeting outcome that requires a documented reason, and appends the
     * reason as a customer note in one call. Routes the outcome write through
     * meetingCrud.update so the entity hooks fire (pipeline derivation +
     * GCal/Ably). The note goes through addCustomerNote (single note write path).
     *
     * Only accepts reason-requiring outcomes; positive/unset outcomes use the
     * generic crud.update path instead.
     */
    setOutcomeWithReason: entity.authedProcedure
      .input(z.object({
        meetingId: z.string().uuid(),
        outcome: z.enum(meetingOutcomes),
        reason: z.string().trim().min(1).max(2000),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!outcomeRequiresReason(input.outcome)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Outcome "${input.outcome}" does not require a reason; use crud.update.`,
          })
        }

        // Look up the meeting's customer for the note (may be null).
        const [row] = await db
          .select({ customerId: meetings.customerId })
          .from(meetings)
          .where(eq(meetings.id, input.meetingId))
          .limit(1)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found.' })
        }

        // 1. Set the outcome through the entity hook chain.
        const updated = dalVerifySuccess(await meetingCrud.update(ctx, {
          id: input.meetingId,
          data: { meetingOutcome: input.outcome },
        }))

        // 2. Append the reason as a customer note (skip if the meeting has no customer).
        if (row.customerId) {
          const label = MEETING_OUTCOME_LABELS[input.outcome]
          const note = await addCustomerNote({
            customerId: row.customerId,
            content: `Meeting outcome set to "${label}". ${input.reason}`,
            authorId: ctx.session.user.id,
          })
          if (!note.success) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Outcome saved but note failed.' })
          }
        }

        return updated
      }),
  })
}
```

> `MEETING_OUTCOME_SENTIMENT` import is only needed if you prefer `isNegativeOutcome`; `outcomeRequiresReason` covers the guard. Remove the unused import if lint flags it.
> Verify `meetingCrud.update` returns a `DalReturn`; `dalVerifySuccess` unwraps it (same pattern as `deriveOutcomeOnProposalSent`). Confirm `entity.authedProcedure`'s `ctx.session.user.id` is available (customers `addNote` uses the same).

- [ ] **Step 2: Register the business router**

In `src/trpc/routers/meetings.router/index.ts`, import and add the `business` key:

```ts
import { createMeetingBusinessRouter } from './business.router'
// ...
return createTRPCRouter({
  crud: createCrudRouter({ /* unchanged */ }),
  reads: createMeetingReadsRouter(entity),
  participants: createParticipantsRouter(entity),
  business: createMeetingBusinessRouter(entity),
})
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. The new procedure appears on the tRPC types as `trpc.meetingsRouter.business.setOutcomeWithReason`.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/meetings.router/business.router.ts src/trpc/routers/meetings.router/index.ts
git commit -m "feat(meetings): setOutcomeWithReason procedure — atomic outcome + customer note"
```

---

### Task 6: Wire the reason flow into all three outcome-selection surfaces

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-actions.ts`
- Modify: `src/features/meeting-flow/ui/components/steps/closing-step.tsx`
- Modify: `src/features/meeting-flow/ui/components/context-panel.tsx`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx`
- Modify: `src/features/meeting-flow/ui/components/table/index.tsx`

**Interfaces:**
- Consumes: `useOutcomeReason` (Task 4), `trpc.meetingsRouter.business.setOutcomeWithReason` (Task 5), `outcomeRequiresReason` (Task 1).
- Produces: `useMeetingActions().setOutcomeWithReason` mutation; a shared `useOutcomeChange` hook that decides plain-update vs reason-modal and renders the dialog.

- [ ] **Step 1: Add the `setOutcomeWithReason` mutation to `useMeetingActions`**

In `src/shared/entities/meetings/hooks/use-meeting-actions.ts`, add a mutation next to `updateOutcome`:

```ts
const setOutcomeWithReason = useMutation(
  trpc.meetingsRouter.business.setOutcomeWithReason.mutationOptions({
    onSuccess: () => {
      invalidateMeeting()
      toast.success('Outcome updated')
    },
    onError: () => toast.error('Failed to update outcome'),
  }),
)

return { deleteMeeting, duplicateMeeting, updateOutcome, updateScheduledFor, setOutcomeWithReason }
```

- [ ] **Step 2: Create a shared `useOutcomeChange` hook**

Create `src/shared/entities/meetings/hooks/use-outcome-change.tsx` so all three surfaces share identical branching:

```tsx
'use client'

import type { JSX } from 'react'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useOutcomeReason } from '@/shared/hooks/use-outcome-reason'

/**
 * Single entry point for changing a meeting's outcome from any surface. If the
 * outcome requires a reason (negative or follow-up), opens the reason modal and
 * routes through setOutcomeWithReason; otherwise does a plain outcome update.
 * Render <OutcomeReasonDialog /> once wherever this hook is used.
 */
export function useOutcomeChange(meetingId: string): {
  changeOutcome: (outcome: MeetingOutcome) => Promise<void>
  OutcomeReasonDialog: () => JSX.Element
} {
  const { updateOutcome, setOutcomeWithReason } = useMeetingActions()
  const [OutcomeReasonDialog, requestReason] = useOutcomeReason()

  const changeOutcome = async (outcome: MeetingOutcome) => {
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

- [ ] **Step 3: Wire the meetings table**

In `src/features/meeting-flow/ui/components/table/index.tsx`, replace the direct `updateOutcome.mutate(...)` in `onUpdateOutcome` with the shared hook. Use `useOutcomeChange` — but the table sets outcomes for many rows, so instantiate per-invocation is not possible with a single meetingId. Instead, in the table, keep using `setOutcomeWithReason`/`updateOutcome` directly but branch on `outcomeRequiresReason`, and render one shared `<OutcomeReasonDialog />`. Concretely, lift the reason modal to the table root:

```tsx
import { outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { useOutcomeReason } from '@/shared/hooks/use-outcome-reason'
// ...
const { updateOutcome, updateScheduledFor, setOutcomeWithReason } = useMeetingActions()
const [OutcomeReasonDialog, requestReason] = useOutcomeReason()
// ...
onUpdateOutcome: async (meetingId: string, outcome: MeetingOutcome) => {
  if (outcomeRequiresReason(outcome)) {
    const { confirmed, reason } = await requestReason(outcome)
    if (!confirmed) return
    setOutcomeWithReason.mutate({ meetingId, outcome, reason })
    return
  }
  updateOutcome.mutate({ id: meetingId, data: { meetingOutcome: outcome } })
},
```

And render `<OutcomeReasonDialog />` once in the table's JSX. (One modal instance is fine — a table cell change resolves the single pending promise before another can start.)

> Verify the `onUpdateOutcome` type in the table's actions object allows an async handler (returns `void | Promise<void>`). If it's typed `=> void`, wrap the async body in an IIFE: `onUpdateOutcome: (id, outcome) => { void handleTableOutcome(id, outcome) }`.

- [ ] **Step 4: Wire the meeting-flow surfaces (closing step + context panel)**

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`, replace `handleOutcomeChange` (which currently calls `updateMeeting.mutate({ data: { meetingOutcome } })`) with the shared hook, and render the dialog once:

```tsx
import { useOutcomeChange } from '@/shared/entities/meetings/hooks/use-outcome-change'
// ...
const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange(meetingId)
const handleOutcomeChange = useCallback((outcome: string) => {
  void changeOutcome(outcome as MeetingOutcome)
}, [changeOutcome])
```

Keep passing `onOutcomeChange={handleOutcomeChange}` to both `<ClosingStep />` and `<ContextPanel />` (unchanged signatures). Render `<OutcomeReasonDialog />` once at the root of the view's JSX (alongside `<ContextPanel />` / `<PersonaProfilePanel />`).

> `ClosingStep` and `ContextPanel` need no internal changes — they already call `onOutcomeChange(value)`. The dialog + branching now live one level up.

- [ ] **Step 5: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Manual browser verification**

Run: `pnpm dev`. Then:
1. Open a meeting flow → Closing step → select **Cancelled** → modal opens → confirm disabled until text entered → type a reason → Save → toast "Outcome updated"; open the customer's timeline → a note `Meeting outcome set to "Cancelled". <reason>` exists.
2. Select **Converted to Project** path (or a positive/unset) → no modal.
3. Repeat via the Context panel select and the Meetings table dropdown → same modal, same note.
4. Cancel the modal → outcome unchanged, no note.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/meetings/hooks/use-meeting-actions.ts src/shared/entities/meetings/hooks/use-outcome-change.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx src/features/meeting-flow/ui/components/table/index.tsx
git commit -m "feat(meetings): require documented reason on non-positive outcomes across all three surfaces"
```

---

### Task 7: Auto-derive `additional_work` on additional-work proposal approval

**Files:**
- Modify: `src/shared/entities/meetings/dal/server/mutations.ts`
- Modify: `src/shared/services/contracts.service.ts`

**Interfaces:**
- Consumes: `meetingCrud.update`, `meetings` schema, proposal `kind`/`meetingId`/`status` (from `applyContractEvent`).
- Produces: `deriveOutcomeOnAdditionalWorkApproved(ctx, { meetingId }): Promise<DalReturn<void>>`.

- [ ] **Step 1: Add the DAL derivation mutation**

In `src/shared/entities/meetings/dal/server/mutations.ts`, add below `deriveOutcomeOnProposalSent`, mirroring its compare-and-set guard:

```ts
const ADDITIONAL_WORK_OVERWRITABLE = ['not_set', 'proposal_created', 'proposal_sent'] as const

/**
 * Flips a meeting's outcome to `additional_work` when an additional-work
 * (upsell) proposal on it is approved/signed. Conditional on the current
 * outcome being in ADDITIONAL_WORK_OVERWRITABLE so it never clobbers a
 * terminal outcome. Routes through meetingCrud.update so entity hooks fire.
 */
export async function deriveOutcomeOnAdditionalWorkApproved(
  ctx: ScopedContext,
  input: { meetingId: string },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ outcome: meetings.meetingOutcome })
      .from(meetings)
      .where(eq(meetings.id, input.meetingId))
      .limit(1)

    if (!row || !(ADDITIONAL_WORK_OVERWRITABLE as readonly string[]).includes(row.outcome)) {
      return
    }

    dalVerifySuccess(await meetingCrud.update(ctx, {
      id: input.meetingId,
      data: { meetingOutcome: 'additional_work' },
    }))
  })
}
```

- [ ] **Step 2: Call it from `applyContractEvent`'s auto-approve branch**

In `src/shared/services/contracts.service.ts`, in `applyContractEvent`, after the proposal is updated with `status: 'approved'` (the `shouldAutoApproveOnContractEvent(event)` branch), derive the outcome when the proposal is additional-work. Add the import:

```ts
import { deriveOutcomeOnAdditionalWorkApproved } from '@/shared/entities/meetings/dal/server/mutations'
```

After step 4's `proposalCrud.update` returns the updated proposal:

```ts
// 4. Update via generic CRUD
const updatedProposal = dalVerifySuccess(await proposalCrud.update(ctx, { id: proposal.id, data: setFields }))

// 5. Additional-work (upsell) proposals derive the meeting's outcome on approval.
if (setFields.status === 'approved' && proposal.kind === 'additional-work' && proposal.meetingId) {
  dalVerifySuccess(await deriveOutcomeOnAdditionalWorkApproved(ctx, { meetingId: proposal.meetingId }))
}

return updatedProposal
```

> `converted_to_project` is unaffected — it is still set by the initial-sale → project conversion path in `projects.router/business.router.ts`. `proposal.kind` and `proposal.meetingId` are on the row fetched at the top of `applyContractEvent`. Confirm `ctx` here is a `ScopedContext` acceptable to `meetingCrud.update` (the webhook path uses a system/scoped context; match whatever `applyContractEvent` already passes to `proposalCrud.update`).

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/dal/server/mutations.ts src/shared/services/contracts.service.ts
git commit -m "feat(meetings): auto-derive additional_work outcome when an additional-work proposal is approved"
```

---

## Self-Review

**Spec coverage:**
- New `cancelled` + `nra` outcomes → Task 1 (enum), Task 2 (labels/colors), Task 3 (pipeline). ✓
- Auto-detected `additional_work` from signed proposal kind → Task 1 (enum) + Task 7 (derivation). ✓
- Reason modal on all non-positive outcomes, required → Task 4 (hook) + Task 6 (wiring) + Task 5 (guard). ✓
- Reuse existing UI (shadcn Dialog/Textarea/Button, `useConfirm` pattern), no new UI → Task 4. ✓
- Reason stored as a customer note describing outcome + description → Task 5 (`setOutcomeWithReason` → `addCustomerNote`). ✓
- Single sentiment source of truth, collapse all call sites → Task 1 (constant) + Tasks 2/3 (DERIVE/REPLACE). ✓
- All three surfaces → Task 6. ✓
- Staleness fixes (`proposal_sent` omission, `Record<string,string>` typing, `lost_to_competitor` label) → Tasks 2/3. ✓

**Placeholder scan:** No TBD/TODO; every code step has concrete code. Repetitive map rows are shown in full. ✓

**Type consistency:** `MEETING_OUTCOME_SENTIMENT`, `outcomeRequiresReason`, `ATTENTION_OUTCOMES`, `DECIDED_OUTCOMES`, `isNegativeOutcome` (Task 1) are consumed with identical names in Tasks 2/3/5/6. `setOutcomeWithReason` input `{ meetingId, outcome, reason }` matches between Task 5 (definition) and Task 6 (callers). `useOutcomeReason` return tuple `[Dialog, requestReason]` matches between Task 4 and Task 6. ✓

## Open verification notes for the implementer
- The `has_past` SQL rewrite (Task 3, Step 3) changes behavior by design (adds `proposal_sent` + new outcomes). If any dashboard count looks off, confirm against the intended "decided = not `not_set`" definition before reverting.
- If `onUpdateOutcome` in the table actions type is strictly `=> void`, use the IIFE wrapper noted in Task 6 Step 3.
- Confirm the context passed to `meetingCrud.update` inside `applyContractEvent` (Task 7) has write capability for meetings; the Zoho webhook path typically runs under a system context.
