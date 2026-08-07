# Meetings Calendar Implementation Plan (Plan 1b of the dashboard epic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
> Steps use checkbox (`- [ ]`) syntax. Before editing any UI, load impeccable
> `reference/craft-floor.md`. Part of `2026-08-06-agent-dashboard-epic.md`; runs after Plan 1.
> Design authority: `docs/superpowers/specs/2026-08-06-meetings-calendar-design.md`.

**Goal:** Replace the dashboard Meetings module's Today/Upcoming/Past tabs with a compact
month calendar (meeting-day dots, today preselected) + a selected-day agenda, reusing the
shared calendar primitive and the existing meeting card.

**Architecture:** One LA-pinned month query feeds both the calendar dots and the selected
day's agenda (client-derived). Calendar left / agenda right on desktop, stacked on mobile.
Meetings only, cancelled/no-show excluded. View + quick actions; heavy scheduling stays on
the schedule page.

**Tech Stack:** Next.js 15 (RSC + client), tRPC + TanStack Query, react-day-picker v9
(`shared/components/ui/calendar.tsx`), Tailwind v4, date-fns, motion/react.

## Global Constraints

- **No `pnpm build`.** `pnpm tsc` + `pnpm lint` + live browser smoke only.
- **One component per file; named exports only; no file-level constants/helpers in component
  files** (extract to `constants/`/`lib/`).
- **Timezone:** all month bounds + LA "today" derive from `BUSINESS_TIMEZONE` via the existing
  `meeting-windows.ts` helpers — never ambient local-day math (hydration safety).
- **Command Desk skin:** cobalt = interactive only (selected day, today, meeting dots, focus);
  Space Mono time labels (`text-[0.72rem] tracking-[0.2em]`); no `text-[10px]`; tinted depth.
- **Meetings only**, excluding `cancelled` + `no_show`. No activities, no Google Calendar
  events, no inline create/drag (all deferred to the schedule page).
- **Reuse, don't reinvent:** the shared `Calendar`/`CalendarDayButton`, `DashboardMeetingCard`,
  `DashboardModule`, meeting actions, `ROOTS.dashboard.schedule()`.
- **Do not open a PR or push.**

---

### Task 1: Data layer — LA month window, live-outcome filter, query inputs

**Files:**
- Modify: `src/features/agent-dashboard/lib/meeting-windows.ts`
- Modify: `src/shared/constants/enums/meetings.ts`
- Modify: `src/features/agent-dashboard/constants/dashboard-queries.ts`

**Interfaces:**
- Produces: `meetingMonthWindow(anchorCalendarDay: string): { from: string; to: string }`;
  `businessToday(): string` (LA `YYYY-MM-DD`); `LIVE_MEETING_OUTCOMES: MeetingOutcome[]`;
  `meetingsMonthInput(anchorCalendarDay: string)`.

- [ ] **Step 1: Export an LA-today accessor + month window from `meeting-windows.ts`.** Reuse
  the existing private `startOfDayInTimeZone` + `addCalendarDays` + `BUSINESS_TIMEZONE`:
  ```ts
  /** LA business "today" as a YYYY-MM-DD calendar day (timezone-consistent server↔client). */
  export function businessToday(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE })
  }

  /** First day of the calendar month containing `anchorCalendarDay` (YYYY-MM-DD). */
  function firstOfMonth(anchorCalendarDay: string): string {
    const [year, month] = anchorCalendarDay.split('-').map(Number)
    return `${year}-${String(month).padStart(2, '0')}-01`
  }

  /** LA-pinned ISO bounds [startOfMonth, startOfNextMonth) for the meetings scheduledFor filter. */
  export function meetingMonthWindow(anchorCalendarDay: string): { from: string, to: string } {
    const start = firstOfMonth(anchorCalendarDay)
    const [y, m] = start.split('-').map(Number)
    const nextStart = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
    return {
      from: startOfDayInTimeZone(start, BUSINESS_TIMEZONE).toISOString(),
      to: startOfDayInTimeZone(nextStart, BUSINESS_TIMEZONE).toISOString(),
    }
  }
  ```

- [ ] **Step 2: Add `LIVE_MEETING_OUTCOMES` to `enums/meetings.ts`** (beside `DECIDED_OUTCOMES`):
  ```ts
  /** Outcomes that keep a meeting "live" — everything except the two that mean it never happened. */
  export const LIVE_MEETING_OUTCOMES: MeetingOutcome[] =
    meetingOutcomes.filter(o => o !== 'cancelled' && o !== 'no_show')
  ```

