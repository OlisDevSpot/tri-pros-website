# Meeting Reschedule + Outcome Completion (Epic 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `reschedule_needed` outcome, a first-class Reschedule meeting action (cancel-and-rebook with a note), a GCal-on-cancel cleanup hook, a per-action disabled-reason capability, and a fresh-pipeline Reschedule column.

**Architecture:** All server orchestration lives in the `meetings.business` tRPC router composing existing DAL blocks (no service, no composite DAL wrappers). The outcome layer derives everything from the single `MEETING_OUTCOME_SENTIMENT` classifier plus one new orthogonal classifier `DID_NOT_OCCUR_OUTCOMES`. UI reuses the entity-action + promise-modal patterns.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), TanStack Query, React, Tailwind v4, shadcn/ui, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-04-meeting-reschedule-and-outcomes-design.md` (decisions D1–D9). Master epic: `docs/superpowers/specs/2026-09-09-meeting-schedule-overhaul-master-epic.md`.

## Global Constraints

- **No test runner exists in this app.** Do NOT add one. Each task verifies with `pnpm tsc` (type-check, `tsc --noEmit`) + `pnpm lint`, plus the manual runtime check named in the task. Never run `pnpm build`.
- **Work on main; stage by path.** Use `git add <explicit paths>`, never `git add -A`. End every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **DB pushes:** dev = `pnpm db:push:dev`. Prod = `pnpm db:push:prod`, ONLY at Task 11 with explicit user go.
- **Single-source rules (from spec):** outcome sentiment lives only in `MEETING_OUTCOME_SENTIMENT`; reschedulability only in `DID_NOT_OCCUR_OUTCOMES`/`canRescheduleFromOutcome`; customer notes only via `customerNoteCrud.create`; LA-tz short date only via `formatMeetingDateShort`. Do not re-encode any of these inline.
- **Outcome value casing:** the new outcome literal is exactly `reschedule_needed`; the new pipeline stage literal is exactly `reschedule`.

---

## Task 1: Add `reschedule_needed` outcome + classifiers + label + pipeline map

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts`
- Modify: `src/shared/entities/meetings/constants/status-colors.ts`
- Modify: `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`

**Interfaces:**
- Produces: `reschedule_needed` ∈ `MeetingOutcome`; `DID_NOT_OCCUR_OUTCOMES: readonly MeetingOutcome[]`; `canRescheduleFromOutcome(outcome: MeetingOutcome): boolean`.

- [ ] **Step 1: Add `reschedule_needed` to `selectableMeetingOutcomes`** (keep it adjacent to `follow_up_needed` so the neutral block stays contiguous).

In `src/shared/constants/enums/meetings.ts`, change the `selectableMeetingOutcomes` array (currently lines 38–49) so its tail reads:

```ts
  'cancelled',
  'nra',
  'follow_up_needed',
  'reschedule_needed',
] as const
```

- [ ] **Step 2: Classify it neutral in `MEETING_OUTCOME_SENTIMENT`.**

In the same file, add the entry to `MEETING_OUTCOME_SENTIMENT` (right after `follow_up_needed`):

```ts
  follow_up_needed: 'neutral',
  reschedule_needed: 'neutral',
```

- [ ] **Step 3: Extend `outcomeRequiresReason` to include it.**

Replace the body of `outcomeRequiresReason`:

```ts
export function outcomeRequiresReason(outcome: MeetingOutcome): boolean {
  return isNegativeOutcome(outcome) || outcome === 'follow_up_needed' || outcome === 'reschedule_needed'
}
```

- [ ] **Step 4: Add the reschedulability classifier** at the end of the outcome section (after `LIVE_MEETING_OUTCOMES`, ~line 121):

```ts
/**
 * Outcomes where the meeting did NOT physically occur — the only states a
 * Reschedule (cancel-and-rebook) may start from. Orthogonal to sentiment: it
 * cuts across unset / neutral / negative, so it cannot derive from the
 * sentiment map. Single source for the UI action gate AND the server guard.
 */
export const DID_NOT_OCCUR_OUTCOMES = [
  'not_set',
  'reschedule_needed',
  'no_show',
  'cancelled',
] as const satisfies readonly MeetingOutcome[]

export function canRescheduleFromOutcome(outcome: MeetingOutcome): boolean {
  return (DID_NOT_OCCUR_OUTCOMES as readonly MeetingOutcome[]).includes(outcome)
}
```

- [ ] **Step 5: Add the display label** in `src/shared/entities/meetings/constants/status-colors.ts` `MEETING_OUTCOME_LABELS` (after `follow_up_needed`, ~line 57):

```ts
  follow_up_needed: 'Follow-up Needed',
  reschedule_needed: 'Reschedule Needed',
```

(No color-map edits — `buildOutcomeColorMap` derives yellow/neutral automatically.)

- [ ] **Step 6: Add the pipeline mapping** in `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` `OUTCOME_PIPELINE_MAP` (this map is `Record<string,…>`, so it is NOT a compile error if omitted — add it explicitly):

```ts
  follow_up_needed: null,
  reschedule_needed: null,
```

- [ ] **Step 7: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (The `Record<MeetingOutcome,…>` maps `MEETING_OUTCOME_SENTIMENT` and `MEETING_OUTCOME_LABELS` would fail to compile if Steps 2/5 were missed — this is the safety net.)

