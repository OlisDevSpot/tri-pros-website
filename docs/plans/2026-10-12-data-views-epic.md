# Data views — Epic Tracker

> **Status:** 🔨 **BUILDING.** DV0 (instant tab return) and DV1 (edge-to-edge) are on prod. DV2 (the data-view spec) was approved on 2026-10-14. Next is the DV3 plan.
> **Started:** 2026-10-12, when the owner re-anchored the dashboard work on one structure: an entity rendered in a data view.
> **This file is the live index of the order.** Update it as each step lands, and cite its IDs (DV1…) in specs, plans and commits. It holds no design. The design lives in the specs below, and the entity-table work keeps its own tracker.
> **Baseline:** `origin/main` at `eff6ff23f` (2026-10-13).

**Goal in one line:** any data view of any entity, in any feature or component, shows that entity's records the same way and opens instantly, because the business runs on these views all day.

**Owner's principle (2026-10-12):** the unit is *an entity displayed in a data view* (for example, a meeting shown in a table, or customers shown in a kanban). It is not a page-specific composition. Every table, calendar, kanban or card list is built from the same parts, so a new view of any entity is configuration, not new UI. Reading the data quickly is part of the structure, not an afterthought for each route.

Legend: `[ ]` open · `[~]` in progress · `[x]` done · ⏸ waiting on another step.

---

## 1. The model

Each layer is defined in exactly one place:

