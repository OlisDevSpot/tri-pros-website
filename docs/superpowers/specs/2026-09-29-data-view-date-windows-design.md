# Data-view date windows: wider prefetch, pending skeletons, dashboard calendar on the shared read

> **Status:** reviewed and ruled, 2026-09-29 (A6–A8 and the §5 names added after a review against the code). Ready for the implementation plan. Nothing is built.
> **Spec A of two.** Spec B (one entity-action host per view, so no card mounts a dialog) is brainstormed next and builds after this one.
> **Cites:** data-view filtering plan `docs/superpowers/plans/2026-09-27-data-view-filtering.md` (Deviation 17: a data-view config pins no filter; Deviation 18: month view reads the month grid); records bulk spec `docs/superpowers/specs/2026-09-28-records-bulk-actions-and-entity-tables-design.md` (B5, B6, B7, § "Legacy query path").

## 1. Why

Clicking Previous or Next quickly on `/dashboard/schedule` outruns the prefetch. Today `useDataViewQuery` prefetches one window either side, and only once the current window has settled (`isSuccess`, not placeholder data, not fetching). A faster click lands on a window nobody has asked for. `keepPreviousData` then keeps the old window's rows on screen, they fall outside the new grid, and the calendar says things that are false:

- the week view writes "No events" in every day column (`schedule-week-view.tsx:130`);
- the day view writes "No events scheduled for this day" (`schedule-today-view.tsx:75`);
- the dashboard agenda writes "No meetings on Tue, Oct 6" (`dashboard-day-agenda.tsx:24`);
- the toolbar's "Showing 500 of N" notice describes the previous window (`row-cap-notice.tsx:14`).

The agent dashboard calendar has no prefetch at all. It reads `meetingsRouter.reads.list` through its own `useQuery` (`dashboard-meetings-calendar.tsx:42`), with the month held in React state in `DashboardMeetingsHub`. Its agenda also says "No meetings on …" in two more false cases:

- the selected day doesn't move with the month, so paging two months away lists a day the loaded rows don't cover;
- a failed read leaves no rows, and the agenda reads that as an empty day.

## 2. Rulings (owner, 2026-09-29)

| # | Ruling |
|---|---|
| A1 | **Wider radius, keep the settle rule.** Neighbours are still prefetched only once the current window settles. No lead-ahead prefetch, no unbatched link, no hover/intent prefetch, no month-fetch-and-slice. |
| A2 | **Radius: date windows ±2, page windows ±1.** Whole-list views (the kanban) have none. |
| A3 | **Pending state = skeleton cards.** While a date window's own rows haven't arrived, date views show skeletons, never another window's rows and never an empty-state message. |
| A4 | **The dashboard calendar moves onto `useDataViewQuery`.** One read path for every date view; its month moves into the URL; it inherits the ±2 prefetch (four month-grid reads per dashboard visit, accepted). |
| A5 | **Topic 2's tables need no work here.** Proposals and projects inherit the prefetch when records B5/B6 move them onto `useDataViewQuery`. Campaign leads and the deletion of `usePaginatedQuery` / `fromPaginatedQuery` / `paginatedQueryInput` stay with the records epic, after B7. |
| A6 | **Filter and search changes show skeletons too.** Any change of read on a date view (a window step, a filter, a committed search) shows skeletons until its rows arrive. Keeping the old rows would not be honest: widen a filter and a day that has meetings still says "No events" until the response lands. |
| A7 | **The dashboard agenda falls back to the anchor day.** It lists the picked day while that day is inside the loaded window, and otherwise the anchor day (the 1st of the month shown, or today). |
| A8 | **The dashboard calendar gets an error state.** A failed read shows an error line with a retry, never "No meetings on …". |

## 3. Design

### 3.1 Radius

- One constant beside `MAX_PAGE` in `src/shared/dal/lib/query/constants.ts` holds the radius per window kind: page 1, date 2.
- `adjacentDataViewWindows` (`src/shared/dal/lib/query/adjacent-windows.ts`) returns every window within the radius, nearest first: `-1, +1, -2, +2` for a date window, `-1, +1` for a page window, none for a whole-list view. Each is still derived from URL state the way navigating there would write it.
- Stepping generalises from ±1 to ±k:
  - day: `k` days;
  - week: `7k` days;
  - month: the 1st of the month `k` months away (any day of a month derives the same month grid).