- [ ] **Step 8: Push the enum value to the dev DB.**

Run: `pnpm db:push:dev`
Expected: drizzle adds `reschedule_needed` to the `meeting_outcome` enum (the pgEnum regenerates from `meetingOutcomes`). Confirm the push reports the enum change and completes without wanting to recreate the type.

- [ ] **Step 9: Manual check.**

Start `pnpm dev`, open any meeting's outcome dropdown (overview card or meetings table). Expected: "Reschedule Needed" appears in the list, rendered amber/yellow like "Follow-up Needed"; selecting it opens the reason modal (because it's reason-gated).

- [ ] **Step 10: Commit.**

```bash
git add src/shared/constants/enums/meetings.ts src/shared/entities/meetings/constants/status-colors.ts src/shared/domains/pipelines/lib/outcome-pipeline-map.ts
git commit -m "feat(meetings): add reschedule_needed outcome + reschedulability classifier

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Document `cancelled`=archived + fix stale `sales_agent` role + service-orchestration note

**Files:**
- Modify: `src/shared/entities/meetings/DOCS.md`
- Modify: `docs/codebase-conventions/service-architecture.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Read the two docs** so edits land in the right sections.

Run: `sed -n '1,80p' src/shared/entities/meetings/DOCS.md` and locate the participant-roles section (mentions `sales_agent`, ~lines 24/47/63–66/191) and the outcomes section.

- [ ] **Step 2: Fix the stale `sales_agent` wording.** Replace every `sales_agent` reference in `src/shared/entities/meetings/DOCS.md` with the real model: participant roles are `owner` / `co_owner` / `helper`; the primary rep is the `owner` participant; meeting write capability comes from the CASL `agent` role (`can('read'|'create'|'update'|'own','Meeting')`), not a participant role. Preserve the surrounding invariants (owner-implicitly-fills-roles for non-system owners, system account not a person).

- [ ] **Step 3: Document the `cancelled` = archived meaning.** In the outcomes section of `src/shared/entities/meetings/DOCS.md`, add (under a `#outcome-cancelled-means-archived` slug):

```markdown
### outcome-cancelled-means-archived
`cancelled` canonically means **archived**: the meeting did not happen and is
not currently being rescheduled, but the record is kept. It is negative
sentiment and maps to the `rehash` pipeline (customer returns to the recall
pool). Distinguish from `no_show` — the customer failed to appear at the
scheduled time — which is also negative/rehash but records a different fact.
Setting an outcome to `cancelled` removes the meeting's Google Calendar event
(the meeting row is preserved); see `#gcal-removed-on-cancel`.
```

- [ ] **Step 4: Document the reschedule contract.** Add (slug `#reschedule-cancels-and-rebooks`):

```markdown
### reschedule-cancels-and-rebooks
The Reschedule action (`meetingsRouter.business.rescheduleMeeting`) keeps the
original meeting and sets it to `cancelled`, then books a NEW meeting at the new
time copying the original's owner + all participants + customer + project +
type (outcome resets to `not_set`), and posts one customer note. Available only
from `DID_NOT_OCCUR_OUTCOMES` (`canRescheduleFromOutcome`) so a meeting that
already happened can never have its disposition clobbered.
```

- [ ] **Step 5: Add the service-orchestration clarification** in `docs/codebase-conventions/service-architecture.md`. Find the "orchestrates business logic → internal service" line (~line 21) and append a clause:

```markdown
- **No, but it orchestrates business logic** → **internal service** (`services/<x>.service.ts`) **when it coordinates a provider/external system or cross-cutting infra**. Pure entity-CRUD flows (compose entity CRUD + notes/participants, no external coordination) orchestrate in the **tRPC router** instead — e.g. `meetings.business.setOutcomeWithReason` / `rescheduleMeeting`.
```

- [ ] **Step 6: Lint (markdown is skipped by tsc; run lint for consistency) + commit.**

```bash
pnpm lint
git add src/shared/entities/meetings/DOCS.md docs/codebase-conventions/service-architecture.md
git commit -m "docs(meetings): cancelled=archived + reschedule contract; fix stale sales_agent role; clarify router-orchestration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Remove the GCal event on the `cancelled` transition (meetingCrud hook)

**Files:**
- Modify: `src/shared/entities/meetings/dal/server/crud.ts` (the `update.after` hook, ~lines 114–147)

**Interfaces:**
- Consumes: `meta.previousRow` (prefetched by the engine for update-after), `deleteMeetingEventJob` (already imported).
- Produces: invariant — a meeting transitioning to `meetingOutcome === 'cancelled'` has its GCal event deleted and its `gcal*` linkage fields cleared.

- [ ] **Step 1: Add `db`, `meetings`, `eq` imports** at the top of `src/shared/entities/meetings/dal/server/crud.ts` (they are not currently imported):

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'
```

- [ ] **Step 2: Add the cancelled-transition branch** inside the `update.after` hook, after the existing `ably.channels…publish(...)` call (end of the hook body, ~line 146), so it runs on every update:

```ts
        // GCal-removed-on-cancel: a meeting whose outcome BECOMES `cancelled`
        // (any path — Reschedule action or a direct "Cancelled" selection) is no
        // longer on the shared calendar; the row is kept. The gcalEventId null
        // guard + one-time transition check prevent re-dispatch. see ../../DOCS.md#gcal-removed-on-cancel
        if (
          previousRow.meetingOutcome !== 'cancelled'
          && row.meetingOutcome === 'cancelled'
          && row.gcalEventId
        ) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
          await db.update(meetings)
            .set({ gcalEventId: null, gcalEtag: null, gcalSyncedAt: null })
            .where(eq(meetings.id, row.id))
        }
```

(`previousRow` is already destructured at the top of the hook: `const { previousRow, input: data } = meta`.)

- [ ] **Step 3: Add a DOCS slug for the invariant** in `src/shared/entities/meetings/DOCS.md` (slug `#gcal-removed-on-cancel`) so the in-code `see` ref resolves:

```markdown
### gcal-removed-on-cancel
When a meeting's `meetingOutcome` transitions to `cancelled`, the `update.after`
hook dispatches `deleteMeetingEventJob` for its `gcalEventId` and clears the
`gcalEventId`/`gcalEtag`/`gcalSyncedAt` fields on the row. The row itself is
preserved. `no_show` is intentionally NOT treated this way (its event is already
in the past). The one-time transition guard + gcalEventId null-check prevent
re-dispatch.
```

- [ ] **Step 4: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Manual check (requires QStash tunnel).**

Run `pnpm dev:mobile` (QStash hooks need the tunnel — see memory `feedback-qstash-hooks-need-tunnel`). Create a meeting that syncs to GCal (has `scheduledFor`), confirm its event exists on the info@ calendar, then set its outcome to "Cancelled" (provide the required reason). Expected: the calendar event disappears; re-querying the meeting row shows `gcalEventId = null`. Setting a DIFFERENT meeting to `no_show` leaves its event intact.

- [ ] **Step 6: Commit.**

```bash
git add src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/meetings/DOCS.md
git commit -m "feat(meetings): remove GCal event when a meeting is cancelled (archived)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Add shared note helpers + single-source the outcome-note date format

**Files:**
- Create: `src/shared/entities/meetings/lib/notes.ts`
- Modify: `src/trpc/routers/meetings.router/business.router.ts` (the `setOutcomeWithReason` date format, ~lines 59–68)

**Interfaces:**
- Produces: `formatMeetingDateShort(iso: string): string` (LA-tz `MM/DD`); `buildRescheduleNote(oldIso: string, newIso: string, reason: string): string`.

- [ ] **Step 1: Create the pure lib helpers** `src/shared/entities/meetings/lib/notes.ts`:

```ts
/**
 * LA-timezone short meeting date (MM/DD) — the single source for meeting-note
 * dates. Both the outcome note and the reschedule note format dates through
 * this so the business timezone lives in exactly one place.
 */
export function formatMeetingDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

/** Customer-note body for a reschedule (original → cancelled, new meeting booked). */
export function buildRescheduleNote(oldIso: string, newIso: string, reason: string): string {
  return `${formatMeetingDateShort(oldIso)} meeting rescheduled to ${formatMeetingDateShort(newIso)}:\n${reason}`
}
```

- [ ] **Step 2: Refactor `setOutcomeWithReason` to use `formatMeetingDateShort`.** In `src/trpc/routers/meetings.router/business.router.ts`, add the import:

```ts
import { formatMeetingDateShort } from '@/shared/entities/meetings/lib/notes'
```

Replace the inline `meetingDate` block (currently ~lines 60–65) so the note builds from the shared helper:

```ts
        const label = MEETING_OUTCOME_LABELS[input.outcome]
        const meetingDate = formatMeetingDateShort(row.scheduledFor)
        const note = await customerNoteCrud.create(ctx, {
          customerId: row.customerId,
          content: `${meetingDate} meeting results:\nOutcome set to ${label}\n${input.reason}`,
        })
```

- [ ] **Step 3: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual check.** Set a negative outcome on a meeting with a customer; confirm the customer note still reads `"MM/DD meeting results:\nOutcome set to <label>\n<reason>"` (behavior unchanged, now single-sourced).

- [ ] **Step 5: Commit.**

```bash
git add src/shared/entities/meetings/lib/notes.ts src/trpc/routers/meetings.router/business.router.ts
git commit -m "refactor(meetings): shared meeting-note date helper + reschedule note builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `business.rescheduleMeeting` procedure

**Files:**
- Modify: `src/trpc/routers/meetings.router/business.router.ts` (add a new key to the router object)

**Interfaces:**
- Consumes: `meetingCrud.getById/create/update`, `getParticipantsForMeeting`, `addParticipant`, `customerNoteCrud.create`, `SYSTEM_CONTEXT`, `canRescheduleFromOutcome`, `buildRescheduleNote`, `dalToTrpc`, `dalVerifySuccess`.
- Produces: `trpc.meetingsRouter.business.rescheduleMeeting` — input `{ meetingId: uuid, newScheduledFor: iso-datetime, reason: string }`, returns the new `Meeting` row.

- [ ] **Step 1: Add imports** to `src/trpc/routers/meetings.router/business.router.ts`:

```ts
import { canRescheduleFromOutcome } from '@/shared/constants/enums/meetings'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { addParticipant, getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { buildRescheduleNote } from '@/shared/entities/meetings/lib/notes'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
```