- [ ] **Step 3: Add `meetingsMonthInput` + apply the live filter to the today window** in
  `dashboard-queries.ts`:
  ```ts
  /** All meetings in the LA calendar month of `anchorCalendarDay`, live outcomes only, chronological. */
  export function meetingsMonthInput(anchorCalendarDay: string) {
    return {
      pagination: { limit: 200, offset: 0 },
      sort: { sortBy: 'scheduledFor', sortDir: 'asc' },
      filters: { scheduledFor: meetingMonthWindow(anchorCalendarDay), outcome: LIVE_MEETING_OUTCOMES },
    } satisfies MeetingListInput
  }
  ```
  And add `outcome: LIVE_MEETING_OUTCOMES` to the existing `meetingsWindowInput` filters (so
  the snapshot "Meetings today" count is live-only and matches the agenda). Import
  `meetingMonthWindow` from `../lib/meeting-windows` and `LIVE_MEETING_OUTCOMES` from
  `@/shared/constants/enums`.

- [ ] **Step 4: Verify.** `pnpm tsc` + `pnpm lint` pass (the `satisfies MeetingListInput`
  checks the filter keys).

- [ ] **Step 5: Commit.**
  ```bash
  git add src/features/agent-dashboard/lib/meeting-windows.ts \
    src/shared/constants/enums/meetings.ts \
    src/features/agent-dashboard/constants/dashboard-queries.ts
  git commit -m "feat(dashboard): LA month window + live-outcome meeting query inputs"
  ```

---

### Task 2: Meeting-day dot button + day agenda component

**Files:**
- Create: `src/features/agent-dashboard/ui/components/calendar-meeting-day-button.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-day-agenda.tsx`
- Reference (read, do not break): `src/features/agent-dashboard/ui/components/dashboard-today-timeline.tsx`

**Interfaces:**
- Produces: `CalendarMeetingDayButton` (a `DayButton` replacement that renders a cobalt dot
  when `modifiers.hasMeeting`); `DashboardDayAgenda({ rows, selectedDay }: { rows: MeetingListRow[]; selectedDay: Date })`.

- [ ] **Step 1: `calendar-meeting-day-button.tsx`.** Wrap the shared `CalendarDayButton`
  (import from `@/shared/components/ui/calendar`); when `modifiers.hasMeeting` is set, render a
  small `bg-primary` (cobalt) dot absolutely centered under the date number (a `<span>` inside
  the button; do not disturb selected/today styling). Keep it a single named-export component.

- [ ] **Step 2: `dashboard-day-agenda.tsx`.** Generalize the current Today-timeline rail: a
  chronological `<ol>` of the given `rows`, each row = Space Mono time label
  (`font-mono text-[0.72rem] tabular-nums`) + cobalt dot rail marker + `<DashboardMeetingCard row={row} />`.
  Empty (`rows.length === 0`) → "No meetings on {format(selectedDay, 'EEE, MMM d')}" +
  a "Book one →" link to `ROOTS.dashboard.schedule()`. Reuse the exact rail geometry/skeleton
  treatment from `dashboard-today-timeline.tsx` (copy its row/rail markup; this component
  supersedes it).

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint` pass; no `text-[10px]` in the new files.

- [ ] **Step 4: Commit.**
  ```bash
  git add src/features/agent-dashboard/ui/components/calendar-meeting-day-button.tsx \
    src/features/agent-dashboard/ui/components/dashboard-day-agenda.tsx
  git commit -m "feat(dashboard): meeting-day dot button + day agenda component"
  ```

---

### Task 3: Meetings calendar composition + rewire the hub; retire tabs/lists

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx`
- Delete: `src/features/agent-dashboard/ui/components/dashboard-meetings-list.tsx`
- Delete: `src/features/agent-dashboard/ui/components/dashboard-today-timeline.tsx`

**Interfaces:**
- Consumes: `meetingsMonthInput` (T1), `CalendarMeetingDayButton` + `DashboardDayAgenda` (T2),
  `businessToday` (T1). Produces: `DashboardMeetingsCalendar` (self-contained; queries + state).

