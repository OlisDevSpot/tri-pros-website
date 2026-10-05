# Master Epic — Meeting / Schedule Overhaul

**Date:** 2026-09-09
**Status:** in progress (Epic 1 designed; Epics 2–3 scoped, un-specced)
**Owner:** Oliver P

The umbrella tracker for reworking how agents and the office organize meetings, outcomes, and per-customer activity. Each epic below gets its own design spec → implementation plan → issues. This file is the index + requirements map; it does **not** duplicate per-epic design detail.

## Vision

Give agents and the office more control over "where each customer is going" — a coherent outcome vocabulary, first-class rescheduling, and a unified per-customer timeline of meetings + activities. Today outcomes are complete-ish but missing the "needs a new time" state, rescheduling is ad-hoc, and the customer profile's Meetings tab is a flat list divorced from activities.

## Epics at a glance

| # | Epic | Status | Spec | Depends on |
|---|------|--------|------|-----------|
| 1 | Reschedule + Outcome Completion | ✅ Designed → impl plan next | `2026-09-04-meeting-reschedule-and-outcomes-design.md` | — |
| 2 | Customer-profile "Schedule" tab (meetings + activities timeline) | 🔲 Scoped, needs spec | _tbd_ | Epic 1 (outcome set) helpful, not blocking |
| 3 | `co_owner` participant-role removal | 🔲 Scoped, needs spec | _tbd_ | independent (Epic 1 is role-agnostic) |

---

## Epic 1 — Reschedule + Outcome Completion

**Goal:** complete the outcome set with `reschedule_needed`, make Reschedule a first-class meeting action, and lock the meaning of `cancelled`.

**Design:** [`2026-09-04-meeting-reschedule-and-outcomes-design.md`](./2026-09-04-meeting-reschedule-and-outcomes-design.md) — the 9 decisions (D1–D9) and full change map live there.

**Requirements (what "done" means):**
- New selectable outcome `reschedule_needed` — neutral/yellow, reason-gated, in the attention queue, filterable.
- Shared `DID_NOT_OCCUR_OUTCOMES` / `canRescheduleFromOutcome()` classifier (single source: UI gate + server guard).
- `cancelled` = "archived" documented (behavior unchanged: negative + rehash); `no_show` distinction documented.
- Reschedule meeting action: datetime + note modal → keeps original as `cancelled`, books a new meeting copying owner/participants/customer/project/type (outcome `not_set`), posts one customer note.
- Orchestrated in `business.rescheduleMeeting` composing existing DAL blocks (no service, no wrappers); create-new → cancel-original ordering; surface-on-failure.
- GCal event removed on the `cancelled` transition (hook), row preserved; `no_show` untouched.
- Office queue: meetings-table outcome filter **+** fresh-pipeline "Reschedule" kanban column.
- Docs: `meetings/DOCS.md` (cancelled=archived, reschedule contract, `reschedule_needed`, stale `sales_agent`→`owner`/`co_owner`/`helper` fix), `service-architecture.md:21` clarification.
- Prod enum push for `reschedule_needed` batched with the pending Aug adds (`cancelled`/`nra`/`additional_work`) — explicit go.

**Not in Epic 1:** the Schedule tab, `co_owner` removal, any Activity-side work.

---

## Epic 2 — Customer-profile "Schedule" tab

**Goal:** replace the customer profile's flat "Meetings" tab with a "Schedule" tab = a unified chronological timeline of that customer's **meetings + activities**, giving the agent one view of past and upcoming customer touchpoints.

**Requirements (draft — to be firmed in its own spec):**
- Rename tab Meetings → **Schedule**; widen the 3 inline `'overview'|'meetings'|'projects'` tab unions + `defaultTab` prop; update `defaultTab: 'meetings'` call sites (notably `schedule-view.tsx`).
- **Data:** extend `getCustomerProfile` to also fetch the customer's activities so the tab stays prop-driven. Requires a per-customer activity scope (`entityType='customer' AND entityId=customerId`, plus meeting-linked activities) — the current `scheduleRouter.activities.list` has **no entityId filter**; add one.
- **Merge/sort:** `kind`-discriminated union (`meeting | activity`); sort key meeting → `scheduledFor`, activity → `scheduledFor ?? dueAt ?? createdAt`; split Upcoming / Past.
- **Render:** reuse `MeetingOverviewCard` (meetings) + `ACTIVITY_TYPE_CONFIG` icons/colors (activities); "Add" offers both meeting + activity; outcome/reschedule actions reuse `useMeetingActionConfigs` (single-controller rule).
- Reschedule (Epic 1) shows correctly: cancelled original + new meeting both appear in the timeline.

**Open design questions (resolve in the Epic 2 spec):**
- **Visibility reconciliation** — meetings scope by *participation*, activities by *ownerId = self*. The merged feed must apply both predicates deliberately (which agents see which items).
- Which Activity actions belong inline (create reminder/task, complete, edit, delete)?
- Timeline density / grouping (by day? by week?) and empty states.
- Does the global schedule calendar (`schedule-view`) share components with this tab, or stay separate?

**Building blocks that already exist:** `activities` entity (table + `scheduleRouter.activities` + GCal sync), the global schedule calendar's `kind`-discriminated union + `activityToCalendarEvent` normalization, `ACTIVITY_TYPE_CONFIG`. **Gaps:** no entityId filter on activities list; no per-customer activity fetch in `getCustomerProfile`; no `activities/DOCS.md`.

---

## Epic 3 — `co_owner` participant-role removal

**Goal:** collapse participant roles to `owner` + `helper` only.

**Requirements (draft):**
- Remove `co_owner` from `meetingParticipantRoles` + the Postgres `meeting_participant_role` enum; drop `meeting_one_co_owner_idx`.
- **Prod data migration** — re-role existing `co_owner` rows first (→ `owner` if the meeting's owner slot is empty, else `helper`); Postgres won't drop an in-use enum value.
- Simplify participant-picker UX (drop the owner→co_owner→helper inference + promote/demote crown flow in `participants.router.ts` + `participant-picker-content.tsx` + `current-participant-row.tsx`).
- Update `queries.ts`, `users/overview-card.tsx`, `schedule-management/types`.
- Only agents assignable (no dispatchers / system user) — already how it works; confirm + document.

**Dependency note:** independent of Epic 1 (reschedule copies *all* participant roles, so it's correct before or after this lands). Sequence whenever convenient in the overhaul.

---

## Cross-cutting threads

- **Prod enum push** (Epic 1) — `reschedule_needed` + pending Aug adds; one batched `db:push:prod`, explicit go. See `project-meeting-outcome-sentiment` memory.
- **Pipelines overlap** — Epic 1's fresh-pipeline "Reschedule" column touches `compute-fresh-stage`, which overlaps the deferred **pipelines domain rethink** (pipeline = derived fact). Keep the new stage additive; don't entangle with that refactor.
- **Ownership model** — `meetings.ownerId` is legacy; participation (`owner`/`co_owner`/`helper`) + CASL `agent` role is the real model. The stale `sales_agent` DOCS wording gets fixed in Epic 1; Epic 3 finishes the role simplification.

## Sequencing

1. **Epic 1** — impl plan → build → prod enum push.
2. **Epic 2** — spec (resolve visibility + Activity-action questions) → impl plan → build. Can start its spec in parallel with Epic 1 build.
3. **Epic 3** — spec + migration → build. Slot whenever; not blocking.
