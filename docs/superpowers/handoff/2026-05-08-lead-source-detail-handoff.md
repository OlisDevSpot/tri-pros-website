# Lead Source Detail Redesign — Session Handoff

**Date:** 2026-05-08
**Branch:** `refactor/lead-sources-mobile-responsive`
**Status:** Phase 1 server + structure complete; visual polish + Phase 2/3 pending
**Read this entire doc before touching code.**

---

## TL;DR for the next session

The 3-tab detail panel (Customers / Analytics / Settings) is wired end-to-end with a dollar-led KPI strip and a real Settings tab. Server-side: schema migration, segment SQL, totalSales, archive procedure, delete guard, slug-with-rotate are all live. Client-side: every component compiles and `pnpm tsc` + `pnpm lint` are clean.

**Three things still need doing:**

1. **Visual / spacing pass.** The user flagged spacing as "very off." It hasn't been tuned with the dev server open. The component layout is functional but not aesthetically tight. A pass with the actual UI in front of you is required.
2. **Inline slug-collision error in `IdentityEditor`.** Currently surfaces only as a toast — the spec called for inline error text under the slug input. Toast disappears in 4 s and there's no persistent visual cue.
3. **Phase 2 (Analytics funnel) and Phase 3 (trend / cohort).** Currently a `Coming soon` placeholder card. Spec'd in `docs/superpowers/specs/2026-05-08-lead-source-detail-redesign-design.md` under "Future phases."

There is one critical gotcha — see "Pitfalls" below — about a parallel session.

---

## What was done (this session)

27 commits between `05ee64cf` (branch start) and `de2545c1` (latest).

### Server (`src/trpc/routers/lead-sources.router.ts` + helpers)

| Change | File | Notes |
|---|---|---|
| `archivedAt` column | `src/shared/db/schema/lead-sources.ts` | Nullable timestamp, ISO string mode. Migration applied via `pnpm db:push:dev`. |
| `buildSegmentWhere` SQL helper | `src/shared/entities/lead-sources/lib/segment-sql.ts` | Reuses `isSignedCustomerSql`. Encodes the 4-state partition (all / active / signed / dead). |
| `customerSegments` const + type | `src/shared/entities/lead-sources/constants/customer-segments.ts` | **Client-safe** — split out of segment-sql so drizzle-orm doesn't leak to client bundles. |
| `getStats.totalSales` | router | Lifetime sum of `computeFinalTcp(fundingJSON.data)` across approved proposals. Reuses canonical helper, no SQL TCP extraction. |
| `getStatusCounts` (new) | router | Returns `{ all, active, signed, dead }` in parallel via `db.$count` × 4. |
| `getCustomers.segment` | router | Top-level `segment` filter via `.extend({ id, segment })`. Also leftJoins `lead_sources` so each row carries `leadSourceId`/`leadSourceName`/`leadSourceSlug` for the editable `LeadSourceCell`. |
| `update.slug` | router | Slug validation via `slugify(slug) === slug`. **Token rotates only when slug actually changes** (no silent rotation on no-op saves). Uses `ne(...)` for the uniqueness exclusion. |
| `archive` (new) | router | Sets `archivedAt = now()`. Idempotent. |
| `delete` guard | router | Throws `PRECONDITION_FAILED` if customers are still attached. The FK is `SET NULL` so the guard is business-logic protection, not DB integrity. |
| `list` filters archived | router | Adds `isNull(archivedAt)` to the where clause. |

### Client hooks

| Change | File | Notes |
|---|---|---|
| `archiveLeadSource` mutation | `src/shared/entities/lead-sources/hooks/use-lead-source-actions.ts` | Toast + `invalidateLeadSource()`. Mirrors the pattern of the other 5 mutations in the hook. |

### Client components — new