- [ ] **Step 1: `dashboard-meetings-calendar.tsx`.** Client component:
  - State: `selectedDay: Date` and `month: Date`, both initialized from `businessToday()`
    (parse the `YYYY-MM-DD` to a local `Date` at noon to avoid DST edge). `anchorCalendarDay`
    for the query = `format(month, 'yyyy-MM-dd')` (first-of-month is derived inside the input).
  - `const { data } = useQuery(trpc.meetingsRouter.reads.list.queryOptions(meetingsMonthInput(anchor), { placeholderData: keepPreviousData }))`.
  - Derive `daysWithMeetings: Set<string>` (LA day keys of `data.rows`) and
    `selectedDayRows` (rows whose LA day === selected day), using the same `en-CA`/LA day-key
    derivation so grouping matches the calendar.
  - Layout: `flex flex-col gap-4 md:flex-row` — `<Calendar>` (left, `md:w-fit shrink-0`) with
    `mode="single" selected={selectedDay} onSelect={setSelectedDay} month={month}
    onMonthChange={setMonth} modifiers={{ hasMeeting: (d) => daysWithMeetings.has(key(d)) }}
    components={{ DayButton: CalendarMeetingDayButton }}`; `<DashboardDayAgenda rows={selectedDayRows} selectedDay={selectedDay} />`
    (right, `min-w-0 flex-1`).
  - Loading: month skeleton for the agenda side while `isLoading`.
- [ ] **Step 2: Rewire `dashboard-meetings-hub.tsx`.** Replace the `<Tabs>…</Tabs>` body with
  `<DashboardMeetingsCalendar />` inside the existing `<DashboardModule title="Meetings"
  action={<SeeAllLink/>}>`. Remove the `Tabs` imports and the `DashboardTodayTimeline` /
  `DashboardMeetingsList` imports.
- [ ] **Step 3: Delete** `dashboard-meetings-list.tsx` and `dashboard-today-timeline.tsx`
  (superseded). Confirm nothing else imports them:
  `grep -rn "dashboard-meetings-list\|dashboard-today-timeline" src`.

- [ ] **Step 4: Verify.** `pnpm tsc` + `pnpm lint` pass; the grep in Step 3 returns no
  remaining importers.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx \
    src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx
  git rm src/features/agent-dashboard/ui/components/dashboard-meetings-list.tsx \
    src/features/agent-dashboard/ui/components/dashboard-today-timeline.tsx
  git commit -m "feat(dashboard): month-calendar + day-agenda meetings module (replaces tabs)"
  ```

---

### Task 4: Page prefetch + hydration verification

**Files:**
- Modify: `src/app/(frontend)/dashboard/page.tsx`

**Interfaces:** Consumes `meetingsMonthInput` + `businessToday`.

- [ ] **Step 1: Prefetch the current month** in `page.tsx` (the module's key), alongside the
  existing today prefetch (snapshot) + proposals + projects:
  ```ts
  prefetch(trpc.meetingsRouter.reads.list.queryOptions(meetingsMonthInput(businessToday())))
  ```
  Keep the existing `meetingsWindowInput('today')` prefetch (snapshot chip). Import
  `meetingsMonthInput` + `businessToday`.

- [ ] **Step 2: Verify.** `pnpm tsc` + `pnpm lint` pass.

- [ ] **Step 3: Commit.**
  ```bash
  git add src/app/\(frontend\)/dashboard/page.tsx
  git commit -m "feat(dashboard): prefetch current-month meetings for the calendar module"
  ```

- [ ] **Step 4 (controller, not the implementer): browser smoke + hydration check.** Desktop
  1440: calendar left + agenda right; cobalt dots on meeting days; clicking a day updates the
  agenda; ‹ › changes month and dots refetch; today preselected. Mobile 390: calendar over
  agenda, no horizontal scroll. Console: **no calendar hydration warning** (if one appears near
  the PT/UTC midnight window, apply the mounted-gate mitigation from the spec and re-verify).
  omni + agent roles.

---

## Self-Review

- **Coverage:** month calendar + dots (T2/T3) · day agenda (T2/T3) · today preselected +
  month lead (T3) · calendar-left/agenda-right + mobile stack (T3) · meetings-only + exclude
  cancelled/no-show (T1) · view + quick actions via reused card (T2) · prefetch (T4) · retire
  tabs/lists (T3) · timezone/hydration care (T1 helpers + T4 check). All mapped.
- **Placeholders:** none — exact helper bodies, the `LIVE_MEETING_OUTCOMES` definition, the
  query input, and the composition props are spelled out.
- **Type consistency:** `meetingsMonthInput` returns `satisfies MeetingListInput`;
  `businessToday()`/`format(month,…)` feed the same `anchorCalendarDay` string the input
  expects; `DashboardDayAgenda` consumes `MeetingListRow[]` (the list row type
  `DashboardMeetingCard` already takes); `CalendarMeetingDayButton` matches react-day-picker's
  `DayButton` prop shape.
