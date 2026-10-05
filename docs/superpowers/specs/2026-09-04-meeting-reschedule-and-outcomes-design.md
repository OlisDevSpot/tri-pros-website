# Design — Meeting Reschedule + Outcome-set Completion (Epic 1)

**Date:** 2026-09-04
**Mega-epic:** Meeting / Schedule overhaul
**This spec (Epic 1):** the `reschedule_needed` outcome, the `Reschedule` meeting action, the `cancelled = archived` clarification, and the single-source refactor of the outcome-note write path.
**Deferred siblings (NOT in this spec):**
- **Epic 2** — customer-profile "Schedule" tab (unified meetings + activities timeline).
- **`co_owner` removal epic** — collapse participant roles to `owner` + `helper` (own migration + prod data re-role).

---

## 1. Problem / intent

Give agents and the office a coherent way to move meetings that did not happen, and complete the outcome vocabulary so its buckets carry unambiguous meaning.

Two focus areas:
1. **Outcome set + grouping** — add the one missing selectable disposition (`reschedule_needed`), lock the meaning of `cancelled`, and keep every classification deriving from the single canonical sentiment map.
2. **Reschedule flow** — a first-class meeting action that cancels the original meeting (as an archived record) and books a replacement at a new time, capturing why as a customer note.

### Non-goals
- No customer-profile Schedule tab (Epic 2).
- No participant-role changes (`co_owner` stays for now; its removal is a sibling epic).
- No new CASL ability, no permission-model change. The `sales_agent` naming in `meetings/DOCS.md` is stale and gets a **docs-only** correction here.
- `not_confirmed` was considered and **dropped**. DB default stays `not_set`.
- `follow_up_needed` is **not** renamed.

---

## 2. Decisions (owner-confirmed during grilling, 2026-09-04)