| File | Role |
|---|---|
| `src/features/lead-sources-admin/ui/components/lead-source-performance-strip.tsx` | Dollar-led KPI hero (`$totalSales` + `{signed} of {total} signed · {range} clause`). Uses `formatAsDollars`. |
| `src/features/lead-sources-admin/ui/components/customer-status-segments.tsx` | 4-pill segmented control (All / Active / Signed / Dead) with counts. `role="tablist"` / `role="tab"` / `aria-selected`. |
| `src/features/lead-sources-admin/ui/components/lead-source-customers-panel.tsx` | Customers tab wrapper: segments + Add CTA + table. Owns `?seg=` URL state. |
| `src/features/lead-sources-admin/ui/components/identity-editor.tsx` | Name + slug edit. Dirty-state Save/Revert. Slug change → `useConfirm` dialog before mutation. |
| `src/features/lead-sources-admin/ui/components/danger-zone.tsx` | Pause / Archive / Delete rows. Typed-confirm on Delete. Post-mutation `router.push('/dashboard/lead-sources')`. |
| `src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx` | Composes Identity + IntakeUrl + FormConfig + DangerZone with `border-t pt-6` separators. |
| `src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx` | "Coming soon" card with `BarChart3Icon`. Phase 2 replacement target. |

### Client components — modified

| File | Change |
|---|---|
| `lead-source-detail-header.tsx` | Read-only `<ActiveIndicator>` (no Switch). Kebab routes to Settings via new `onJumpToSettings` prop. |
| `lead-source-customers-section.tsx` | Accepts `segment?` prop. Threads through `usePaginatedQuery` as `extra`. Includes `leadSourceName` column + `updateLeadSource` mutation + `onUpdateLeadSource` meta — same shape as the `/dashboard/customers` table. |
| `intake-url-card.tsx`, `form-config-editor.tsx` | Outer wrapper changed from `<div>` to `<section>`. Inner headings preserved. |
| `source-detail.tsx` | Tab list rebuilt: Customers (default) / Analytics / Settings. Backward-compat redirect for `?tab=overview`. KPI strip lifted out of the tabs. Three queries: `getById`, `getStats` (with `keepPreviousData`), `getStatusCounts`. |

### What is OUT OF SCOPE and was NOT touched

- `src/features/lead-sources-admin/ui/components/all-detail.tsx` — the All pane. Untouched.
- `src/features/lead-sources-admin/ui/components/performance-strip.tsx` — the original shared strip used by the All pane. Untouched.
- `src/features/lead-sources-admin/ui/components/lead-source-list.tsx` — the picker. Untouched.

Verify with: `git diff 05ee64cf..HEAD -- src/features/lead-sources-admin/ui/components/all-detail.tsx src/features/lead-sources-admin/ui/components/performance-strip.tsx src/features/lead-sources-admin/ui/components/lead-source-list.tsx` (should be empty).

---

## Pitfalls — read this before doing anything

### Two scope-creep reverts that turned out NOT to be scope creep

During this session, the spec/quality reviewer flagged "extra" changes in two commits and they were reverted. **Both reverts were wrong.** The "extras" were a parallel session's work to wire the editable `LeadSourceCell` column into the per-source pane.

The final commit `de2545c1` restored those changes. If you find anything missing related to:

- The `getCustomers` left-join with `lead_sources` (for `leadSourceName` per row)
- `'leadSourceName'` in `SHOW_COLUMNS` of `lead-source-customers-section.tsx`
- The `updateLeadSource` mutation + `onUpdateLeadSource` meta entry in that same file

…check `git log -- src/trpc/routers/lead-sources.router.ts src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` carefully before assuming it's missing. The restoration commit is `de2545c1`.

**Lesson for the next session:** review changes against your sibling sessions' branches before reverting "scope creep." When in doubt, leave it and ask.

---

## Architecture you need to know

### Status invariant

For a single lead source's customers, the four segment counts must satisfy:

```
all = active + signed + dead
```

