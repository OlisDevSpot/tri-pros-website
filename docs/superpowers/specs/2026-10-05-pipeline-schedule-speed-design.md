# Pipeline and schedule speed: the records-page fixes, one action host per view, stage paging

> **Status:** design approved 2026-10-05. **Phase 1 shipped 2026-10-07** on local main (acceptance: `.superpowers/sdd/2026-10-06-pipeline-schedule-speed-phase-1/acceptance.md`; the final schedule probe waits on the meetings schema push); Phases 2 and 3 not started.
> **Supersedes** the "Spec B (one entity-action host per view)" pointer in `docs/superpowers/specs/2026-09-29-data-view-date-windows-design.md`.
> **Cites:** records tracker `docs/plans/2026-09-26-records-management-epic.md` §7 (A4–A10 stay there); render-isolation acceptance `.superpowers/sdd/2026-10-01-records-table-render-isolation/acceptance.md` (the measurement method this spec reuses).
> **Order (owner, 2026-10-07; records tracker D64):** records R2 (customers entity table and fixed filters, `docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md` and `…-part-2.md`) lands **before Phase 2 and Phase 3**. R2 moves `entities/customers/components/lists/customer-meetings-list.tsx` to `entities/meetings/components/`, and `customer-projects-list.tsx` and `project-entity-card.tsx` to `modules/projects/core/components/`; it adds `fixed` filters and a `{ kind: 'first', count }` window to the data view (the files Phase 3 edits). Phase 2's plan names the moved paths; Phase 3's `grouped` kind is added beside `first`, and its window-kind switches cover all five kinds.
> **Baseline + probe (gitignored):** `.superpowers/harness/pipeline-schedule-perf/` — `probe.mjs`, `step.mjs`, `baseline-2026-10-05/*.txt`.

## 1. Why

The four records pages got a speed pass in October (streamed rows, an instant shell on click, one fade, memoized rows, one action host per table). `/dashboard/pipeline/[pipeline]` and `/dashboard/schedule` render the same entities through cards and got none of it. Measured 2026-10-05 against the dev server (medians; dev React is several times slower than production, so compare columns with each other):

| | Meetings table (reference) | Schedule | Pipeline: Fresh | Rehash | Leads |
|---|---|---|---|---|---|
| Items on screen | 20 rows | 13 cards | 50 cards | 179 | 512 |
| Server HTML | 559 KB | 417 KB | 696 KB | 1,066 KB | 2,403 KB |
| Document load → interactive | 3.0 s | 3.0 s | 3.4 s | 4.5 s | 6.7–18 s |
| Sidebar click → fully shown | 1.1–1.4 s | 1.2 s (empty week) | 2.6–3.3 s | — | — |
| DOM nodes | 1,804 | 1,190 | 4,114 | 6,952 | 17,096 |
| `useMutation` observers mounted | 32 | 304 | 1,275 | 540 | 1,539 |
| Closed dialogs mounted | < 22 | 71 | 337 | 359 | 1,025 |
| Customer profile opens in | 0.24 s | 0.21 s | 0.41 s | 0.71 s | 1.67 s |

Causes, each verified in code:

1. Every `MeetingOverviewCard` runs `useMeetingActionConfigs` itself (21 `useMutation` hooks, four dialogs), every `ProposalOverviewCard` runs `useProposalActionConfigs`, and every kanban card adds `useCustomerActionConfigs` and `useProjectActionConfigs`. The records tables call these once per table and hand rows `meta.rowActions`.
2. `customer-pipeline-view.tsx` and `schedule-view.tsx` wrap the page in `motion.div` with `delay: 0.25, duration: 0.25, y: 30` on top of the dashboard template's own 0.2 s fade. Content sits invisible 520–670 ms after it is in the DOM, on every navigation and every pipeline switch. `use-schedule-highlight.ts` waits 600 ms because of it.
3. Neither route has a `loading.tsx`; the pipeline is missing from `DASHBOARD_ROUTE_PENDING_VIEWS` (an exact-path map), so the first paint of a document load shows the generic skeleton.
4. While a board's rows load, every stage reads "No <stage>" (`KanbanEmptyColumn`), then the cards drop in.
5. `usePipelineChange` calls `invalidateCustomer()` before `router.push`, so a switch never reuses the 30 s cache. Rehash → Fresh took 5.3 s before the URL changed.
6. `getFreshPipelineItems` runs its three follow-up queries one after another; they are independent.
7. The kanban read is `window: 'whole-list'` with no limit, and the board renders every card. On Leads, opening a profile costs 1.56 s of style recalculation over 17,000 nodes; React's share is 0.1 s.
8. Kanban cards render twice on mount (each calls `useIsMobile()`, whose state flips after mount); schedule cards render two to three times (`MeetingCard` is not memoized and rebuilds its data object every render). A cached week step costs 315–533 ms although the read takes 114–195 ms.