| # | Decision |
|---|---|
| D1 | Add selectable outcome `reschedule_needed`, sentiment **neutral** (yellow), **reason-gated** (joins the attention queue). |
| D2 | `Reschedule` is a **meeting entity action** (datetime + note modal). On submit it **keeps the original** (sets it to `cancelled`) and **books a new meeting** at the new time. Not an outcome, not an Activity. |
| D3 | New meeting **copies the original's** `customerId`, `projectId`, `meetingType`, **owner + all participants**; outcome resets to `not_set`. |
| D4 | Reschedule is available **only from "did-not-occur" outcomes** — `not_set`, `reschedule_needed`, `no_show`, `cancelled` — to make outcome-clobbering data loss impossible. Rescheduling a `no_show` flips it to `cancelled` (accepted). |
| D5 | `cancelled` keeps its value, label ("Cancelled"), negative sentiment, and `rehash` pipeline. Its canonical meaning = **archived** (meeting didn't happen, not being rescheduled at this time, record kept). Documented, not re-coded. `no_show` untouched. |
| D6 | Setting outcome → `cancelled` (any path) **removes the meeting's GCal event** (row preserved), via the `meetingCrud` `update.after` cancelled-transition hook. |
| D7 | Failure handling for the two-write reschedule: **no DB transaction** (crud hooks aren't tx-safe). Sequence **create-new → then cancel-original**; on mid-failure, surface the error (option **a**) — worst case is two live meetings, retry-safe. |
| D8 | **Orchestrate in tRPC from reusable DAL blocks — no service, no wrappers.** Pure entity-CRUD flows are orchestrated in the `meetings.business` router (the `setOutcomeWithReason` precedent), *not* an internal service. Both procedures **compose existing DAL blocks** (`meetingCrud.update/create`, `customerNoteCrud.create`, `addParticipant`, `getParticipantsForMeeting`) — no composite DAL orchestration functions (DAL-level orchestration is a last resort; it couples DB actions and breeds thin, single-use code). "Single note-write path" = every note goes through the one primitive `customerNoteCrud.create` + the shared LA-tz formatter (`lib/formatters.ts`) + pure note builders in `lib/`. No shared "update-outcome-then-note" wrapper. |
| D9 | Office reschedule queue = **both** the existing meetings-table outcome filter **and** a dedicated fresh-pipeline "Reschedule" kanban column (new `hasRescheduleNeeded` signal in `compute-fresh-stage`). |

---

## 3. Outcome taxonomy — target state

Canonical classifier is unchanged in principle: **everything derives from `MEETING_OUTCOME_SENTIMENT`.** The one genuinely new axis (reschedulability) is *not* derivable from sentiment, so it gets its own explicitly-named shared constant — defined **once**, consumed by both UI and server.

### 3.1 Enum + classifiers (`src/shared/constants/enums/meetings.ts`)
- `selectableMeetingOutcomes` — insert `reschedule_needed` **adjacent to `follow_up_needed`** (contiguous yellow/neutral block; keep `not_set` first, negatives contiguous, neutrals last).
- `MEETING_OUTCOME_SENTIMENT` — add `reschedule_needed: 'neutral'`. (`Record<MeetingOutcome,…>` ⇒ compile error until added — the safety net.)
- `outcomeRequiresReason` — no literal change needed if it stays `isNegativeOutcome(o) || o === 'follow_up_needed'`; **extend to** `|| o === 'reschedule_needed'`. This auto-adds it to `ATTENTION_OUTCOMES`.
- **New shared classifier (reschedulability axis):**
  ```ts
  /**
   * Outcomes where the meeting did NOT physically occur — the only states a
   * Reschedule (cancel-and-rebook) may start from. Orthogonal to sentiment;
   * cuts across unset/neutral/negative, so it cannot derive from the sentiment
   * map. Single source for the UI action gate AND the server proc guard.
   */
  export const DID_NOT_OCCUR_OUTCOMES = ['not_set', 'reschedule_needed', 'no_show', 'cancelled'] as const satisfies readonly MeetingOutcome[]
  export function canRescheduleFromOutcome(outcome: MeetingOutcome): boolean {
    return (DID_NOT_OCCUR_OUTCOMES as readonly MeetingOutcome[]).includes(outcome)
  }
  ```

### 3.2 Labels + colors (`src/shared/entities/meetings/constants/status-colors.ts`)
- `MEETING_OUTCOME_LABELS` — add `reschedule_needed: 'Reschedule Needed'` (compile error until added).
- Color maps derive from sentiment → **no edit** (yellow/neutral for free).
- `outcome-options.ts` picks it up automatically (it maps `selectableMeetingOutcomes`).

### 3.3 Pipeline (`src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`)
- Add `reschedule_needed: null` (stays in the fresh pipeline). ⚠️ Typed `Record<string,…>` → **no compile error**, must be added explicitly.

### 3.4 `cancelled` = archived (docs only)
- No code/enum/pipeline change. `meetings/DOCS.md` records: `cancelled` = meeting did not happen, not currently being rescheduled, record retained; `rehash` pipeline (recallable). Distinction from `no_show` (customer failed to appear at the scheduled time) documented.

### 3.5 DB migration
- Postgres enum `meeting_outcome`: `ALTER TYPE ... ADD VALUE 'reschedule_needed'` (additive; the `pgEnum` regenerates from the array). No rename, no backfill.
- **Batch with the still-pending August adds** (`cancelled`, `nra`, `additional_work` are on dev but not prod). Prod push is a `db:push:prod` and requires explicit owner go (see `feedback-db-push-dev-only`).

---

## 4. The Reschedule action

### 4.1 UI (three-layer entity-action pattern — reused, not reinvented)
- **`MEETING_ACTIONS.reschedule`** in `constants/actions.ts`: `{ id, label: 'Reschedule', icon: CalendarClockIcon, permission: ['update','Meeting'] }`.
- **`useReschedule()`** promise-modal in `src/shared/entities/meetings/hooks/` — mirrors `useOutcomeReason` (stable dialog identity, promise resolve), but collects **datetime (`DateTimePicker`) + note**. Confirm disabled until datetime (`> now`) and note are valid. Returns `{ confirmed, newScheduledFor, reason }`.
- **`useMeetingActionConfigs`** wires a click config that opens the modal, then calls the reschedule mutation. Availability: `isDisabled: !canRescheduleFromOutcome(currentOutcome)`. The hook returns the `RescheduleDialog` component (rendered once per consumer, like `OutcomeReasonDialog`).
- **Surfaces:** overview-card, meetings-table row menu, schedule-view, meeting-flow — all via the single `useMeetingActionConfigs` wiring.

### 4.2 Server — tRPC orchestration (no service)
Orchestration lives in the `meetings.business` router, composing existing DAL blocks (per D8). No `meetings.service.ts`, no composite DAL functions.
- **`meetingsRouter.business.rescheduleMeeting`** (new): input `{ meetingId: uuid, newScheduledFor: iso-datetime (> now), reason: string 1–2000 }`. Guards: actor `can('update','Meeting')`, meeting visible to actor, `canRescheduleFromOutcome(currentOutcome)` (else `BAD_REQUEST`), meeting exists (else `NOT_FOUND`). Procedure body = the orchestration in 4.3.
- **`meetingsRouter.business.setOutcomeWithReason`** — unchanged in shape (it already composes `meetingCrud.update` + `customerNoteCrud.create` in the router); only swap its **inline** LA-tz date format for the shared `lib/formatters.ts` formatter so note formatting is single-sourced.

### 4.3 `rescheduleMeeting` orchestration — router procedure body (composes DAL blocks; order per D7)
1. Load the original's needed columns (`ownerId, customerId, projectId, meetingType, scheduledFor, gcalEventId, meetingOutcome`) via the existing meetings read; `getParticipantsForMeeting(meetingId)`. Re-assert `canRescheduleFromOutcome`.
2. **Book the replacement** — `meetingCrud.create(systemCtx, { ownerId: original.ownerId, customerId, projectId, meetingType, scheduledFor: newScheduledFor })` (outcome/pipeline default to `not_set`/`fresh`). `create.after` auto-adds the original owner as the `owner` participant + dispatches GCal sync + campaign-graduation + (deduped) Meta CAPI. **Why `systemCtx`:** an authed reschedule by the **office** would otherwise force `ownerId` to the office user (`create.before`); the `!ctx.session` (system-context) branch passes the explicit `ownerId` through, preserving the rep. Permission was already checked by the procedure guard. Same mechanism `intake.router` uses to create meetings under `SYSTEM_CONTEXT` — blocks composed in the router, not a wrapper.
3. **Copy remaining participants** — `addParticipant(replacement.id, userId, role)` for every original participant whose role isn't the already-added `owner` (`co_owner`/`helper`).
4. **Cancel the original** — compose the two blocks directly: `meetingCrud.update(ctx, { id: meetingId, data: { meetingOutcome: 'cancelled' } })` (triggers the GCal-removal hook, D6) → `customerNoteCrud.create(ctx, { customerId, content: buildRescheduleNote(originalScheduledFor, newScheduledFor, reason) })` when a customer exists.
5. Return the replacement meeting.

`buildRescheduleNote(old, new, reason)` — pure fn in meetings `lib/`: `"{oldMM/DD} meeting rescheduled to {newMM/DD}:\n{reason}"`, using the shared formatter.

### 4.4 GCal removal on cancel (D6) — `meetingCrud` `update.after`
```ts
if (meta.previousRow.meetingOutcome !== 'cancelled'
    && row.meetingOutcome === 'cancelled'
    && row.gcalEventId) {
  await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
  // clear gcal linkage on the row (mirrors clearMeetingGCalFields); the
  // gcalEventId null-guard above prevents re-dispatch on the follow-up write.
}
```
Fires on the transition into `cancelled` from **any** path (Reschedule action or a direct "Cancelled" selection). Row preserved; only the calendar event + linkage go. `no_show` untouched.

---

## 5. Office reschedule queue (D9)
- **Filter (free):** `reschedule_needed` is filterable via the existing meetings-table outcome filter, and — being reason-gated — appears in the existing `ATTENTION_OUTCOMES` action queue.
- **Kanban column:** add a fresh-pipeline **"Reschedule"** stage.
  - `compute-fresh-stage.ts` — new stage driven by a `hasRescheduleNeeded` signal (place relative to `follow_up_scheduled`; ordering finalized in the plan).
  - `get-customer-pipeline-items.ts` — aggregate `hasRescheduleNeeded` (`bool_or(meetingOutcome = 'reschedule_needed')`); reference the enum value rather than a bare string literal where the SQL builder allows.
  - Kanban column config + `FreshPipelineStage` type extension.

---

## 6. Layered change map

- **DB/schema:** `ADD VALUE 'reschedule_needed'` to `meeting_outcome` (dev now; prod batched w/ pending Aug adds, explicit go).
- **enums/constants:** `meetings.ts` (array, sentiment, `outcomeRequiresReason`, new `DID_NOT_OCCUR_OUTCOMES` + `canRescheduleFromOutcome`), `status-colors.ts` (label), `outcome-pipeline-map.ts` (`reschedule_needed: null`).
- **entity/DAL (reused blocks, no new orchestration fns):** `meetingCrud.update.after` GCal-removal branch (the only DAL change); compose existing `meetingCrud.create/update`, `addParticipant`, `getParticipantsForMeeting`, `customerNoteCrud.create`.
- **lib:** `buildRescheduleNote` (pure); reuse `lib/formatters.ts`.
- **tRPC (orchestration):** new `business.rescheduleMeeting` (composes DAL blocks); `business.setOutcomeWithReason` swaps its inline date-format for the shared formatter.
- **UI:** `MEETING_ACTIONS.reschedule` + `useReschedule()` + `useMeetingActionConfigs` wiring + render `RescheduleDialog` at each consumer.
- **pipelines:** `compute-fresh-stage.ts`, `get-customer-pipeline-items.ts`, kanban column config, `FreshPipelineStage` type.
- **docs:** `meetings/DOCS.md` — `cancelled`=archived, reschedule action contract, `reschedule_needed`, and the stale `sales_agent`→`owner`/`co_owner`/`helper` + CASL-`agent` correction. `service-architecture.md:21` — one-line clarification that entity-CRUD flows orchestrate in the tRPC router, not an internal service (services are for provider/external/cross-cutting orchestration).

---

## 7. Data flow (reschedule, happy path)

```
Agent/office → Reschedule action → useReschedule modal (datetime + note)
  → trpc business.rescheduleMeeting { meetingId, newScheduledFor, reason }
    → guards (CASL update Meeting, visible, canRescheduleFromOutcome, > now)
    → procedure body composes DAL blocks:
        1. load original (+ participants)
        2. meetingCrud.create (system-ctx, preserve owner/customer/project/type, new time)
             ↳ create.after: add owner participant + GCal sync + graduate + Meta CAPI (deduped)
        3. addParticipant × (co_owner/helper)
        4. meetingCrud.update(original, cancelled) → update.after: delete original GCal event; pipeline→rehash
           customerNoteCrud.create(reschedule note)
    → invalidate meetings / customer profile / schedule queries
```

---

## 8. Error handling
- **Guard rejections:** `BAD_REQUEST` (outcome not reschedulable, past datetime), `NOT_FOUND` (meeting gone), CASL `FORBIDDEN`.
- **Mid-failure (D7):** if step 4 (cancel) fails after step 2 (create), surface the error; the extra live meeting is office-visible and retry-safe (no lost appointment). No compensating delete in v1.
- **Note-after-outcome failure:** same behavior as `setOutcomeWithReason` today — outcome persisted via `meetingCrud.update`, note failure surfaced by `customerNoteCrud.create`. Both procedures compose the same two blocks in the same order.
- **GCal:** removal is a QStash `dispatchOrThrow`; handler idempotent (swallows 404/410). Orphan residue is covered by the existing orphan-sweeper note in `crud.ts`.

---

## 9. Testing
- **Unit:** `canRescheduleFromOutcome` / `DID_NOT_OCCUR_OUTCOMES` membership; `outcomeRequiresReason` includes `reschedule_needed`; sentiment/label/pipeline entries present (type-exhaustive); `buildRescheduleNote` formatting.
- **Procedure (`business.rescheduleMeeting`):** new meeting copies owner+participants+customer+project+type, outcome `not_set`; original set `cancelled` with note; ordering (create before cancel); reschedulability guard rejects "happened" outcomes; office-actor reschedule preserves the original owner (participant-based visibility retained).
- **Hook:** `update.after` deletes GCal event only on the `cancelled` transition + only with a `gcalEventId`; `no_show` unaffected; no re-dispatch after fields cleared.
- **Regression:** `setOutcomeWithReason` behavior preserved after swapping to the shared formatter.

---

## 10. Sequencing (independently shippable within Epic 1)
1. **Taxonomy** — `reschedule_needed` + classifiers + labels + pipeline map + `cancelled` docs (dev enum add).
2. **GCal-on-cancel hook** (D6) — small, standalone.
3. **Reschedule action + modal + `business.rescheduleMeeting`** (depends on 1); `setOutcomeWithReason` formatter swap folds in here.
4. **Fresh-pipeline "Reschedule" column** (depends on 1).
5. **Prod enum push** — batched, explicit owner go.