| Layer | What it is | Defined in |
|---|---|---|
| **Entity data** | One field list per entity (filters, sort, the server's SQL), read through `useDataViewQuery` with a static config, fixed filters and windows | `docs/plans/2026-09-26-records-management-epic.md` D29, D60, D62; code `src/shared/dal/` |
| **Entity table** (L1) and **table view** (L2) | How one entity is shown, fetched and acted on in a table (`use<Entity>Table`), and one feature's configuration of it | records tracker §1, D45, D65 |
| **Data view** | One surface showing one entity's records: a query inside a `DataView` root, composed from `Bar`, `Title`, `Count`, `Toolbar`, `Body` and `Empty`. The body (`DataTable`, `ScheduleCalendar`, `KanbanBoard`) is the presentation. | `docs/superpowers/specs/2026-10-07-data-view-surface-design.md` §2–§4 |
| **Orchestrator** | The page or component that mounts data views and writes the wrapper around their parts | data-view spec §2 |
| **Action host** | One host per entity per view, so cards and rows mount no dialogs of their own | `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md` §3.2 (shipped) |
| **Loading screen** | The page's own component under `DataViewPending`, so each data view shows its cached rows on the first frame | data-view spec §3.0, §3.7–§3.8; instant tab return (below) |

Vocabulary is in data-view spec §2. Any new name goes to the owner first.

---

## 2. Order

One step at a time, in this order (D67), unless the step itself says otherwise.

| ID | Step | Source of truth | Status |
|---|---|---|---|
| **DV0** | **Instant tab return.** A return shows cached rows at once, refreshes silently, and keeps rows that failed to render inside their own view. The client cache lasts 30 min. Home has a loading screen, and the week view opens on today. | shipped; spec and plan deleted (git history: `8a2eb20f8`); the rulings are §3 below | [x] on prod (`0a7b6814d..77febe8dd`). Owner's production check (A1) is still open. |
| **DV1** | **Edge-to-edge layout.** On a phone, page scrollers run to the screen edge, pages scroll behind the dock, and the table card rides along. It goes first because it rewrites the frames the data-view parts wrap. | shipped; spec and plan deleted (git history: `690c63408`, `eff6ff23f`); the rule lives in `docs/codebase-conventions/app-shell.md#page-insets-and-bleed` | [x] on prod 2026-10-13 (`25e677167..eff6ff23f`) |
| **DV2** | **Data-view spec approved.** This is the 2026-10-07 design as amended on 2026-10-12 to match DV0 (§11 #13–#16). Its facts were re-checked on 2026-10-13 against the shipped DV1 and #285 code (the line references, `Body`'s no-horizontal-clip rule, and the cache that clears on a user change), and the line references again at `2ef151415`. | data-view spec | [x] approved by the owner 2026-10-14, #16 included |
| **DV3** | **Data-view phase 1: the compound and the tables.** This covers `DataView` and its parts, with `EntityRecordsTable` rebuilt on them. Meetings and projects move through it. Proposals is composed by hand, and its route moves onto the loading-screen rule. The table's own dim and empty row go. | data-view spec §6; plan `docs/superpowers/plans/2026-10-13-data-view-phase-1.md` (to write) | [ ] plan next |
| **DV4** | **R2 Part 2: the customers entity table.** This adds `useCustomersTable`, the records page and the two lead-sources panes as table views composed from the parts, and `leadSourcesRouter.getCustomers` goes. The customers route moves onto the loading-screen rule. | records tracker R2 and D64–D66; plan `docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters-part-2.md`. Its Task 2 Steps 3–4 are sketches to re-check against DV3's code. The whole plan (written 2026-10-05) is also re-checked against the customer files #285 units 1–3 changed, which shipped first (DV7). | ⏸ DV3 |
| **DV5** | **Data-view phase 2: the calendars.** Schedule meetings, schedule activities and the dashboard meetings hub, built on the shipped action hosts. | data-view spec §4, §6; plan to write | ⏸ DV3. May interleave with DV4. |
| **DV6** | **Data-view phase 3: the kanban.** The pipeline view. Its boundary moves inside the view, onto the loading-screen rule, and its move settle passes through `Body`'s `className`. | data-view spec §3.5, §4, §6; plan to write | ⏸ DV3. May interleave with DV4. |
| **DV7** | ~~**#285 permissions rebases onto R2.**~~ **Overtaken:** #285 units 1–3 (the Customer, Meeting and Proposal families on compiled rules) shipped before R2, on 2026-10-12 (`b17417fd0`). The dependency now runs the other way: DV4 re-checks against them. Part 4 (the Project family, 5 commits at `bc8149a87` on its branch) ships on its own schedule. It touches only `projects-records-table.tsx`'s `headerActions` among DV3's files. | records tracker H3; the #285 worktree | [x] n/a (overtaken) |

**After DV6.** These are owned by other trackers and listed here so the sequence is visible end to end:

| ID | Step | Owner | Status |
|---|---|---|---|
| **DV8** | **R3: proposals entity table.** Moves proposals onto `PROPOSAL_FIELDS`, ends `fromPaginatedQuery`, and gives proposals an entity table and table view. | records tracker R3 (D46, D50), after the approval-route session | [ ] |
| **DV9** | **Bulk selection and actions on all four tables, then the legacy query path goes.** | records tracker B2–B4 (D49, D57) | [ ] |
| **DV10** | **Loading screens for the routes that have none.** These are the meeting, proposal and project detail pages, analytics, lead sources and campaigns. The remaining query-pattern questions (freshness per entity family, polling, the server prefetch on soft navigations) are part of this step too. | `docs/superpowers/specs/2026-10-09-dashboard-navigation-cache-design.md` (DEFERRED; grill before a plan) | [ ] after DV6 |
| **DV11** | **Dashboard card lists and customer-profile lists as data views.** Today these are custom reads through `useLoadingScreenRead`. | data-view spec non-goals, D62 | [ ] not scheduled |

---

## 3. Rulings this epic follows

**D-rulings** live in the records tracker; the newest wins:
- **D29:** filtering is a data-access concept.
- **D45:** an entity table is the headless hook.
- **D64:** R2's order.
- **D65:** one `DataView` compound.
- **D66:** R2's Schedule Meeting.
- **D67:** the data-view spec follows instant tab return; edge-to-edge goes first.

The data-view spec's decisions are in its §11, #1–#16.

**Instant tab return, R1–R9** (owner, 2026-10-09 → 2026-10-12). They are kept here so the DV0 spec and plan can be deleted now that they have shipped:

| # | Ruling |
|---|---|
| R1 | Every return refetches, and the cached rows show while it does. A return within 30 s refetching is fine. |
| R2 | On an in-app navigation, the server's streamed copy is the refresh (one read per navigation). Back/Forward replays Next's cached page and refetches only once the rows are past `staleTime`. |
| R3 | `staleTime` stays 30 s. Client `gcTime` is 30 min (the server's is unchanged) until Ably realtime takes over freshness. |
| R4 | The refresh hairline shows only while refetching rows older than `staleTime`, or invalidated by a save or the refresh button. A return within 30 s refreshes silently. **Nothing dims on a refresh** (re-affirmed 2026-10-12, D67). |
| R5 | Scope: the six routes with a loading screen plus dashboard home. Detail pages, analytics and lead sources wait for DV10. |
| R6 | Names: `useLoadingScreenRead`, the route group `(home)`, and the term "loading screen" (a `CONTEXT.md` entry is owed, A3). |
| R7 | A data view's error fallback stays row-less (`DataViewPendingContext` is `'error'`), so rows that failed to render never escape their boundary. |
| R8 | Home's loading screen greets by name from the client session. |
| R9 | The R4 rule lives in the two shared read hooks, so every data view inherits it. |

---

## 4. Owner actions

| ID | Action | Status |
|---|---|---|
| **A1** | Production check for DV0: no skeleton flash on any return to pipeline, schedule, meetings, projects, proposals, customers or home. Dev can't show it, because dev doesn't prefetch `loading.tsx`. | [ ] |
| **A2** | Review the amended data-view spec (DV2), including Claude's call in §11 #16 (`Count` renders nothing on the error screen). Then commit it with the D67 row in the records tracker and this file. | [x] 2026-10-14 |
| **A3** | Glossary in `CONTEXT.md`, once the session holding it releases the file: *data view*, *body*, *orchestrator*, *loading screen*, *pending view*. | [ ] |
| **A4** | Delete the shipped DV0 spec and plan. This tracker's §3 keeps the rulings. First, re-point the data-view spec's citations of the DV0 spec (header, §3.0, §9) to this file. | [x] 2026-10-14 |
| **A5** | Re-point three plans that still cite the old `dashboard/page.tsx` path, which is now `dashboard/(home)/page.tsx`: the customers entity table plan, the data-view date windows plan, and the PWA cold start plan's build-manifest key `'/(frontend)/dashboard/(home)/page'`. | [ ] |

---

## 5. Hazards

- **H1 · Shared files across DV1, DV3, DV5 and DV6.** Edge-to-edge edits `data-table.tsx`, `RecordsPageFrame`, the schedule calendar and `customer-pipeline-view.tsx`, and each data-view phase edits the same files after it. DV1 has landed, and the spec's references were re-checked at `eff6ff23f` and again at `2ef151415`. DV1 also leaves a rule the parts must keep: nothing between `<main>` and a bleeding body clips the x axis, so `DataView.Body` never clips horizontally (`app-shell.md#page-insets-and-bleed`; spec §3.5). Each task runs `git status --short <file>` first and stops on another session's changes.
- **H2 · Dev hides the loading screen.** Dev doesn't prefetch `loading.tsx`, and the server's copy arrives already resolved. Instant-return checks therefore run under CDP throttling (latency 300 ms, 60 000 B/s).
- **H3 · Hydration (records tracker H2, H6).** A table view's key-relevant config is one static constant shared by the server loader and the client hook. A provider above the dashboard pages changes after hydration only inside a transition.
- **H4 · A route composing its boundary twice.** Until DV3, DV4 and DV6 land, customers, proposals and pipeline compose `DataViewBoundary` in `page.tsx` and again in their loading screens (data-view spec §3.8). A new route must not copy that shape. It follows meetings and projects instead.
- **H5 · Double read past 30 s.** The page's observer refetches before the boundary adopts the server's copy (TanStack #9610; fix PR #9968 unreleased). Rows still refresh in place. Re-check when TanStack ships the fix.

---

## 6. Verification carried between steps

Every step that touches a data view re-runs these, read-only, on the dev server:

- **Instant-return checks**, throttled: a return shows cached rows, nothing dims, the hairline shows only past 30 s, and a bad cached row stays inside its view. The scripts live in the git-ignored `.superpowers/sdd/2026-10-12-instant-tab-return/` (`check-return.mjs`, `check-error-return.mjs`, `check-home.mjs`, `check-week-entry.mjs`, shared `check-lib.mjs`). Copy them into the next plan's workspace before that directory is cleaned.
- **Render probes:** `node scripts/perf/records-probe.mjs /dashboard/meetings`, plus the pipeline and schedule probe for DV5 and DV6. Compare before and after.
- **Edge-to-edge's layout probe** once DV1 creates it (`scripts/perf/layout-probe.mjs`).
- **Type check and lint:** `pnpm tsc` and `pnpm lint`. Never `pnpm build`. No database writes, dev included.

---

## 7. Deferred minors (from DV0's final review)

- The schedule highlight's pending gate reads the context above `ScheduleView`'s boundary, so it doesn't see a boundary's own fallback. This is harmless today. Revisit in DV5.
- The `isPending` doc in `src/shared/dal/client/lib/types.ts` doesn't mention the error fallback. Fix it in DV3, when `Count` starts reading it.
- The custom-read options type (`UnusedSkipTokenOptions<…>`) is written out in three home files. Give it one shared name (owner approves the name) when DV11 or another custom read needs it.