(`dalVerifySuccess`, `meetingCrud`, `customerNoteCrud`, `db`, `meetings`, `eq`, `z`, `TRPCError`, `meetingProcedure` are already imported in this file.)

- [ ] **Step 2: Add the procedure** as a new key inside the existing `createTRPCRouter({ … })` object (after `setOutcomeWithReason`):

```ts
  /**
   * Reschedule: keep the original meeting (set it to `cancelled` — the archived
   * disposition) and book a NEW meeting at the new time, copying the original's
   * owner + participants + customer/project/type. Composes DAL blocks in the
   * router (no service). Order = create-new → then cancel-original so a failure
   * never leaves a cancelled meeting with no replacement. see meetings/DOCS.md#reschedule-cancels-and-rebooks
   */
  rescheduleMeeting: meetingProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      newScheduledFor: z.string().datetime(),
      reason: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      if (new Date(input.newScheduledFor).getTime() <= Date.now()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'The new meeting time must be in the future.' })
      }

      // Scope-checked load (getById applies ctx.scope → undefined if not visible).
      const original = dalToTrpc(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found.' })
      }
      if (!canRescheduleFromOutcome(original.meetingOutcome)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `A meeting with outcome "${original.meetingOutcome}" already happened and can't be rescheduled — book a new meeting instead.`,
        })
      }

      // Preserve identity: the new meeting's owner is the original's OWNER
      // participant (visibility is participant-based), so create.after re-adds
      // the correct owner participant; we copy the rest below.
      const participants = await getParticipantsForMeeting(input.meetingId)
      const ownerParticipant = participants.find(p => p.role === 'owner')
      const replacementOwnerId = ownerParticipant?.userId ?? original.ownerId

      // 1. Book the replacement under SYSTEM_CONTEXT so create.before passes the
      //    explicit ownerId through (an authed office reschedule would otherwise
      //    reassign it to the office user). create.after adds the owner
      //    participant + dispatches GCal sync / graduation / Meta CAPI.
      const replacement = dalVerifySuccess(await meetingCrud.create(SYSTEM_CONTEXT, {
        ownerId: replacementOwnerId,
        customerId: original.customerId,
        projectId: original.projectId,
        meetingType: original.meetingType,
        scheduledFor: input.newScheduledFor,
      }))

      // 2. Copy the non-owner participants (owner already added by create.after).
      for (const p of participants) {
        if (p.role !== 'owner') {
          await addParticipant(replacement.id, p.userId, p.role)
        }
      }

      // 3. Cancel the original (→ update.after removes its GCal event, Task 3) +
      //    post one customer note. Order per D7: create is already done above.
      dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: 'cancelled' },
      }))
      if (original.customerId) {
        const note = await customerNoteCrud.create(ctx, {
          customerId: original.customerId,
          content: buildRescheduleNote(original.scheduledFor, input.newScheduledFor, input.reason),
        })
        if (!note.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Meeting rescheduled but note failed.' })
        }
      }

      return replacement
    }),
```

- [ ] **Step 3: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual check (tunnel for GCal).** With `pnpm dev:mobile`, use a temporary tRPC call (or the UI from Task 8) to reschedule a `not_set` meeting that has a customer + participants. Verify: (a) a new meeting exists at the new time with `not_set` outcome, same customer/project/type, and the same participant set; (b) the original is now `cancelled` and its GCal event is gone; (c) exactly one customer note `"MM/DD meeting rescheduled to MM/DD:\n<reason>"` was written; (d) calling it on a `proposal_sent` meeting returns the BAD_REQUEST message.

- [ ] **Step 5: Commit.**

```bash
git add src/trpc/routers/meetings.router/business.router.ts
git commit -m "feat(meetings): rescheduleMeeting procedure (cancel original + book replacement)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Extend the entity-action system with a per-action disabled reason

**Files:**
- Modify: `src/shared/components/entity-actions/types.ts`
- Modify: `src/shared/components/entity-actions/ui/entity-action-dropdown.tsx`

**Interfaces:**
- Produces: optional `getDisabledReason?: (entity: TEntity) => string | null` on `EntityActionClickConfig`. When it returns a string, the menu item renders disabled with a tooltip showing that reason.

**Context:** ADR-0001 governs this system — read `docs/adr/` (entity-action registry) before editing. This adds a per-entity disabled affordance without breaking the compile-time registry.

- [ ] **Step 1: Add the field to the click config type** in `src/shared/components/entity-actions/types.ts` (inside `EntityActionClickConfig<TEntity>`, after `isDisabled?`):

```ts
  /**
   * Per-entity disabled check with a human reason. Returns the reason string
   * when the action can't run for THIS entity (item renders disabled with a
   * tooltip), or null when enabled. Use for row-varying gates (e.g. reschedule
   * only from did-not-occur outcomes) that a static `isDisabled` can't express.
   */
  getDisabledReason?: (entity: TEntity) => string | null
```

- [ ] **Step 2: Add Tooltip imports** to `src/shared/components/entity-actions/ui/entity-action-dropdown.tsx`:

```ts
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
```

- [ ] **Step 3: Pass the reason into the click item.** In `EntityActionDropdown`, update the click branch of the `permitted.map` (the `return (<EntityActionClickItem … />)` block) to forward the computed reason:

```tsx
          return (
            <EntityActionClickItem
              key={config.action.id}
              action={config.action}
              entity={entity}
              onAction={config.onAction}
              isLoading={config.isLoading}
              isDisabled={config.isDisabled}
              disabledReason={config.getDisabledReason?.(entity) ?? null}
            />
          )
```

- [ ] **Step 4: Render disabled + tooltip in `EntityActionClickItem`.** Replace the `ClickItemProps` interface and the `EntityActionClickItem` component:

```tsx
interface ClickItemProps<TEntity> {
  action: EntityActionConfig<TEntity>['action']
  entity: TEntity
  onAction: (entity: TEntity) => void
  isLoading?: boolean
  isDisabled?: boolean
  disabledReason?: string | null
}

function EntityActionClickItem<TEntity>({
  action,
  entity,
  onAction,
  isLoading,
  isDisabled,
  disabledReason,
}: ClickItemProps<TEntity>) {
  const Icon = action.icon
  const disabled = isLoading || isDisabled || disabledReason != null

  const item = (
    <DropdownMenuItem
      disabled={disabled}
      className={cn(action.destructive && 'text-destructive focus:text-destructive')}
      onClick={() => onAction(entity)}
    >
      <Icon className="h-3.5 w-3.5" />
      {action.label}
    </DropdownMenuItem>
  )

  return (
    <>
      {action.separatorBefore && <DropdownMenuSeparator />}
      {disabledReason
        ? (
            // Radix disables pointer events on a disabled item, so wrap the row
            // in a focusable span the tooltip can anchor to.
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="block">{item}</span>
              </TooltipTrigger>
              <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
          )
        : item}
    </>
  )
}
```

- [ ] **Step 5: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Manual check** deferred to Task 8 (no consumer sets `getDisabledReason` yet). Confirm existing action menus (delete, duplicate) still render/behave unchanged.

- [ ] **Step 7: Commit.**

```bash
git add src/shared/components/entity-actions/types.ts src/shared/components/entity-actions/ui/entity-action-dropdown.tsx
git commit -m "feat(entity-actions): per-action getDisabledReason with tooltip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Reschedule action constant + modal + change-wrapper + client mutation

**Files:**
- Modify: `src/shared/entities/meetings/constants/actions.ts`
- Create: `src/shared/hooks/use-reschedule.tsx`
- Create: `src/shared/entities/meetings/hooks/use-reschedule-change.tsx`
- Modify: `src/shared/entities/meetings/hooks/use-meeting-actions.ts`

**Interfaces:**
- Consumes: `DateTimePicker`, `Textarea`, Dialog primitives, `trpc.meetingsRouter.business.rescheduleMeeting`.
- Produces: `MEETING_ACTIONS.reschedule`; `useReschedule(): [() => JSX.Element, (meetingId: string) => Promise<{ confirmed, meetingId, newScheduledFor, reason }>]`; `useReschedule` dialog resolves to the tuple; `useRescheduleChange(): { reschedule, RescheduleDialog }`; `rescheduleMeeting` mutation on `useMeetingActions`.

- [ ] **Step 1: Register the action** in `src/shared/entities/meetings/constants/actions.ts`. Add `CalendarClockIcon` to the lucide import, and add a `reschedule` entry between `setOutcome` and `createProposal`:

```ts
  reschedule: {
    id: 'reschedule',
    label: 'Reschedule',
    icon: CalendarClockIcon,
    permission: ['update', 'Meeting'],
  },
```

- [ ] **Step 2: Add the client mutation** in `src/shared/entities/meetings/hooks/use-meeting-actions.ts`. Add inside `useMeetingActions`, before the `return`:

```ts
  const rescheduleMeeting = useMutation(
    trpc.meetingsRouter.business.rescheduleMeeting.mutationOptions({
      onSuccess: () => {
        invalidateMeeting()
        toast.success('Meeting rescheduled')
      },
      onError: err => toast.error(err.message || 'Failed to reschedule meeting'),
    }),
  )
```

and add `rescheduleMeeting` to the returned object.

- [ ] **Step 3: Create the promise-modal** `src/shared/hooks/use-reschedule.tsx` (mirrors `use-outcome-reason.tsx`; swaps the single textarea for a `DateTimePicker` + a note `Textarea`, gates confirm on a future date AND a non-empty note):

```tsx
'use client'

import type { JSX } from 'react'

import { useRef, useState } from 'react'

import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

export interface RescheduleResult {
  confirmed: boolean
  meetingId: string
  newScheduledFor: string
  reason: string
}

interface Pending {
  meetingId: string
  resolve: (value: RescheduleResult) => void
}

interface ViewProps {
  open: boolean
  scheduledFor: Date | undefined
  reason: string
  onDateChange: (d: Date | undefined) => void
  onReasonChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
}

function isFuture(d: Date | undefined): d is Date {
  return !!d && d.getTime() > Date.now()
}