- Page windows keep today's rules: pages below 1 or above `MAX_PAGE` drop, and `useDataViewQuery` still skips pages at or past `total`.
- `usePrefetchQueries` is unchanged: it fires once `ready`, and `prefetchQuery` skips entries still inside `staleTime` (30s). Once a view has settled, each further step usually adds one new read, because the nearer neighbours are already cached.
- The prefetches fire in one effect, so `httpBatchLink` sends them as one batch. That batch holds no read of the current window, so it never delays a window that has already settled. The accepted cost (A1): a click that lands on a neighbour still in that batch waits for the whole batch, meaning the slowest of up to four reads, and shows skeletons meanwhile.

### 3.2 Pending flag and skeletons

- `DateWindowControls` (`src/shared/dal/client/lib/types.ts`) gains one boolean: true while the rows for this window haven't arrived. `useDataViewQuery` sets it to `result.isLoading || result.isPlaceholderData` for a date window. It's false after an error, so an error state still shows.
- `isPlaceholderData` is true for any new query key, not just a new window. So a filter change or a committed search shows skeletons too (A6), and the row-cap notice hides with them.
- `ScheduleCalendar` already receives `dateWindow`. While the flag is true it hands its views no events, and each view draws skeletons in place of its content and its empty-state copy:
  - **Week:** two skeleton cards at meeting-card height in each visible day column.
  - **Day:** skeleton rows in the bucket grid in place of the "No events scheduled for this day" early return. The day view draws no grid without events (its lanes are participant combos), so the pending branch draws the bucket header plus a fixed number of placeholder lanes.
  - **Month** (`CalendarMonthView`, `src/shared/components/calendar/ui/`): skeleton lines in each cell in place of dots.
- The container showing skeletons carries `aria-busy="true"`.
- The week and day views share one skeleton card component, in its own file under `features/schedule-management/ui/components/`. The month view uses the shadcn `Skeleton` inline.
- The meetings and activities calendars both render through `ScheduleCalendar`, so both get this.
- `QueryToolbarRowCapNotice` renders nothing while the flag is true.
- Unchanged:
  - first load on the schedule still shows "Loading schedule…" (`schedule-meetings-calendar.tsx:101`);
  - paginated tables still show the previous page while the next loads;
  - the toolbar's loading hairline keeps shimmering.

### 3.3 Allowed calendar views

- `DataViewWindow`'s date kind (`src/shared/dal/lib/query/data-view-query-config.ts`) gains the list of calendar views the data view allows. The first entry is the default.
- `makeDataViewParsers` parses the view key against that list, with the first entry as its default. `deriveDataViewWindow` falls back to the same entry. A hand-edited URL naming a view the data view doesn't allow therefore reads as the default.
- `useDataViewQuery`'s `setView` ignores a view outside the list, as `setPageSize` already does for page sizes.
- Both schedule configs (`SCHEDULE_MEETINGS_QUERY`, `SCHEDULE_ACTIVITIES_QUERY`) list week, today, month, in that order, so the schedule behaves exactly as today.

### 3.4 Live-outcomes flag on the meetings list

- `meetingsRouter.reads.list` (`src/trpc/routers/meetings.router/reads.router.ts`) extends `meetingListInputSchema` with one optional top-level boolean.
- When it's true, the procedure sets `filters.outcome` to `LIVE_MEETING_OUTCOMES` before calling `listMeetings`, replacing any outcome filter the caller sent.
- This is the existing `segment` pattern (`leadSourcesRouter.getCustomers`, `lead-sources.router.ts:253-271`): the view passes a top-level flag through `useDataViewQuery`'s `extra`, and the procedure pins the filter. The data-view config stays free of pinned values (Deviation 17).
- Only the dashboard sends it. The schedule, the meetings table and the snapshot strip are unchanged.

### 3.5 Dashboard calendar on `useDataViewQuery`

- **Config.** A static config beside the other dashboard builders in `src/features/agent-dashboard/constants/dashboard-queries.ts`, which the page and the hook both import:
  - fields `MEETING_FIELDS`, prefix `dm` (unused anywhere today);
  - no toolbar, default sort `scheduledFor` ascending;
  - date window on `scheduledFor` with cap 500, allowed views month only. The cap is a new `DASHBOARD_LIMITS` entry beside the dashboard's other caps, not an import of the schedule's `SCHEDULE_ROW_CAP`.

  Beside it, one constant for the `extra` object (the live-outcomes flag), so the server prefetch and the client hook can't disagree.
- **One hook, in the hub.** `DashboardMeetingsHub` calls `useDataViewQuery(trpc.meetingsRouter.reads.list, <extra>, <config>)` once and passes the result to `DashboardMeetingsCalendar`:
  - the visible month is the month of `query.window.anchor`;
  - the day picker's month change calls `setAnchor` with the 1st of that month (a history push, so Back steps months, as on the schedule);
  - "Today" calls `setAnchor(undefined)` and resets the picked day, and stays disabled while the viewer is on today in the current month;
  - the picked day stays React state in the hub. The day shown, meaning the picker's selection and the agenda's day, is derived on render (A7): the picked day while it falls inside `query.window.range`, otherwise the anchor day. A fresh load or Back onto another month therefore lands on that month's anchor day, with no effect to sync.