Encoded by `buildSegmentWhere` (`segment-sql.ts`) and validated by `getStatusCounts`. The branches are mutually exclusive by construction: `signed` matches first (via `isSignedCustomerSql`), `dead` and `active` both AND with `NOT signed`.

### "Signed" is project-existence, not approved-proposal-existence

The canonical signal for a converted customer is `EXISTS project WHERE customer_id = …` — encoded in `src/shared/entities/customers/lib/signed-customer-sql.ts`. Approved proposals create projects, so they're functionally equivalent in steady state, but **always go through `isSignedCustomerSql()`** rather than re-deriving from proposals. `totalSales` is the one place that reads proposals directly because it needs the dollar amount.

### Token rotation rule

`update.slug` rotates the token ONLY when `slug !== current.slug`. Re-saving the same slug is a no-op for the token. This is enforced at `src/trpc/routers/lead-sources.router.ts` inside `update`. Don't relax this — it would silently break live intake URLs whenever the UI echoes the existing slug back.

### Customers panel queries

Both `SourceDetail` and `LeadSourceCustomersPanel` (and `LeadSourceSettingsPanel`) call `getStatusCounts({ id })`. TanStack Query dedupes by queryKey — only one network request fires. This is intentional. If you refactor, don't lift the query and prop-drill it without measuring; the current pattern is clean and the dedup is reliable.

### `paramPrefix` namespacing

The customers section uses `paramPrefix='src'` so its URL keys (`src_page`, `src_search`, etc.) don't collide with anything else on the page. The segment uses `?seg=` (no prefix) — because there's only one segment control on the page. Don't mix.

### Backward-compat tab redirect

`?tab=overview` redirects to `?tab=customers` via a useEffect in `source-detail.tsx`. This catches old bookmarks. The redirect uses `useSearchParams` from `next/navigation` (SSR-safe), not `window.location`.

---

## What's still pending

### 1. Spacing / visual polish (CRITICAL — user-flagged)

The user said: **"Your spacing is very off."** No specifics provided in the session. The components were assembled from spec but not opened in the dev server during implementation. Likely candidates for inspection (open `pnpm dev` and navigate to a real lead source):

- KPI strip: `gap-1` between hero and subtitle. May need `gap-2` or `mt-1` for breathing room.
- Tabs row: `gap-4` between triggers, `px-2 py-3` per trigger. The spec called for `px-4` — a full-width pass might want bigger horizontal touch targets.
- Settings panel: `gap-6` between sections + `border-t pt-6` per section. Adjacent sections may feel cramped at narrow widths or too distant at wide widths.
- Customer status segments + Add Customer button row: `gap-3` `flex-wrap items-center justify-between`. May want a clearer vertical axis on mobile.
- Header: `gap-4` between left cluster and right cluster. The active dot + label pair has `gap-2`.
- Danger zone rows: `px-4 py-3.5`. The dividers are `border-t border-destructive/20` (between Archive and Delete) and `border-t border-border/40` (between Pause and Archive — non-destructive divider). Check that the Pause/Archive boundary reads correctly.

**Next session: open `pnpm dev`, navigate to `/dashboard/lead-sources?id=<known-source>`, and walk through every state (loading, empty, populated, segment switching, Settings tab open). Tweak with screenshots, not from spec.**

The spacing rules from the project spec live in `MEMORY.md` under "View context paths" and in `2026-04-22-lead-source-top-section-redesign.md` (the prior masthead spec). Pay attention to the `whitespace-balance` rule.

### 2. Inline slug-collision error in `IdentityEditor`

The spec at `docs/superpowers/specs/2026-05-08-lead-source-detail-redesign-design.md` says:

> Slug collision on save: inline error under input.

Currently the server returns `CONFLICT` and the toast handler in `useLeadSourceActions.updateLeadSource` shows the message. Toast disappears in 4 s, no persistent visual cue.

