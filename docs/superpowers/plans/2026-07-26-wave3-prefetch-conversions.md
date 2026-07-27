# Wave 3 — Server-Prefetch Conversions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the dashboard screens that PASS the when-to-prefetch decision rule to the canonical server-prefetch pattern (fire-and-forget `prefetch()` + `<HydrateClient>` + shared `PaginatedQueryConfig`), extract configs everywhere else, and flip `project/no-inline-table-config` from warn to error.

**Architecture:** Every conversion mirrors the two landed references — `src/app/(frontend)/dashboard/customers/page.tsx` (Tier-2 paginated table) and `src/app/(frontend)/dashboard/campaigns/page.tsx` (Tier-1 suspense). The tier lives in the view hook only; pages never await prefetches and never add `loading.tsx` (governed by the addendum atop `docs/superpowers/plans/2026-07-26-prefetch-hydration-fault-audit.md`).

**Tech Stack:** Next 15.5.9 · @trpc/tanstack-react-query 11.4.1 · @tanstack/react-query 5.80.7 · nuqs 2.8.6.

## Global Constraints

- NEVER `await` a prefetch; NEVER create a `loading.tsx`. Canonical rule: `docs/codebase-conventions/frontend-stack.md#server-prefetch-two-tiers`.
- NEVER run `pnpm build`. Gates per task: `pnpm tsc` exit 0 + `pnpm lint` exit 0.
- `git add` explicit paths only — never `git add -A` (working tree carries unrelated parallel-session files). Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Work on main, one commit per task.
- Key-relevant config (`paramPrefix`/`pageSize`/`pageSizeOptions`/`defaultSort`/`filters`) comes from ONE shared constant consumed by BOTH `loadPaginatedQueryInput` (page) and `usePaginatedQuery` (view). Preserve EXACT current values — changing any of them alters URL params or query keys (forbidden behavior change).
- Named exports only (`page.tsx` default export exempt). Constants live in `constants/` files, never at component-file top level.
- Prefetch calls go in the page function body BEFORE returning JSX; prefetchable inputs derive ONLY from searchParams/route params + shared constants (no `Date.now`/`new Date()`/client state).
- Dev-runtime safety net: the hydration-drift detector (`src/shared/lib/hydration-drift.ts`) console.errors `[prefetch drift]` on any server/client key mismatch — parity mistakes are loud, not silent.

## Per-screen adjudication (2026-07-26 — the when-to-prefetch rule applied, Oliver-directed)

Every screen was scored against the three-condition rule (Task 8 Step 4): (1) primary content of a route-mounted view; (2) input derives entirely from searchParams/route params + shared constants; (3) benefits from cold-load speed or SSR.

| Screen | (1) | (2) | (3) | Verdict |
|---|---|---|---|---|
| Meetings / Projects / Proposals tables | ✅ | ✅ URL-driven pagination | ✅ daily-driver core CRM lists | **CONVERT** (Tasks 1–3) |
| Schedule (calendar) | ✅ | ✅ pure constants (`limit: 500`) — zero parity risk | ✅ daily-driver; two parallel queries both saved a roundtrip | **CONVERT** (Task 4) |
| Settings | ✅ | ✅ | ❌ rarely visited, tiny payloads, brief spinner is fine; suspense refactor = churn for no user-visible win | **DROPPED** — stays plain client fetch (was Task 5) |
| Campaigns leads tab | ✅ (tab is a searchParam) | ⚠️ only after restructuring filter-config plumbing | ❌ admin tool; cold loads of `?tab=leads` are rare (default tab is overview); prefetch would also re-run 3 server queries on every tab switch | **config split only, NO prefetch** (Task 6) |
| Lead-sources analytics | ✅ | ❌ rolling ranges read the clock — condition 2 fails unless we quantize, i.e. change behavior solely to enable prefetch (the rule forbids exactly this contortion) | ❌ occasional admin analytics; range-switching is already smooth client-side via `keepPreviousData` | **DROPPED** — configs extracted (Task 7), prefetch dead (was Task 9); **floor-to-hour quantization RESCINDED** — its only purpose was prefetch parity |

The eslint flip (Task 8) survives the trim: the 7 `no-inline-table-config` offenders are covered by Tasks 1–3 (3), Task 4's activities extraction (1), Task 6's static config (1), and Task 7 (2). Settings has no table config.