Already at parity: rows arrive in the server HTML; no hydration warnings; opening a modal re-renders no cards; participants load lazily; the schedule prefetches ±2 weeks.

## 2. Rulings (owner, 2026-10-05)

| # | Ruling |
|---|---|
| R1 | **Big boards page by stage.** Each stage shows a first page and loads more on demand; no virtual scrolling; never "render everything and only lighten the cards". |
| R2 | **The board gets the records tables' per-page control**, through the standard query toolbar: options 10 / 20 / 50 / 100, default 20, kept in the URL. It is query-level paging, not a display trick. |
| R3 | **Stage counts, stage dollar totals and the stat bar describe the whole pipeline under the current filters**, never just the loaded cards. Every number must match today's before the switch. |
| R4 | **Not TanStack infinite queries.** Explored (Context7 + installed source, 2026-10-05): they fit the board but add up to 11 reads per board, a compute-once-per-request layer for Fresh, an infinite twin of `useDataViewQuery` and a streaming path this app has never run, for a load-more payload difference nobody would notice at these sizes. Revisit only if reps routinely load hundreds deep in one stage. The read's contract below lets that swap happen internally. |
| R5 | **No spike first.** Design and build directly. |
| R6 | **Cards require a host, with no fallback.** A card rendered outside its host fails loudly in development. Every view that shows the cards changes in the same commit as the cards (non-defensive migration). |
| R7 | **How many cards each stage has loaded lives in the URL**, like a table's page. Back and reload restore the board; a filter, sort, search or page-size change resets it. |
| R8 | **A successful drag shows a toast naming the new stage**, because with paging the moved card can land below the loaded slice. |
| R9 | **Records tables stay on numbered pages.** Infinite scrolling for records on phones would be a product change, not part of this. |

## 3. Design

Three phases, in order, one implementation plan each. Each phase ends with the probe (§5) and the checks in §6, and the next phase starts from the re-measured numbers.

### 3.1 Phase 1 — the records fixes, carried over

**One fade.** `customer-pipeline-view.tsx` and `schedule-view.tsx` lose their `motion.div`; a plain `div` keeps the layout classes. The dashboard template still fades every soft navigation. `useScheduleHighlight`'s `SCROLL_DEFER_MS` drops from 600 to 250 (the template fade is 200 ms). The iOS reason for the wait stays in its comment; the owner checks the highlight scroll on an iPhone (§6).

**Instant shell on click.** `src/app/(frontend)/dashboard/pipeline/[pipeline]/loading.tsx` renders `<DataViewPending><CustomerPipelineView /></DataViewPending>` (the segment layout already provides `PipelineProvider`). `src/app/(frontend)/dashboard/schedule/loading.tsx` renders `<DataViewPending><ScheduleView /></DataViewPending>`. `DASHBOARD_ROUTE_PENDING_VIEWS` gets one entry per pipeline path (built from the `pipelines` enum) pointing at a `PipelineRoutePendingView` that wraps the view in `PipelineProvider` (the layout skeleton renders above the segment layout).

**Skeleton cards while a board loads.** `KanbanBoard` takes `isPending` from the view (`query.isPending`) and passes it to its columns; a pending `KanbanColumn` shows `KanbanCardSkeleton`s instead of `KanbanEmptyColumn`: a seeded 1–3 per stage (`seededIntInRange(stage.key, KANBAN_SKELETON_CARDS_PER_STAGE)`), the same device the schedule uses for its days. The empty message is for an empty stage with data in.

**Pipeline switch keeps the cache.** `onPipelineChange` loses its `invalidateQueries` step and `usePipelineChange` no longer passes one. `PIPELINE_SCOPED_KEYS` and the storage keys `MEETINGS_SCOPE` / `PROPOSALS_SCOPE` go: nothing reads them (verified 2026-10-05; the only reader of the stored pipeline is the sidebar and the mobile dock, for the link target). The `[pipeline]` segment still remounts the view on a switch; the cached read makes that a cache hit.