function RescheduleDialogView({
  open, scheduledFor, reason, onDateChange, onReasonChange, onCancel, onConfirm,
}: ViewProps) {
  const canSave = isFuture(scheduledFor) && reason.trim().length > 0
  return (
    <Dialog open={open} onOpenChange={next => !next && onCancel()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Reschedule meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">New date &amp; time</Label>
            <DateTimePicker
              value={scheduledFor}
              onChange={onDateChange}
              placeholder="Pick the new date &amp; time"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-note">Note</Label>
            <Textarea
              id="reschedule-note"
              className="field-sizing-fixed min-h-24 resize-none text-sm"
              value={reason}
              onChange={e => onReasonChange(e.target.value)}
              placeholder="e.g. Homeowner asked to move to next week; confirmed new slot by phone."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button onClick={onCancel} variant="outline">Cancel</Button>
          <Button disabled={!canSave} onClick={onConfirm}>Reschedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Datetime + note capture for the Reschedule action. Mirrors useOutcomeReason's
 * promise pattern: requestReschedule(meetingId) resolves once the agent confirms
 * a future date + non-empty note, or cancels. Stable dialog identity via ref.
 */
export function useReschedule(): [
  () => JSX.Element,
  (meetingId: string) => Promise<RescheduleResult>,
] {
  const [pending, setPending] = useState<Pending | null>(null)
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined)
  const [reason, setReason] = useState('')

  const stateRef = useRef({ pending, scheduledFor, reason })
  stateRef.current = { pending, scheduledFor, reason }

  const requestReschedule = (meetingId: string) => {
    setScheduledFor(undefined)
    setReason('')
    return new Promise<RescheduleResult>((resolve) => {
      setPending({ meetingId, resolve })
    })
  }

  const dialogRef = useRef<(() => JSX.Element) | null>(null)
  if (!dialogRef.current) {
    dialogRef.current = function RescheduleDialog() {
      const { pending: p, scheduledFor: d, reason: r } = stateRef.current

      const handleCancel = () => {
        stateRef.current.pending?.resolve({ confirmed: false, meetingId: '', newScheduledFor: '', reason: '' })
        setPending(null)
      }
      const handleConfirm = () => {
        const cur = stateRef.current
        if (!cur.pending || !isFuture(cur.scheduledFor) || !cur.reason.trim()) {
          return
        }
        cur.pending.resolve({
          confirmed: true,
          meetingId: cur.pending.meetingId,
          newScheduledFor: cur.scheduledFor.toISOString(),
          reason: cur.reason.trim(),
        })
        setPending(null)
      }

      return (
        <RescheduleDialogView
          open={p !== null}
          scheduledFor={d}
          reason={r}
          onDateChange={setScheduledFor}
          onReasonChange={setReason}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      )
    }
  }

  return [dialogRef.current, requestReschedule]
}
```

- [ ] **Step 4: Create the change-wrapper** `src/shared/entities/meetings/hooks/use-reschedule-change.tsx` (mirrors `use-outcome-change.tsx`):

```tsx
'use client'

import type { JSX } from 'react'

import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useReschedule } from '@/shared/hooks/use-reschedule'

/**
 * Single entry point for the Reschedule action from any surface. Opens the
 * datetime+note modal, then calls business.rescheduleMeeting. `meetingId` is
 * passed per call so one instance serves rows, cards, and calendar events.
 * Render <RescheduleDialog /> once wherever this hook is used.
 */
export function useRescheduleChange(): {
  reschedule: (meetingId: string) => Promise<void>
  RescheduleDialog: () => JSX.Element
} {
  const { rescheduleMeeting } = useMeetingActions()
  const [RescheduleDialog, requestReschedule] = useReschedule()

  const reschedule = async (meetingId: string) => {
    const { confirmed, newScheduledFor, reason } = await requestReschedule(meetingId)
    if (!confirmed) {
      return
    }
    rescheduleMeeting.mutate({ meetingId, newScheduledFor, reason })
  }

  return { reschedule, RescheduleDialog }
}
```

- [ ] **Step 5: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/shared/entities/meetings/constants/actions.ts src/shared/hooks/use-reschedule.tsx src/shared/entities/meetings/hooks/use-reschedule-change.tsx src/shared/entities/meetings/hooks/use-meeting-actions.ts
git commit -m "feat(meetings): reschedule action constant, datetime+note modal, change wrapper, mutation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wire Reschedule into `useMeetingActionConfigs` + render the dialog on all surfaces

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`
- Modify: `src/shared/entities/meetings/components/overview-card.tsx`
- Modify: `src/features/meeting-flow/ui/components/table/index.tsx`
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx`

**Interfaces:**
- Consumes: `useRescheduleChange`, `canRescheduleFromOutcome`, `MEETING_ACTIONS.reschedule`.
- Produces: `RescheduleDialog` added to `useMeetingActionConfigs` return; a gated Reschedule action in the menu on every meeting surface.

- [ ] **Step 1: Wire the hook.** In `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`:

Add imports:

```ts
import { canRescheduleFromOutcome } from '@/shared/constants/enums/meetings'
import { useRescheduleChange } from './use-reschedule-change'
```

Add `RescheduleDialog` to the result interface `MeetingActionConfigsResult<T>`:

```ts
  RescheduleDialog: () => JSX.Element
```

Call the wrapper near the other hooks (after `useOutcomeChange`):

```ts
  const { reschedule, RescheduleDialog } = useRescheduleChange()
```

Push the config into the `configs` array right after the `setOutcome` block:

```ts
      {
        action: MEETING_ACTIONS.reschedule,
        onAction: (entity: T) => void reschedule(entity.id),
        getDisabledReason: (entity: T) =>
          canRescheduleFromOutcome((entity.meetingOutcome ?? 'not_set') as MeetingOutcome)
            ? null
            : 'This meeting already happened — book a new meeting instead of rescheduling.',
      },
```

Add `reschedule` and `RescheduleDialog` to the `useMemo` dependency array and the `return` object:

```ts
  return { actions, DeleteConfirmDialog, AssignOwnerDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome }
```

(add `reschedule` to the `useMemo` deps list alongside `changeOutcome`.)

- [ ] **Step 2: Render `<RescheduleDialog />` in `overview-card.tsx`.** Add it to the destructure at ~line 121 and render it once alongside the others at ~line 159:

```tsx
  const { actions, DeleteConfirmDialog, AssignOwnerDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome } = useMeetingActionConfigs({
```

```tsx
      <DeleteConfirmDialog />
      <AssignOwnerDialog />
      <OutcomeReasonDialog />
      <RescheduleDialog />
```

- [ ] **Step 3: Render it in the meetings table** `src/features/meeting-flow/ui/components/table/index.tsx`. Add `RescheduleDialog` to the `useMeetingActionConfigs` destructure and render `<RescheduleDialog />` next to the existing `<OutcomeReasonDialog />` (~line 91).

- [ ] **Step 4: Render it in the schedule view** `src/features/schedule-management/ui/views/schedule-view.tsx`. Add `RescheduleDialog` to the destructure and render `<RescheduleDialog />` next to the existing `<OutcomeReasonDialog />` (~line 160).

- [ ] **Step 5: Render it in the meeting-flow view** `src/features/meeting-flow/ui/views/meeting-flow.tsx`. This view uses `useOutcomeChange()` directly today (not `useMeetingActionConfigs`). Add `const { reschedule, RescheduleDialog } = useRescheduleChange()` (import from `@/shared/entities/meetings/hooks/use-reschedule-change`), render `<RescheduleDialog />` next to the existing `<OutcomeReasonDialog />` (~line 298), and wire a Reschedule affordance in the context panel if one is exposed there (mirror how `handleOutcomeChange` is wired). If the context panel has no action menu, rendering the dialog + exposing `reschedule` is sufficient for parity; note it in the commit.

- [ ] **Step 6: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Manual check.** With `pnpm dev`:
  - On a `not_set` or `reschedule_needed` meeting: the Reschedule action is enabled; clicking opens the datetime+note modal; confirming reschedules (verify per Task 5 Step 4).
  - On a `proposal_sent` (or any "happened") meeting: the Reschedule menu item is disabled and hovering shows the tooltip "This meeting already happened…".
  - Verify on all four surfaces: overview card, meetings table row menu, schedule calendar event, meeting-flow.

- [ ] **Step 8: Commit.**

```bash
git add src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/shared/entities/meetings/components/overview-card.tsx src/features/meeting-flow/ui/components/table/index.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): wire Reschedule action into all meeting surfaces with per-row gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Fresh-pipeline `reschedule` stage plumbing

**Files:**
- Modify: `src/shared/constants/enums/pipelines.ts`
- Modify: `src/shared/domains/pipelines/constants/fresh-pipeline.ts`
- Modify: `src/shared/domains/pipelines/lib/compute-fresh-stage.ts`

**Interfaces:**
- Produces: `'reschedule'` ∈ `FreshMeetingStage`/`FreshPipelineStage`; `StageInput.hasRescheduleNeeded: boolean`; `computeFreshStage` returns `'reschedule'` when `hasRescheduleNeeded`.

- [ ] **Step 1: Add the stage literal** in `src/shared/constants/enums/pipelines.ts` `freshMeetingStages` (after `follow_up_scheduled`, ~line 23):

```ts
  'follow_up_scheduled',
  'reschedule',
] as const
```

- [ ] **Step 2: Add the column config** in `src/shared/domains/pipelines/constants/fresh-pipeline.ts`. Add `CalendarClockIcon` to the lucide import, add a `freshStageConfig` entry after `follow_up_scheduled`:

```ts
  { key: 'follow_up_scheduled', label: 'Follow-up', icon: RotateCwIcon, color: 'purple' },
  { key: 'reschedule', label: 'Reschedule', icon: CalendarClockIcon, color: 'yellow' },
```

Add the required `FRESH_ALLOWED_DRAG_TRANSITIONS` key (exhaustive `Record` — will not compile without it). The stage is reached by derivation, not by dragging into/out of it:

```ts
  follow_up_scheduled: ['meeting_completed'],
  reschedule: [],
```

Add a blocked message so dragging into it explains itself:

```ts
  'default': 'This transition is not supported via drag',
  'meeting_completed->reschedule': 'Use the Reschedule action on the meeting',
```

- [ ] **Step 3: Add the input + branch** in `src/shared/domains/pipelines/lib/compute-fresh-stage.ts`. Add to `interface StageInput` (after `hasFollowUpNeeded`):

```ts
  /** A meeting on this customer was dispositioned `reschedule_needed`. */
  hasRescheduleNeeded: boolean
```

Add the branch just before the `hasFollowUpNeeded` check (reschedule is a "did not happen, act now" state; place it ahead of follow-up):

```ts
  // Explicit `reschedule_needed` outcome → Reschedule column.
  if (data.hasRescheduleNeeded) {
    return 'reschedule'
  }

  // Explicit `follow_up_needed` outcome → Follow-up column…
  if (data.hasFollowUpNeeded) {
    return 'follow_up_scheduled'
  }
```

- [ ] **Step 4: Type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: FAIL first — `computeFreshStage`'s `StageInput` now requires `hasRescheduleNeeded`, so `get-customer-pipeline-items.ts`'s `computeCustomerStage({...})` call (Task 10) will error until updated. That is expected; proceed to Task 10, then both compile. (If you want Task 9 to compile standalone, do Task 10 Step 2 in the same commit.)

- [ ] **Step 5: Commit** (together with Task 10 if you kept them atomic — see Task 10 Step 5).

---

## Task 10: Aggregate the `hasRescheduleNeeded` signal + thread it through

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
- Modify: `src/features/customer-pipelines/types/index.ts`

**Interfaces:**
- Consumes: `computeFreshStage`/`computeCustomerStage` (now requires `hasRescheduleNeeded`).
- Produces: customers with a `reschedule_needed` meeting land in the `reschedule` fresh-pipeline column.

- [ ] **Step 1: Add the `CustomerPipelineRawData` field** in `src/features/customer-pipelines/types/index.ts` — add `hasRescheduleNeeded: boolean` next to `hasFollowUpNeeded`.

- [ ] **Step 2: Aggregate the SQL signal** in `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`, in the `db.select({…})` block, right after the `hasFollowUpNeeded` line (~line 164):

```ts
      hasFollowUpNeeded: sql<boolean>`bool_or(${meetings.meetingOutcome} = ${'follow_up_needed'})`.as('has_follow_up_needed'),
      hasRescheduleNeeded: sql<boolean>`bool_or(${meetings.meetingOutcome} = ${'reschedule_needed'})`.as('has_reschedule_needed'),
```

- [ ] **Step 3: Thread through `rawData`** (~line 294): add `hasRescheduleNeeded: row.hasRescheduleNeeded ?? false,` next to the `hasFollowUpNeeded` line.

- [ ] **Step 4: Pass into `computeCustomerStage`** (~line 304): add `hasRescheduleNeeded: rawData.hasRescheduleNeeded,` to the argument object.

- [ ] **Step 5: Type-check + lint, then commit Tasks 9 + 10 together.**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (Task 9's `StageInput` requirement is now satisfied).

Manual check: set a meeting's outcome to "Reschedule Needed" (provide reason) for a customer visible on the customer-pipelines kanban. Expected: that customer's card appears in the new "Reschedule" column; filtering the meetings table by outcome = Reschedule Needed lists it.

```bash
git add src/shared/constants/enums/pipelines.ts src/shared/domains/pipelines/constants/fresh-pipeline.ts src/shared/domains/pipelines/lib/compute-fresh-stage.ts src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/features/customer-pipelines/types/index.ts
git commit -m "feat(pipelines): fresh-pipeline Reschedule column driven by reschedule_needed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Production enum push (GATED — explicit user go)

**Files:** none (DB ops).

- [ ] **Step 1: STOP and get explicit user approval.** Do not run this without the user saying go. Confirm the batch: `reschedule_needed` (this epic) plus the still-pending August adds `cancelled`, `nra`, `additional_work` (dev-only per memory `project-meeting-outcome-sentiment`). Verify prod's current `meeting_outcome` enum values first:

Run: `DRIZZLE_TARGET=prod` inspection per `docs/codebase-conventions/environment.md` (or a read-only `run_sql` `SELECT enum_range(NULL::meeting_outcome)`).

- [ ] **Step 2: Push to prod.**

Run: `pnpm db:push:prod`
Expected: additive `ALTER TYPE meeting_outcome ADD VALUE …` for each missing value; no table rewrite, no data change. Confirm the diff is additive-only before confirming the push.

- [ ] **Step 3: Post-push verification.** Re-query `enum_range(NULL::meeting_outcome)` on prod; confirm all four values present. Smoke-test setting `reschedule_needed` and rescheduling on prod does not throw.

- [ ] **Step 4: Update memory.** Update `memory/project-meeting-outcome-sentiment.md` to record the prod enum push completed (remove the "Prod enum push PENDING" note).

---

## Self-Review

- **Spec coverage:** D1 reschedule_needed (T1), D2 reschedule action (T5/T7/T8), D3 copy owner+participants+customer/project/type (T5), D4 did-not-occur gate (T1 classifier, T5 server guard, T8 UI gate), D5 cancelled=archived docs (T2), D6 GCal-on-cancel hook (T3), D7 create-then-cancel ordering + surface-on-failure (T5), D8 router orchestration + single note path + shared formatter (T4/T5), D9 filter (free) + Reschedule column (T9/T10). Prod push (T11). All covered.
- **Placeholder scan:** every code step contains real code; verification steps name exact commands + expected results.
- **Type consistency:** `reschedule_needed` (outcome) vs `reschedule` (stage) used consistently; `getDisabledReason` signature matches between T6 (definition) and T8 (use); `RescheduleResult`/`useReschedule`/`useRescheduleChange` names match across T7/T8; `hasRescheduleNeeded` matches across T9/T10.
- **Known cross-task compile dependency:** T9 does not compile standalone (StageInput change) until T10 — called out; commit them together.