## Scope notes (decided during planning)

- **Action-center is OUT**: `ActionCenterView` has no route — it's a sheet mounted from the sidebar (`app-sidebar.tsx:300`); there is no `page.tsx` to prefetch from. The audit recipe assumed a route that doesn't exist.
- **Meetings / projects / proposals are IN**: they're 3 of the 7 `no-inline-table-config` offenders and are exact clones of the customers recipe; the eslint flip (Task 8) requires all 7 extracted.
- **Lead-sources is split**: config extraction (Task 7, pure refactor, unblocks the eslint flip) vs prefetch conversion (Task 9 — now DROPPED per the adjudication table above; rolling chips derive `from`/`to` via `new Date()`, which can never key-match between server and client without a behavior-changing quantization).
- **Dynamic filter options** (campaigns-leads): `derive-paginated-query-state.ts:60` only applies `parseAsStringLiteral` validation when `def.options.length > 0` — so a shared static config declaring `options: []` parses as free strings identically on both sides. The static config must be what the HOOK consumes; runtime-merged options feed only the toolbar UI. (The audit's blanket "options are key-IRRELEVANT" note is imprecise post-Wave-1: options are key-relevant when non-empty; Task 8 corrects the doc.)

---

### Task 1: Meetings table conversion

**Files:**
- Create: `src/features/meeting-flow/constants/meetings-table-query-config.ts`
- Modify: `src/features/meeting-flow/ui/components/table/index.tsx` (inline config at lines ~46-49)
- Modify: `src/app/(frontend)/dashboard/meetings/page.tsx`

**Interfaces:** Produces `MEETINGS_TABLE_QUERY_CONFIG` consumed by both files above. Consumes `prefetch` (`@/trpc/lib/prefetch`), `HydrateClient` (`@/trpc/components/hydrate-client`), `loadPaginatedQueryInput` (`@/shared/dal/server/lib/query/load-paginated-query-input`), `trpc` (`@/trpc/server`).

- [ ] **Step 1: Create the shared config** — mirror `src/shared/entities/customers/constants/customers-table-query-config.ts` (read it first; copy its doc-comment style):

```ts
import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { MEETING_FILTER_CONFIG } from '@/features/meeting-flow/constants/meeting-table-filter-config'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'

export const MEETINGS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'pm',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: MEETING_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
```

Values MUST byte-match what `table/index.tsx` currently inlines — read it and verify before writing (if it also inlines `defaultSort`, carry it into the config).

- [ ] **Step 2: Table consumes the config** — in `table/index.tsx`, replace the inline third argument of `usePaginatedQuery` with `MEETINGS_TABLE_QUERY_CONFIG` (import it). No other changes.

- [ ] **Step 3: Page prefetches** — rewrite `meetings/page.tsx` mirroring `customers/page.tsx` exactly (read customers first; copy its `Props` type and structure):

```tsx
export default async function MeetingsPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()
  if (authState.status === 'authenticated') {
    const input = await loadPaginatedQueryInput(searchParams, MEETINGS_TABLE_QUERY_CONFIG)
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(input))
  }
  return (
    <HydrateClient>
      <RecordsPageMotionShell>
        <PastMeetingsTable />
      </RecordsPageMotionShell>
    </HydrateClient>
  )
}
```

Keep `export const dynamic = 'force-dynamic'`. Note the table's `extra` argument is `{}` — so `loadPaginatedQueryInput(searchParams, CONFIG)` with no extra is key-identical.

- [ ] **Step 4: Verify** — `pnpm tsc` exit 0; `pnpm lint` exit 0 AND the 4 `no-inline-table-config` warnings for this file are GONE (quote before/after warning counts in your report).

- [ ] **Step 5: Commit** — explicit paths (3 files): `feat(prefetch): meetings table server-prefetch via shared config`

### Task 2: Projects table conversion

Identical recipe to Task 1 with these substitutions — all steps, verification, and commit structure repeat verbatim:

- Config file: `src/features/project-management/constants/projects-table-query-config.ts` exporting `PROJECTS_TABLE_QUERY_CONFIG` = `{ paramPrefix: 'pj', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS, filters: PROJECT_FILTER_CONFIG }` (filter import from `src/features/project-management/constants/project-table-filter-config.ts`; verify against the inline values at `ui/components/table/index.tsx:46-49`).
- Table: `src/features/project-management/ui/components/table/index.tsx`.
- Page: `src/app/(frontend)/dashboard/projects/page.tsx`; prefetch `trpc.projectsRouter.crud.list.queryOptions(input)`; keep the page's existing children structure inside `<HydrateClient>`.
- Commit: `feat(prefetch): projects table server-prefetch via shared config`

### Task 3: Proposals table conversion

Same again:

- Config file: `src/features/proposal-flow/constants/proposals-table-query-config.ts` exporting `PROPOSALS_TABLE_QUERY_CONFIG` = `{ paramPrefix: 'pp', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS, filters: PROPOSAL_FILTER_CONFIG }` (verify against `ui/components/table/index.tsx:49-52`).
- Table: `src/features/proposal-flow/ui/components/table/index.tsx`.
- Page: `src/app/(frontend)/dashboard/proposals/page.tsx`; prefetch `trpc.proposalsRouter.business.list.queryOptions(input)`.
- Commit: `feat(prefetch): proposals table server-prefetch via shared config`

### Task 4: Schedule conversion (Tier 1) + activities config extraction

**Files:**
- Create: `src/features/schedule-management/constants/schedule-query-inputs.ts`
- Create: `src/features/schedule-management/constants/activities-table-query-config.ts`
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx` (two `useQuery` at ~46-52)
- Modify: `src/features/schedule-management/ui/components/activities-table.tsx` (inline config ~26-29)
- Modify: `src/app/(frontend)/dashboard/schedule/page.tsx`

- [ ] **Step 1: Shared inputs constant** (two separate constants per the audit recipe):

```ts
/** Page↔view shared inputs — one object each side, one query key. */
export const SCHEDULE_MEETINGS_LIST_INPUT = { pagination: { limit: 500, offset: 0 } } as const
export const SCHEDULE_ACTIVITIES_LIST_INPUT = { pagination: { limit: 500, offset: 0 } } as const
```

- [ ] **Step 2: View → `useSuspenseQueries`** — mirror `src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx` (read it first): extract both `queryOptions` calls to consts in the component body, replace the two `useQuery` with ONE `useSuspenseQueries({ queries: [meetingsOptions, activitiesOptions] })`, call `useHydrationParityCheck(...)` (from `@/shared/dal/client/hooks/use-hydration-parity-check`) once per query key, and delete the now-dead `isLoading`/`isPending` branches (suspense guarantees data).

- [ ] **Step 3: Page prefetch** — in `schedule/page.tsx` (keep `force-dynamic` + `protectDashboardPage()`):

```tsx
prefetch(trpc.meetingsRouter.reads.list.queryOptions(SCHEDULE_MEETINGS_LIST_INPUT))
prefetch(trpc.scheduleRouter.activities.list.queryOptions(SCHEDULE_ACTIVITIES_LIST_INPUT))
```

then wrap the view: `<HydrateClient fallback={<LoadingState title="Loading schedule…" />}><ScheduleView /></HydrateClient>` (import `LoadingState` from `@/shared/components/states/loading-state` — this is a Suspense fallback inside the page, NOT a loading.tsx).

- [ ] **Step 4: Activities config extraction (no prefetch)** — create `ACTIVITIES_TABLE_QUERY_CONFIG` = `{ paramPrefix: 'act', pageSize: 20, pageSizeOptions: ACTIVITY_PAGE_SIZE_OPTIONS, filters: ACTIVITY_FILTER_CONFIG }` (both imports from `src/features/schedule-management/constants/activity-filter-config.ts`; verify values against `activities-table.tsx:26-29`) and consume it in `activities-table.tsx`. This table's mount site is not on a converted page — extraction only, for the eslint flip.

- [ ] **Step 5: Verify + commit** — gates as Task 1 (4 more warnings gone); commit 5 files: `feat(prefetch): schedule view suspense prefetch + activities shared config`

### Task 5: ~~Settings conversion~~ — DROPPED (fails rule condition 3)

Settings passes conditions 1–2 but not 3: it's a rarely visited screen with tiny payloads (`getProfile`, `getSyncStatus`) whose brief `LoadingState` is acceptable UX. Converting the view to suspense is refactor churn with no user-visible win, and it would add a parity surface for zero benefit. `settings-view.tsx` and `integrations-section.tsx` keep their plain `useQuery` — this is the sanctioned-mixing case the decision rule exists for. No `no-inline-table-config` offenders live here, so the eslint flip is unaffected. Revisit only if settings grows heavy route-mounted content.

### Task 6: Campaigns-leads static/dynamic config split (NO prefetch — rule condition 3 fails)

**Why the split still proceeds without prefetch:** (a) the inline hook config at `campaigns-leads-view.tsx:58-66` is one of the 7 offenders the eslint flip needs extracted; (b) the split fixes a latent parser instability that exists TODAY: the hook's filter config is rebuilt from `summariesQuery`/`campaignsQuery` data, so each select's `options` go from `[]` (queries loading — free-string parse per `derive-paginated-query-state.ts:60`) to populated (`parseAsStringLiteral` validation) mid-session, which can re-coerce a URL filter value and shift the query key after mount. A static config with `options: [] as const` makes the hook's parsing stable forever; the runtime-merged options feed only the toolbar UI.

**Why NO prefetch:** the leads tab is an admin tool behind a non-default tab — cold loads of `?tab=leads` are rare (bookmark/refresh), and since `tab` is a searchParam, a prefetch branch would re-run three server queries on every in-page tab switch. Condition 3 fails. The tab stays client-fetched; if usage patterns change, the prefetch branch is a ~6-line addition to `campaigns/page.tsx` mirroring the existing `tab === 'overview'` block.

**Files:**
- Create: `src/features/campaigns-admin/constants/campaign-leads-table-query-config.ts`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx` (~35-66)

- [ ] **Step 1: Static config.** Read `buildLeadsFilterConfig` (follow the import in `campaigns-leads-view.tsx`) and enumerate the filter DEFINITIONS it produces — each filter's `id` + `type` is static; only `options` arrays are runtime-computed. Create the config with the SAME ids/types and `options: [] as const` for every runtime-populated select/multi-select (empty options ⇒ free-string parsing on both sides, per `derive-paginated-query-state.ts:60`):

```ts
export const CAMPAIGN_LEADS_TABLE_QUERY_CONFIG = {
  // NOTE: deliberately NO paramPrefix — the live table has none; adding one
  // would rename every URL param (behavior change).
  pageSize: 25,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: [/* static ids/types from buildLeadsFilterConfig, options: [] */],
} as const satisfies PaginatedQueryConfig
```

If `PaginatedQueryConfig` REQUIRES `paramPrefix` (type error), STOP and report BLOCKED — do not invent a prefix.

- [ ] **Step 2: View split.** `usePaginatedQuery` receives the STATIC config (this is what keys/parsers derive from — stable across the session, and server-parity-ready if a prefetch is ever added). The runtime-merged config (`buildLeadsFilterConfig` output, i.e. static definitions + populated options) feeds ONLY the filter toolbar UI. Trace how `DataTable`'s toolbar currently receives filter definitions; if it reads them from the hook's config, pass the merged definitions through the appropriate `DataTable` prop instead — the hook input must stay static. Report the exact wiring you chose.

- [ ] **Step 3: Verify** — gates; 3 warnings gone; ALSO confirm in your report that the filter toolbar still renders populated campaign/source options once the two supporting queries resolve (the merged config must reach the toolbar; the hook must receive ONLY the static config).

- [ ] **Step 4: Commit** (2 files): `refactor(campaigns-leads): static table config, runtime options to toolbar only (prefetch deferred per when-to-prefetch rule)`

### Task 7: Lead-sources table config extraction (NO prefetch — pure refactor)

**Files:**
- Create: `src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts` (one file, two exports — they're siblings of the same feature)
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` (~36-45)
- Modify: `src/features/lead-sources-admin/ui/components/all-customers-section.tsx` (~32-41)

- [ ] **Step 1:** Two configs, values verified against the inline originals:

```ts
export const LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'src',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: CUSTOMER_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig

export const ALL_CUSTOMERS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'all',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: CUSTOMER_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
```

- [ ] **Step 2:** Both sections consume their config (the `src` section keeps its `{ id: leadSourceId }` extra argument unchanged).
- [ ] **Step 3:** Verify (8 warnings gone — the last ones) + commit (3 files): `refactor(lead-sources): shared table query configs (screen stays client-fetched per when-to-prefetch rule)`

### Task 8: Flip eslint rule to error + doc truth-ups

**Files:**
- Modify: `eslint.config.js` (the `project/no-inline-table-config` block)
- Modify: `docs/superpowers/plans/2026-07-26-prefetch-hydration-fault-audit.md`
- Modify: `docs/codebase-conventions/query-toolkit.md` (`#shared-table-config`)

- [ ] **Step 1:** Change the rule's severity `'warn'` → `'error'`; update the comment above it (the flip condition is met). `pnpm lint` must exit 0 with ZERO `no-inline-table-config` diagnostics.
- [ ] **Step 2:** Audit doc — append three lines to the top addendum: (a) Wave 3 landed (list Task 1-8 commit hashes); (b) action-center dropped from scope (no route — sheet component, recipe assumption was wrong); (c) precision fix: dynamic `FilterDefinition.options` are key-irrelevant ONLY when the shared config declares `options: []` (empty ⇒ free-string parse both sides per `derive-paginated-query-state.ts`); non-empty options ARE parser-relevant since Wave-1 P1.
- [ ] **Step 3:** `query-toolkit.md#shared-table-config` — apply the same precision fix to its dynamic-options paragraph, citing campaigns-leads' config as the reference for the split.
- [ ] **Step 4:** `docs/codebase-conventions/frontend-stack.md` — add a **"When to prefetch"** decision rule to the `#server-prefetch-two-tiers` rule body (this is the anti-shotgun rule; keep the anchor slug):

> Prefetch a query iff ALL three hold: (1) it renders as **primary content of a route-mounted view** (not a sheet/modal/dropdown/interaction-gated panel); (2) its input derives entirely from **searchParams/route params + shared constants** (no client state, no un-quantized `Date.now()`); (3) the screen benefits from cold-load speed or SSR (interactive views keep their client hooks — RSC seeds the cache, React Query stays the client source of truth). Everything else uses plain client fetching — TanStack's Advanced SSR guide explicitly sanctions mixing ("both patterns are fine to mix"). Do NOT lift a query into suspense or invent a URL param just to make it prefetchable.

- [ ] **Step 5:** Verify + commit (3 files): `chore(lint): no-inline-table-config warn→error; when-to-prefetch rule + dynamic-options doc precision`

### Task 9: ~~Lead-sources prefetch conversion~~ — DROPPED (fails rule conditions 2 and 3); quantization RESCINDED

Adjudicated 2026-07-26 by the when-to-prefetch rule, superseding the earlier Option-A (floor-to-hour) approval:

- **Condition 2 fails structurally:** `resolveTimeRange` (`src/features/lead-sources-admin/lib/resolve-time-range.ts:17-20`) derives rolling `from`/`to` from `new Date()`. Making that prefetchable requires quantizing the clock — a user-visible behavior change (rolling stats lag up to 59 min at the window edge) made SOLELY to enable prefetch. That is precisely the contortion the decision rule's closing clause forbids ("do not invent a URL param / reshape inputs just to make a query prefetchable").
- **Condition 3 fails:** occasional admin analytics screen; the interaction that matters (chip/range switching) is client-side and already smooth via `keepPreviousData` (`lead-sources-view.tsx:55-64`) — prefetch improves none of it.
- **Therefore the floor-to-hour quantization approval is rescinded** — its only purpose was prefetch parity; without the prefetch it's pure freshness loss. `resolve-time-range.ts` stays untouched.

The screen stays fully client-fetched. Task 7's config extraction already satisfies the eslint flip. If this ever becomes a high-traffic landing screen, re-run the rule; the earlier audit recipe (shared nuqs parser module, per-pane prefetch branches, `keepPreviousData` for range-keyed stats) remains in `2026-07-26-prefetch-hydration-fault-audit.md` as the how-to.

---

## Execution order & batching

Tasks 1→4 then 6→8 in order (1-3 mechanical/cheap-model; 4 and 6 standard-model; 7 mechanical; 8 trivial). Tasks 5 and 9 are DROPPED per the adjudication table — do not implement them. After Task 8: Oliver's dev pass (navigate the four converted screens — meetings, projects, proposals, schedule — watching the console for `[prefetch drift]`) + the re-scoped preview smoke list from the audit addendum.