**Fresh read.** The proposal summary, rep and proposal-detail queries run under one `Promise.all`.

**Dead prop.** `schedule/page.tsx` passes `HydrateClient` a `fallback` that can never show (the view's `DataViewBoundary` suspends first); it goes.

### 3.2 Phase 2 — one action host per view

**Hosts.** One host component per entity, each at its module's address (a new file goes where its module will be: owner rule 2026-10-05, applied to customers and meetings 2026-10-07; R2 put the first customers files under `modules/customers/core/`), each a thin client component that calls the existing action-config hook once with the view's overrides, renders that hook's dialogs once, and provides the result through a context:

| Host | Calls | Provides |
|---|---|---|
| `MeetingActionsHost` (`shared/modules/meetings/core/components/meeting-actions-host.tsx`) | `useMeetingActionConfigs(overrides)` | `actions`, `changeOutcome`, `manageParticipants(meetingId)` — the host also owns the one `ManageParticipantsModal` |
| `ProposalActionsHost` (`shared/modules/proposals/core/components/proposal-actions-host.tsx`) | `useProposalActionConfigs(overrides)` | `actions` |
| `CustomerActionsHost` (`shared/modules/customers/core/components/customer-actions-host.tsx`) | `useCustomerActionConfigs(overrides)` | `actions` |
| `ProjectActionsHost` (`shared/modules/projects/core/components/project-actions-host.tsx`) | `useProjectActionConfigs(overrides)` | `actions` |

Each host exports its reader hook (`useMeetingActionsHost()` …), which throws `"<Card> needs a <Host> above it"` when no host is mounted (R6). Overrides are the hooks' existing entity-taking signatures (`onView(entity)`, `onAssignOwner(entity)` …), so one `actions` array serves every card in the view, as it serves every row in a table.

**Cards.** `MeetingOverviewCardRoot` and `ProposalOverviewCardRoot` stop calling the config hooks and rendering dialogs; they read `actions` (and `changeOutcome`) from their host. `MeetingOverviewCardRoot` loses its `onAssignOwner` / `onAssignProject` / `customerId` props: `MeetingOverviewCardData.customerId` becomes required (every caller has the customer id at hand; the plan confirms each) and the card's own click and the host's `onView` read it from the entity. `CustomerKanbanCard` reads customer and project actions from the hosts and renders no dialogs. `ParticipantsSlot`'s compact variant calls `manageParticipants(meetingId)` from the meeting host instead of mounting a `ManageParticipantsModal` per card.

**Views that mount hosts** (every importer of the cards, checked by grep in the plan): the pipeline board (all four hosts), `ScheduleMeetingsCalendar` (meeting host; its month-dot `actions` come from the same host), the dashboard home sections (`dashboard-day-agenda`, `dashboard-proposal-section-list`, `dashboard-project-section-list`), the customer profile tab panels, `project-meeting-list` (meeting + proposal), the meetings table's expanded row (`meeting-row-panel`: proposal host) and the projects table's sales-history pane. Tables keep calling the config hooks in their table hooks; they already are one host per view.

**Card hygiene.** `MeetingCard` (schedule) is memoized and builds its `MeetingOverviewCardData` with `useMemo` on `event`. `CustomerPipelineView` reads `useIsMobile()` once and passes `isMobile` to the card through `renderCard`; `CustomerKanbanCard` stops calling it.

**Re-measure, then decide.** After the hosts land, the probe runs again. If a card's mount cost is still over target (§5), the next step is `EntityActionDropdown` and the card popovers rendering a plain trigger until first pointer-down or focus, then mounting the Radix tree with `defaultOpen`. That step also lightens table rows (61 menus for 20 rows today) and is taken only on the numbers.

### 3.3 Phase 3 — stage paging

**A fourth window kind.** `DataViewWindow` gains `{ kind: 'grouped', pageSize, pageSizeOptions }`. In the query layer the word is *group*; the board maps a group to a stage. `CUSTOMER_PIPELINE_QUERY.window` becomes `{ kind: 'grouped', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS }`.

**URL.** Two keys per prefix: the existing `${prefix}_ps` (page size, validated against the options as the page kind does) and a new `${prefix}_more` (`'more'` joins `RESERVED_URL_SUFFIXES`), a string of `group:extraPages` pairs (`cp_more=new:2,contacted:1`). `setFilter`, `setSearch`, `setSort` and `setPageSize` clear `_more` the way they reset a page today; `loadMore(group)` adds one to that group's count with `history: 'replace'`; a filter, sort, search or page-size change on a grouped window therefore shows the first page of every stage again.

**Input.** `DataViewInput` gains `groupLimits?: Record<string, number>`: the rows wanted per group, `pageSize × (1 + extraPages)`, only for groups with extra pages; `pagination` carries `{ limit: pageSize, offset: 0 }` as the default for every other group. `fieldListInput(fields, { pagination: 'grouped' })` adds `groupLimits: z.record(z.string(), z.number().int().min(1).max(500)).optional()`; `'groupLimits'` joins `RESERVED_QUERY_INPUT_KEYS`. `loadDataViewQueryInput` derives it from the same URL, so the server prefetch and the hook's first key match.

**Output.** A grouped read returns `GroupedResult<T> = { rows: T[], total: number, groups: Record<string, { total: number }> }` plus whatever else the procedure adds. The hook exposes the rest as `query.summary` (`DataViewSummaryOf<TProcedure>` = the output minus `rows`, `total`, `groups`). `adjacentDataViewWindows` returns none for a grouped window.

**Window controls.** `{ kind: 'grouped', pageSize, pageSizeOptions, setPageSize, groups: Record<string, { total, shown, hasMore, loadMore, isLoadingMore }> }`. `shown` counts the rows in `rows` for that group; `hasMore = shown < total`. `isLoadingMore` is true while the requested key differs from the shown key only in `groupLimits`; the hook's `isStale` stays false for that case, so the board does not dim and the old cards stay while the next slice loads.

**Server.** `getCustomerPipelineItems` builds the pipeline's items exactly as today, then:

- `sliceGroups(items, item => item.stage, { pageSize, groupLimits })` (`shared/dal/server/lib/query/slice-groups.ts`) returns `rows`, `total` and `groups[stage].total`;
- `computePipelineSummary(pipeline, items)` (`shared/domains/pipelines/lib/compute-pipeline-summary.ts`, pure) returns `{ stageValues: Record<stage, number>, stats: Record<statKey, number> }` from the full list. The `getValue` functions in `pipeline-stat-config.ts`, `fresh-stat-config.ts` and `projects-stat-config.ts` move into it unchanged; the stat configs keep `key`, `label`, `icon`, `renderValue`.

Fresh and Projects compute every customer's stage in code, so the database work is unchanged; what shrinks is everything after it. Leads and Projects store the stage in a column, so `getLeadsPipelineItems` and `getProjectsPipelineItems` may later page in SQL behind the same output (R4).

**Stat bar.** `StatBar` takes `values: Record<string, number>` instead of `data` and `getValue`; `CustomerPipelineMetricsBar` passes `query.summary.stats`. The pipeline metrics bar is `StatBar`'s only consumer.

**Board.** `KanbanColumn` gets `total`, `valueTotal`, `hasMore`, `isLoadingMore` and `onLoadMore`. The header shows `total` and `valueTotal` from the summary (today it counts and sums the loaded items). When `hasMore`, the column ends with a `KanbanLoadMoreRow`: "20 of 143 · Load 20 more", disabled with a spinner while `isLoadingMore`. The toolbar's page-size control (`QueryToolbarPageSize` on desktop, `PageSizeSegmented` in the filter sheet on phones) accepts the grouped kind; `QueryToolbar.Standard` gains `pageSizeLabel` (default "Rows"), and the pipeline view passes "Per stage". The chip-rail keyboard hint and the prev/next shortcuts stay page-only.

**Moves.** `moveMutation.onSuccess` toasts "Moved to <stage label>" (R8). The refetch after a move is one request, as today.

**Glossary.** `docs/ubiquitous-language.md:272` says the Rehash/Dead stage is stored; `pipeline-items.ts` assigns every Rehash/Dead customer one fixed stage and the move procedure refuses Rehash/Dead drags. The line is corrected to "computed for Fresh, stored for Projects and Leads, fixed for Rehash/Dead until those boards get stages".

## 4. Names to approve

| Name | What it is |
|---|---|
| `'grouped'` | the fourth `DataViewWindow` kind (alternatives: `'stage-pages'`, `'per-group'`) |
| `_more` | URL suffix holding extra pages per group |
| `groupLimits` | read-input field: rows wanted per group |
| `GroupedResult<T>`, `groups` | the read's output shape and its per-group field |
| `query.summary`, `DataViewSummaryOf` | the procedure-specific rest of a grouped read |
| `sliceGroups`, `computePipelineSummary` | the server helpers |
| `MeetingActionsHost` … `ProjectActionsHost`, `useMeetingActionsHost` … | the hosts and their readers |
| `manageParticipants` | the meeting host's opener for the participants modal |
| `KanbanCardSkeleton`, `KANBAN_SKELETON_CARDS_PER_STAGE`, `KanbanLoadMoreRow`, `PipelineRoutePendingView` | board pieces |
| `pageSizeLabel` | `QueryToolbar.Standard` prop |
| `scripts/perf/page-probe.mjs` | the committed probe (today's gitignored `probe.mjs`) |
| `scripts/verify-pipeline-summary.ts` | the parity check (§6) |

## 5. Targets

Same probe, same dev server, compared with the baseline files. Dev numbers; production is checked on a preview deploy for the click-to-shell line, because dev does not prefetch `loading.tsx`.

| Target | Today | Goal | Phase |
|---|---|---|---|
| Time from content in DOM to fully shown, both pages | 520–670 ms | ≤ 250 ms | 1 |
| Document load first paint on both routes shows the page's own pending view | generic skeleton (pipeline) | yes | 1 |
| `useMutation` observers per card | 23–25 | ≤ 1 | 2 |
| Closed dialogs mounted per view | 71–1,025 | ≤ 12, whatever the card count | 2 |
| Renders per card on mount | 2–3 | 1 | 2 |
| Fresh: sidebar click → fully shown | 2.6–3.3 s | ≤ 1.5 s | 1 + 2 |
| Schedule: cached week step | 315–533 ms | ≤ 150 ms | 2 |
| Leads: cards on first paint | 512 | ≤ 80 | 3 |
| Leads: document load → interactive | 6.7–18 s | ≤ 3.5 s | 3 |
| Leads: profile opens | 1.67 s | ≤ 0.4 s | 3 |
| Idle, hover, modal open/close | 0 card renders | 0 | all |
| Hydration warnings | 0 | 0 | all |

## 6. Verification

- `pnpm tsc` and `pnpm lint` per task; `node scripts/perf/page-probe.mjs <page> 3 < /dev/null` per phase, against the baseline files, with the acceptance written as a table like the render-isolation one.
- **Parity (Phase 3, before the switch):** `scripts/verify-pipeline-summary.ts` runs the old client math (`getValue` over the whole list) and `computePipelineSummary` over the same list for the five pipelines, as the admin fixture and as the agent fixture, on the dev database, and prints every stat and every stage value side by side. All equal, or the phase stops.
- **Read-only browser checks** (Playwright, signed in through `/api/dev/playwright-session`): modal open and close from a card on every host view; search and clear; week step; pipeline switch; load more on Leads and Rehash; page size 10 / 50 from both the desktop control and the phone sheet; the loading state of both routes on a document load and on a sidebar click.
- **Owner hand-checks** (writes, per the no-dev-DB-writes rule): drag a card in Fresh, Leads and Projects and see the toast; delete / outcome / reschedule / confirmation / assign-rep / assign-project from a card in each of the six host views; manage participants from a schedule card; the highlight scroll from a push notification on an iPhone.

## 7. Out of scope

- Virtualised columns, SQL paging per stage (R4 keeps the door open), stages for Rehash/Dead.
- Infinite scrolling for records tables (R9).
- Records tracker A4–A10 (participants summary, `withLatestCallbacks` keys, `useInsertionEffect`, invalidation narrowing, list payload trimming, dynamic modals, list SQL indexes). The schedule's per-filter five reads (window + ±2) stay as designed.
- The `useConfirm` remount trap (the dialog component is rebuilt every render): unchanged by the hosts, which render it once per view as the tables do.

## 8. Follow-ups this spec creates

- Delete the gitignored harness folder once `page-probe.mjs` is committed and the acceptance table is written.
- Remove the "Spec B" pointer from the date-windows spec when that spec is deleted (it shipped 2026-10-05).