**Fix:** read `updateLeadSource.error` in `IdentityEditor` and render error text below the slug input when the error code is `CONFLICT`. Suggested:

```tsx
{updateLeadSource.error && (
  <p className="text-[11px] text-destructive">
    {updateLeadSource.error.message}
  </p>
)}
```

Reset on next keystroke or after a successful save (`updateLeadSource.reset()`).

### 3. Phase 2 — Analytics funnel

Replace `LeadSourceAnalyticsPlaceholder` with a 4-step funnel:

```
Lead → Meeting booked → Proposal sent → Signed
```

Counts + drop-off rates per step, scoped to the active range chip.

**Recommended approach:** new procedure `leadSourcesRouter.getFunnel` that returns `{ leads, meetings, proposalsSent, signed, ranges: { from, to } }`. Reuse `customersMatchingSource`, join through `meetings` and `proposals` tables with the existing inner-join pattern from `getStats`. Render as a horizontal bar with drop-off labels between steps.

The spec has the full breakdown under "Phase 2 — Analytics: funnel breakdown".

### 4. Phase 3 — Trend + funnel × time + cohort

Three separate visualizations:
- **Trend over time:** weekly bar/line chart of leads per week (with optional signed-per-week overlay).
- **Funnel × time:** week-bucketed table with funnel-stage columns.
- **Cohort:** lead-creation-week × outcome.

A chart library decision is needed — Recharts vs visx vs hand-rolled SVG. Defer until the actual data shape is built. The spec has the full breakdown under "Phase 3".

### 5. Lint warnings (status)

