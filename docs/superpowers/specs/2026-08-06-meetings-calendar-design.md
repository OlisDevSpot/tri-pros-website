# Meetings Calendar — Design Spec (Plan 1b of the dashboard epic)

> **Status:** approved shape (2026-08-06 requirements pass). Replaces the dashboard
> Meetings module's Today/Upcoming/Past **tabs** with a month calendar + day agenda,
> reusing the schedule feature's calendar primitive. Part of
> `2026-08-06-agent-dashboard-epic.md`.

## Why

The tabbed Today/Upcoming/Past windowing is a weak way to see one's meetings. The app
already has a full scheduling surface (Day/Week/Month calendar, Google Calendar sync,
drag-reschedule). The dashboard should present a **lighter "my day" cut** of that world —
a calendar you can pick any day from — and hand off heavy scheduling to the full page.

## Confirmed decisions

- **Layout:** compact **month calendar on the left**, selected-day **agenda on the right**
  (desktop); **calendar stacked above agenda** on mobile. Today preselected; month = current
  month on load. Month overview leads.
- **Content:** **customer meetings only** — no activities, no external Google Calendar events.
- **Interactivity:** **view + quick actions**. Click a meeting → existing profile/actions;
  `See all →` opens the full schedule page for creating/rescheduling. No inline create, no
  drag-to-reschedule here.
- **Meetings shown exclude `cancelled` and `no_show`** (folds in Plan 2's meetings decision).

## Composition

Inside the existing "Meetings" `DashboardModule` (the bento's `lg:col-span-8` primary):

```
┌ Meetings ───────────────────────────────── See all → ┐
│ ┌─ ‹ August 2026 › ─┐   WED · AUG 6                   │
│ │ Su Mo Tu We Th Fr │   ─────────────────────────    │
│ │        1  2  3  4 │   ● 9:00a  Juanita — Fontana    │
│ │  5  6• 7  8• 9 10 │   ● 1:30p  Leticia — Arleta     │
│ │ 11•12 13 14•…     │   ● 4:00p  James — Long Beach   │
│ └───────────────────┘                                 │
└───────────────────────────────────────────────────────┘
   compact calendar (left)     day agenda (right, scrolls)
```

- **Calendar** (reuse `src/shared/components/ui/calendar.tsx`, react-day-picker v9):
  `mode="single"`, controlled `selected` + `month`. A `hasMeeting` modifier renders a
  **cobalt dot** under any day with ≥1 meeting in the loaded month. Today already renders a
  cobalt outline; selected renders cobalt fill (both built in). Built-in ‹ › arrows change
  the month.
- **Day agenda** (right / below): time-ordered meetings for the selected day on the cobalt-dot
  + Space Mono time rail (the current `DashboardTodayTimeline` treatment, generalized to any
  day), each row a `DashboardMeetingCard`. Empty day → "No meetings on {date}" + "Book one →"
  (schedule page).

## Data

- **`meetingMonthWindow(anchorCalendarDay)`** (new, in `meeting-windows.ts`): LA-pinned ISO
  bounds `{ from: startOfMonth, to: startOfNextMonth }`, reusing the existing
  `startOfDayInTimeZone` + calendar arithmetic (DST-safe). Also export an LA "today"
  calendar-day accessor so the component's default `selected`/`month` are timezone-consistent
  server↔client (the same fix that killed the earlier hydration bug).
- **`meetingsMonthInput(anchorCalendarDay)`** (new, in `dashboard-queries.ts`):
  `scheduledFor = meetingMonthWindow(...)`, `outcome = LIVE_MEETING_OUTCOMES` (excludes
  cancelled/no_show), sort `scheduledFor` asc, generous cap (meetings-only, one agent/month
  is small). Scoped server-side like the existing meeting queries.
- The module runs **one month query**; the client derives the calendar dots and the selected
  day's agenda from that set. Picking a day = client filter (no refetch). Changing month =
  new query key → refetch, with `placeholderData: keepPreviousData` for smoothness.
- **`page.tsx`** prefetches the current month (same key the module reads → instant hydrate).
- **Snapshot "Meetings today" chip** keeps its own `meetingsWindowInput('today')` query
  (independent today count) — which now also gains the `LIVE_MEETING_OUTCOMES` filter so the
  count matches the live agenda.

## Timezone / hydration care

- Month bounds and LA-"today" derive from `BUSINESS_TIMEZONE` via the existing helpers — never
  ambient local-day math.
- react-day-picker computes its internal "today" marker from the browser clock; near the
  UTC↔PT midnight window an SSR "today" (UTC) could differ from the client. If the browser
  smoke shows a hydration warning on the calendar, gate the calendar render behind a mounted
  flag (client-only) with a same-size skeleton during SSR. Verify in the smoke; apply the
  mitigation only if the warning actually appears.

## Reuse / retire

- **Reuse:** `shared/components/ui/calendar.tsx` (+ `CalendarDayButton`), `DashboardMeetingCard`,
  `DashboardModule`, the meeting actions already wired into the card, the `meeting-windows.ts`
  LA helpers, `ROOTS.dashboard.schedule()`.
- **Retire:** `dashboard-meetings-list.tsx` (Upcoming/Past lists) and the `Tabs` in
  `dashboard-meetings-hub.tsx`. `dashboard-today-timeline.tsx` is **generalized** into the
  day agenda (any selected day, not just today).

## Out of scope (explicitly)

Activities, Google Calendar events + sync badge, inline meeting/activity creation,
drag-to-reschedule, the multi-agent swimlane (`ScheduleTodayView`), Week/Month grid views —
all remain on the full schedule page (`See all →`).

## Verification

`pnpm tsc` + `pnpm lint` (no test runner; never `pnpm build`), then a live browser smoke:
desktop 1440 (calendar left + agenda right, dots on meeting days, pick a day updates the
agenda, month nav refetches) and mobile 390 (calendar over agenda, no horizontal scroll),
omni + agent roles. Confirm no calendar hydration warning in the console.