- **Window.** The read covers the month grid (`businessMonthGridWindow`, Sunday before the 1st through the Saturday after the last day). That matches the day picker, which shows outside days, so outside days get their dots. Today only the calendar month is read, and outside days never show one.
- **Pending.** While the flag is true the day picker shows no dots, and the agenda shows `DashboardMeetingsCalendarSkeleton`, which already serves first load. "No meetings on …" shows only for a loaded window.
- **Error (A8).** When the read fails and no rows are on screen, the agenda column shows a short error line and a Try again button (`query.refresh`) in place of the agenda, and the picker shows no dots.
- **Server prefetch.** `src/app/(frontend)/dashboard/page.tsx` takes `searchParams` and prefetches the list with `loadDataViewQueryInput(searchParams, <config>, <extra>)`, replacing `meetingsMonthInput(businessToday())`. The existing hydration parity check covers the key. The comment at `page.tsx:14-16` is already stale (it says only Today's meetings are prefetched, and cites a task), so it goes. The calendar's doc comment (`dashboard-meetings-calendar.tsx:24-37`) describes the old query and is rewritten.
- **Deleted in the same change:**
  - `meetingsMonthInput` (`dashboard-queries.ts`);
  - `meetingMonthWindow` (`agent-dashboard/lib/meeting-windows.ts`), with its import and its one assertion in `scripts/verify-analytics-rules.ts` (lines 11 and 189). `tsconfig` type-checks `scripts/`, so leaving them fails `pnpm tsc`; lines 186–188 still test `businessMonthWindow` directly.

  `meetingWindow` stays: the snapshot strip's "today" count uses it through `meetingsWindowInput`.

## 4. Not in this spec

- **Proposals and projects tables:** they gain previous- and next-page prefetch when records B5/B6 move them onto `useDataViewQuery`. Until then they keep `usePaginatedQuery`'s next-page-only prefetch; the legacy path gets no new work.
- **Campaign leads' field-list move and the deletion of the legacy path:** records epic, after B7 (records spec § "Legacy query path"). The filtering plan's owner hand-off item 3 (add that retirement to the records tracker) is still open; this spec doesn't do it.
- **Other options weighed and left out:**
  - lead-ahead prefetch before the current window settles;
  - an unbatched link for prefetches (`splitLink`);
  - hover or intent prefetch;
  - fetching a month and slicing weeks;
  - `staleTime` and `gcTime` changes.
- **Untouched surfaces:**
  - first-load UI on the schedule;
  - table paging behaviour.
- **Spec B's work:** entity-action dialogs and the card weight in the calendar.

## 5. Names (approved by the owner, 2026-09-29)

| Name | Meaning | Where |
|---|---|---|
| `ADJACENT_WINDOW_RADIUS` | how many windows either side of the current one are prefetched, per window kind (`{ page: 1, date: 2 }`) | `dal/lib/query/constants.ts` |
| `isPending` | on `DateWindowControls`: true while this window's own rows haven't arrived (first load, or another window's rows are on screen) | `dal/client/lib/types.ts` |
| `views` | on the date window config: the calendar views a data view allows; the first is the default | `dal/lib/query/data-view-query-config.ts` |
| `liveOnly` | top-level input on `meetingsRouter.reads.list`: only meetings with a live outcome (`LIVE_MEETING_OUTCOMES`) | `meetings.router/reads.router.ts` |
| `DASHBOARD_MEETINGS_QUERY`, `DASHBOARD_MEETINGS_EXTRA` | the dashboard calendar's data-view config, and the `extra` both the page and the hook pass | `agent-dashboard/constants/dashboard-queries.ts` |
| `dm` | the dashboard calendar's URL prefix (`dm_d` = anchor day) | same |
| `ScheduleCardSkeleton` | the skeleton card the week and day views draw while pending | `schedule-management/ui/components/schedule-card-skeleton.tsx` |

`isPending` is a different thing from TanStack's query-level `isPending` ("no data yet for this key"). It lives on the window controls (`query.window.isPending`), never on the query result, to keep the two apart.

## 6. Files

| File | Change |
|---|---|
| `src/shared/dal/lib/query/constants.ts` | radius constant |
| `src/shared/dal/lib/query/adjacent-windows.ts` | radius, ±k stepping |
| `src/shared/dal/lib/query/data-view-query-config.ts` | date window `views` |
| `src/shared/dal/lib/query/derive-data-view-input.ts` | view parser and fallback use `views` |
| `src/shared/dal/client/lib/types.ts` | `DateWindowControls.isPending` |
| `src/shared/dal/client/hooks/use-data-view-query.ts` | sets `isPending`; `setView` guard |
| `src/shared/components/query-toolbar/ui/row-cap-notice.tsx` | hidden while pending |
| `src/features/schedule-management/constants/schedule-queries.ts` | `views` on both configs |
| `src/features/schedule-management/ui/components/schedule-calendar.tsx` | no events while pending; passes the flag down |
| `src/features/schedule-management/ui/components/schedule-week-view.tsx` | skeletons while pending |
| `src/features/schedule-management/ui/components/schedule-today-view.tsx` | skeletons while pending |
| `src/features/schedule-management/ui/components/schedule-card-skeleton.tsx` | **new** |
| `src/shared/components/calendar/ui/calendar-month-view.tsx` | skeleton lines while pending |
| `src/trpc/routers/meetings.router/reads.router.ts` | `liveOnly` |
| `src/features/agent-dashboard/constants/dashboard-queries.ts` | dashboard config and extra; `meetingsMonthInput` deleted |
| `src/features/agent-dashboard/lib/meeting-windows.ts` | `meetingMonthWindow` deleted |
| `scripts/verify-analytics-rules.ts` | `meetingMonthWindow` import and assertion removed |
| `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx` | the hook; month from the anchor; the day-shown fallback; Today |
| `src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx` | takes the query result; pending; error line; doc comment rewritten |
| `src/app/(frontend)/dashboard/page.tsx` | `searchParams`; loader prefetch; stale comment removed |
| `docs/ubiquitous-language.md` | the two meetings-calendar paths (§9) |

Nothing outside this list changes. `package.json`, the tRPC provider, the query client and shared configs are untouched.

## 7. Build order

One commit each, by explicit path.

1. **Radius:** constants, `adjacent-windows.ts`. The schedule then prefetches ±2 with no other change.
2. **Pending:** `types.ts`, `use-data-view-query.ts` (flag), row-cap notice, `ScheduleCalendar`, the three views, the skeleton card.
3. **Dashboard:** in this order:
   1. `views` in the config, parsers and hook, with the schedule configs updated in the same commit;
   2. `liveOnly`;
   3. the dashboard config, hub, calendar and page;
   4. the two deletions, with the `verify-analytics-rules.ts` import and assertion.
4. **Docs:** the two meetings-calendar paths in `docs/ubiquitous-language.md`.

## 8. Verification

- **Checks:** `pnpm tsc` and `pnpm lint` clean after each commit. No `pnpm build`, no DB writes.
- **Window stepping:** a throwaway `tsx` check (scratchpad, not committed) of `adjacentDataViewWindows`:
  - ±2 for day, week and month;
  - across a month edge, a year edge, and a DST change in the business timezone;
  - page 1, page 2 and the last page.
- **Browser:** a local Playwright script using `/api/dev/playwright-session`, kept in the scratchpad and not committed. It runs the same way before (at `2495d193`) and after, on the dev build:
  - **Schedule, week view:** click Next five times at 150, 300 and 600ms intervals, then Previous back. Then toggle a filter and commit a search: skeletons until the rows arrive, never "No events" (A6).
  - **Dashboard:** step the month forward and back three times at the same intervals. Then:
    - load `/dashboard?dm_d=` two months ahead, then press Back: the agenda lists the anchor day of the month shown, never a day outside it (A7);
    - abort the list request (Playwright `route.abort`): the agenda shows the error line and Try again, never "No meetings on …" (A8).
  - **Per landing it records:**
    - the time from click until the window's own rows render;
    - whether a window that has meetings ever showed an empty-state message (target: never; skeletons instead);
    - the list reads and HTTP batches sent.
  - **Also:** a fresh load of `/dashboard` and `/dashboard/schedule` logs no hydration-parity warning, and the dashboard's outside days show dots where the dev data has meetings.
- **UI pass:** the skeletons get the owner's usual UI pass (web-design-guidelines, then /impeccable) before they're called done.

## 9. Drift found while writing this (ruled 2026-09-29)

- ⚠️ `docs/ubiquitous-language.md:211-212` places the meetings calendar at `meeting-flow/ui/components/calendar/meeting-calendar*.tsx`; it lives in `src/features/schedule-management/ui/components/` (`schedule-meetings-calendar.tsx`, `schedule-calendar-dot.tsx`). **Ruled:** update the two paths (build step 4).
- ⚠️ The session brief cites a "Rulings (not stalls)" feedback note; no memory file by that name exists. No action unless the owner asks for the note.