Two new warnings introduced this session were suppressed inline with comments explaining why (both are `react-hooks-extra/no-direct-set-state-in-use-effect` false positives — one is a controlled-form sync, the other is nuqs `setTab` which the rule can't distinguish from React `setState`). If you'd rather restructure than suppress, here are the suppression sites:

- `src/features/lead-sources-admin/ui/components/identity-editor.tsx` — `useEffect` that re-syncs local state on `[initialName, initialSlug, leadSourceId]` change.
- `src/features/lead-sources-admin/ui/components/source-detail.tsx` — `useEffect` that calls `setTab` on the legacy `?tab=overview` redirect.

Pre-existing lint warnings in unrelated files (proposal-flow, data-table, optimized-image, date-time-picker) are out of scope.

### 6. Loading skeleton dimensions

`source-detail.tsx` initial loading state renders 4 skeletons (`h-10 w-64`, `h-9 w-40`, `h-4 w-72`, `h-10 w-full`). Final reviewer noted the `h-4 w-72` row doesn't correspond to anything visible in the loaded state. Easy fix — match the skeleton to: header + KPI strip headline + KPI strip subtitle + tabs bar.

---

## How to pick up

### 1. Make sure you're on the right branch

```bash
git status
git log -1 --format="%h %s"
# expect: de2545c1 fix(lead-sources): restore LeadSourceCell column + reassignment mutation
```

### 2. Verify everything still compiles

```bash
pnpm tsc
pnpm lint
```

Both should be clean (lint will show pre-existing warnings in proposal-flow, data-table, etc. — those are not yours to fix).

### 3. Run the dev server

```bash
pnpm dev
```

Then in a browser, hit `http://localhost:3000/dashboard/lead-sources` and:
- Click into a real source (not the "All" pseudo-row)
- Verify the KPI strip shows `${totalSales}` headline
- Verify the Customers tab is the default
- Verify the segments default to "Active"
- Open Settings → confirm 4 sections render in order: Identity, Intake URL, Form configuration, Danger zone
- Try editing the slug → the confirmation dialog should fire → after saving, the intake URL changes
- Try archiving → should redirect to `/dashboard/lead-sources`
- Try deleting (pick a source with no customers, or temporarily detach customers) → should require typed confirmation

### 4. Spacing pass

Take screenshots before changing anything. Use them as the "before" reference.

### 5. Commit small

Each visual fix is its own commit. Don't bundle spacing fixes with new features.

---

## Files to read first

If you have 10 minutes, read these in order to get oriented:

1. `docs/superpowers/specs/2026-05-08-lead-source-detail-redesign-design.md` — the spec
2. `docs/superpowers/plans/2026-05-08-lead-source-detail-redesign-phase-1.md` — the implementation plan (the work that's been done)
3. `src/features/lead-sources-admin/ui/components/source-detail.tsx` — the orchestrator
4. `src/shared/entities/lead-sources/lib/segment-sql.ts` and `src/shared/entities/lead-sources/constants/customer-segments.ts` — the segment domain
5. `src/trpc/routers/lead-sources.router.ts` — the server side (especially `getStats`, `getStatusCounts`, `getCustomers`, `update`, `archive`, `delete`)
6. `src/shared/entities/customers/lib/columns-registry.tsx` — where `LeadSourceCell` lives (the editable column you're consuming)
7. `src/shared/entities/customers/components/customers-table.tsx` — the reference pattern (`/dashboard/customers`) the per-source customers table now mirrors

---

## Project conventions reminders

- **Never run `pnpm build`** — only `pnpm tsc` and `pnpm lint` for verification.
- Schema changes: **`pnpm db:push:dev`** only (per-worktree Neon branch). Never `pnpm db:push`.
- Named exports only.
- ONE main React component per file. File-level helpers (e.g., `Field`, `Row`, `ActiveIndicator`) are OK if private and small.
- Imports sorted (perfectionist).
- Reuse before reinvent: `computeFinalTcp`, `isSignedCustomerSql`, `slugify`, `generateToken`, `formatAsDollars`, `useConfirm`, all shadcn primitives.
- The `MEMORY.md` index file at `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/MEMORY.md` has the full ruleset. **Read it before any UI work.**

---

## Open questions for the user

If anything blocks you, the user has been answering directly in chat. Recurring areas where they may need to weigh in:

1. **Spacing target**: do you have a reference design or screenshots? The spec was text-only.
2. **Inline slug error styling**: red text + icon? Just text? Position relative to the input?
3. **Phase 2 priority**: ship Phase 2 (funnel) on its own PR, or wait for Phase 3?

---

## SHA reference

| SHA | What |
|---|---|
| `05ee64cf` | Branch start (before any of this work) |
| `e861e6f1` | Task 1: archivedAt column |
| `d0ac2ae3` | Task 2: segment SQL helper (with `as const` derivation fix) |
| `0fca0eb3` | Task 3: getStats totalSales (after revert + comment) |
| `14527b80` | Task 4: getStatusCounts |
| `25d4063e` | Task 5: getCustomers segment input (with const reuse) |
| `14479f73` | Task 6: update slug + token rotation (with no-op guard) |
| `97e66dc6` | Task 7: archive procedure, list filters archived, delete guard |
| `20c46960` | Task 8: archiveLeadSource client mutation |
| `9c003e84` | Task 9: LeadSourcePerformanceStrip |
| `3ce16724` | Task 10: CustomerStatusSegments |
| `338995fb` | Task 11: customers section accepts segment (after revert) |
| `d1cd42d4` | Task 12: LeadSourceCustomersPanel |
| `e0da7be6` | Task 13: IdentityEditor |
| `101a8299` | Task 14: DangerZone |
| `62780053` | Task 15: section wrappers |
| `526e58ce` | Task 16: LeadSourceSettingsPanel |
| `80e49398` | Task 17: AnalyticsPlaceholder |
| `d9979692` | Task 18: header rewrite |
| `2e663d8d` | Task 19: integration + polish (SSR-safe redirect, keepPreviousData, tab class extract) |
| `1b57c0c5` | Final cleanup (segment-sql split, double-toast fix, lint suppression) |
| `de2545c1` | **LeadSourceCell restoration** (the parallel-session work that was incorrectly reverted) |
