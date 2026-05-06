# Lead Sources — Session Handoff

**Date:** 2026-04-22
**Branch state:** `main` is clean and up-to-date with origin. PRs #122–#129 are shipped. Dev + prod DB are both fully on the FK schema (legacy `lead_source` pgEnum column + type dropped).

---

## 0. Read first (in this order)

1. [`memory/MEMORY.md`](../memory/MEMORY.md) — the index.
2. [`memory/feedback-ui-work-methodology.md`](../memory/feedback-ui-work-methodology.md) — the standing UI-work rule.
3. [`docs/ui-design-playbook.md`](./ui-design-playbook.md) — the canonical three-phase UI process + hard rules + banned patterns.
4. [`memory/coding-conventions.md`](../memory/coding-conventions.md) — the 27 non-negotiable code rules.

**Workflow reminders** (memorised from CLAUDE.md + memory):
- **NEVER `pnpm build`** — use `pnpm tsc && pnpm lint`.
- **NEVER `pnpm db:push`** in default mode — always `pnpm db:push:dev` for dev pushes. Prod is run manually by the user.
- **NEVER `window.confirm` / `window.alert`** — use `useConfirm` from `@/shared/hooks/use-confirm`.
- Branch convention: `{type}/{short-description}` or `{type}/{issue-number}-{...}`.
- PR merge via `gh pr merge N --squash --admin --delete-branch`.
- When doing non-trivial UI work, run the three-phase methodology (user-flow brainstorm → three-skill audit → implement + self-audit) before code.

---

## 1. Critical tech debt to fix **before anything else**

### 1a. `leadSourcesRouter.list` uses sentinel dates — anti-pattern, must be rewritten

**File:** [`src/trpc/routers/lead-sources.router.ts`](../src/trpc/routers/lead-sources.router.ts)
**Procedure:** `list`

**What's there right now (bad):**

```ts
const effectiveFrom = input?.from ?? '1970-01-01T00:00:00.000Z'
const effectiveTo = input?.to ?? '2999-12-31T23:59:59.999Z'

leadsInRange: sql<number>`(
  SELECT COUNT(*)::int FROM ${customers}
  WHERE ${customers.leadSourceId} = ${leadSourcesTable.id}
    AND ${customers.createdAt} >= ${effectiveFrom}
    AND ${customers.createdAt} <= ${effectiveTo}
)`,
```

This was a band-aid for a bug where empty Drizzle `sql\`\`` fragments interpolated into a correlated subquery produced `0` on "All time". The fix masks the symptom with magic string sentinels. It's indefensible in code review.

**What to do instead:**

Rewrite `list` without a correlated subquery. Two cleaner options — pick one:

**Option A — JOIN + conditional aggregation (single query, preferred):**

```ts
import { and, count, gte, lte, sql } from 'drizzle-orm'

// ...inside the handler
const predicates = [
  input?.from ? gte(customers.createdAt, input.from) : undefined,
  input?.to ? lte(customers.createdAt, input.to) : undefined,
].filter(Boolean)

const inRangeCondition = predicates.length > 0 ? and(...predicates) : sql`TRUE`

const rows = await db
  .select({
    id: leadSourcesTable.id,
    name: leadSourcesTable.name,
    slug: leadSourcesTable.slug,
    token: leadSourcesTable.token,
    isActive: leadSourcesTable.isActive,
    createdAt: leadSourcesTable.createdAt,
    updatedAt: leadSourcesTable.updatedAt,
    totalLeads: sql<number>`COUNT(${customers.id})::int`,
    leadsInRange: sql<number>`COUNT(${customers.id}) FILTER (WHERE ${inRangeCondition})::int`,
  })
  .from(leadSourcesTable)
  .leftJoin(customers, eq(customers.leadSourceId, leadSourcesTable.id))
  .where(includeInactive ? undefined : eq(leadSourcesTable.isActive, true))
  .groupBy(leadSourcesTable.id)
  .orderBy(desc(leadSourcesTable.isActive), asc(leadSourcesTable.name))
```

The `FILTER (WHERE …)` clause is a standard Postgres aggregate filter — cleaner than correlated subqueries, no sentinel dates, no `sql\`\`` interpolation quirks. When both bounds are absent, `inRangeCondition` is `TRUE` and `leadsInRange` equals `totalLeads` (correct "all-time" semantics).

**Option B — two queries + JS merge:**

Fetch the source rows once, then fetch `{leadSourceId, count}` groups twice (all-time + in-range). Merge in JS. Simpler SQL, two round-trips instead of one. Acceptable if Option A is hard to read.

**Verification steps for whichever path:**
- `pnpm tsc && pnpm lint` clean.
- On "All time": every row's `leadsInRange` equals its `totalLeads`.
- On `7d`: `leadsInRange` equals the count of customers with `created_at >= NOW() - 7 days` for that source. Cross-check against `getStats` for a single source.
- `getStats` uses the right pattern already (composed `and(baseMatch, ...rangeClauses)`) — follow it.

---

## 2. Recently merged PRs (this session series)

| PR | Title | Status |
|----|-------|--------|
| #122 | Lead Sources admin UI — performance-first management page | ✅ clean |
| #123 | Introduce `lead_source_id` FK (additive dual-column migration) | ✅ clean |
| #124 | Drop legacy `lead_source` pgEnum column (destructive phase 2) | ✅ clean |
| #125 | Token-validated public intake URL (`?source=…&token=…`) + prune dead `intakeRouter` procedures | ✅ clean |
| #126 | `All` row + per-source tabs + `AddCustomerSheet` (architectural pivot) | ✅ clean |
| #127 | `resolveTimeRange` memoisation (infinite-refetch fix) + chip order + skeleton + button + pipeline badges | ✅ clean |
| #128 | Lift time range to page-level URL state (`?range=…`) | ⚠ see tech debt 1a |
| #129 | `leadsInRange=0` bug fix (**sentinel-dates band-aid**) + editable `createdAt` in customer tables | ⚠ see tech debt 1a — the fix in this PR is what needs replacing |

Prod DB operations already performed by the user:
- Dev + prod: `pnpm db:push(:dev)` for the FK additive migration (#123)
- Dev + prod: `seed-lead-sources.ts` (adds `Manual` + refreshes legacy rows)
- Dev + prod: `backfill-lead-source-fk.ts` (populates `lead_source_id` from legacy text column)
- Dev + prod: `pnpm db:push(:dev)` for the destructive drop (#124)

No pending prod DB work.

---

## 3. Open backlog — prioritized

### A. Blocking before the lead-sources refactor is "done" (user-stated)

1. **Fix tech-debt 1a** above. **Do this first.**
2. **Mobile responsiveness** — the entire Lead Sources page is desktop-only right now. Split pane doesn't collapse; chips toolbar doesn't scroll; `AddCustomerSheet` is OK on mobile but the detail panes aren't. User wants this before calling the refactor shipped.
   - Suggested interaction pattern (awaiting confirmation): **drill-down list↔detail** on mobile — list is the home view, tapping a source pushes the detail with a back affordance. `All` row remains the natural home when you back out.
   - Time-range chips toolbar needs horizontal scroll with snap-to-chip on narrow viewports.
3. **Redo the top section of each lead source overview** — user wants this redesigned.
   - Files: [`src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx`](../src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx) and the first section of [`source-detail.tsx`](../src/features/lead-sources-admin/ui/components/source-detail.tsx).
   - User hasn't yet specified *what* feels wrong — in the fresh session, ask one or two sharp diagnostic questions before redesigning: "What feels off — hierarchy, density, missing info, generic appearance?" Then run the three-phase methodology.

### B. User Additions that haven't been shipped yet

4. **Customers table → shared `DataTable`** — user's explicit Addition #5. Today's `LeadSourceCustomersSection` and `AllCustomersSection` are lightweight inline `<table>` elements. User wants them to standardize on the shared `DataTable` primitive (see [`src/shared/components/data-table/`](../src/shared/components/data-table/)):
   - Frozen first column
   - Column resizing
   - Row-click → customer profile modal (the modal component already exists at [`src/shared/entities/customers/components/profile/`](../src/shared/entities/customers/components/profile/))
   - `MoreHorizontal` entity-actions menu per row
   - Pipeline badges already landed in #127 — port that column over
   - Remember: `<td onClick={e => e.stopPropagation()}>` on the `createdAt` cell so the `DateTimePicker` popover doesn't trigger the row's modal.

### C. Still awaiting clarification

5. **Truncated "Bug #1"** — on 2026-04-22 the user reported: *"for some reason, in dev each lead source's `all time leads, leads this month` etc are in …"* (message was cut off). In a fresh session, ask for the complete sentence before acting. It may already be resolved by #129's bug fix — confirm before investigating.
6. **Truncated "Addition #1"** — same message: *"Currently, for some …"* (cut off). Same approach: ask first.

### D. Deferred by user explicit request

7. **Better-auth intermittent recursion error.** User said to ignore for now ("recursion error is gone" after #127 — but they also said earlier the better-auth one is a separate chronic issue, distinct from the `resolveTimeRange` loop). Keep on the list but don't investigate until user prioritises.

### E. Broader repo backlog (from MEMORY.md, not lead-sources-specific)

- **#109 users entity migration** — 3-phase refactor (DAL+constants → router → hooks+components)
- **#110 records route migration** — consolidate `/dashboard/records/*` with shared layout + generic `RecordsView`
- **#111 GCal QStash sync architecture** — after the Meeting Polish Batch lands
- **#108 intake form overhaul** — largely done by #126's `AddCustomerSheet` consolidation; verify nothing else remains
- **#113 participant modal refactor** — merged in #119
- **#114 omni-search** — ⌘K sidebar shell exists; needs a real implementation
- **#115 Resend deliverability** — ops (SPF/DKIM/DMARC), no code
- **#116 calendar drag-to-resize** — P3 backlog
- **#106 generic undo toasts** — needs Model A/B/C design call first
- **#120 generic timeframe filter** — shadcn registry baseline ready (`npx shadcn add https://registry.watermelon.sh/r/schedule-date.json`)

---

## 4. Files touched recently that are worth re-reading before editing

- [`src/trpc/routers/lead-sources.router.ts`](../src/trpc/routers/lead-sources.router.ts) — the `list` procedure needs the rewrite described in §1a.
- [`src/trpc/routers/customers.router.ts`](../src/trpc/routers/customers.router.ts) — new `updateCreatedAt` mutation (super-admin only); existing `updateCustomerContact` pattern is the reference.
- [`src/features/lead-sources-admin/ui/views/lead-sources-view.tsx`](../src/features/lead-sources-admin/ui/views/lead-sources-view.tsx) — page-level URL state for `?id=` + `?range=`; hosts `TimeRangeChips` toolbar; left/right split pane; AddCustomerSheet overlay.
- [`src/features/lead-sources-admin/ui/components/all-detail.tsx`](../src/features/lead-sources-admin/ui/components/all-detail.tsx) and [`source-detail.tsx`](../src/features/lead-sources-admin/ui/components/source-detail.tsx) — pure consumers of `activeChip` + `range` props from the view; no local state.
- [`src/features/lead-sources-admin/ui/components/all-customers-section.tsx`](../src/features/lead-sources-admin/ui/components/all-customers-section.tsx) and [`lead-source-customers-section.tsx`](../src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx) — current inline tables. Target for the DataTable migration.
- [`src/features/lead-sources-admin/lib/resolve-time-range.ts`](../src/features/lead-sources-admin/lib/resolve-time-range.ts) — `new Date()` for rolling windows; callers MUST memoise on `activeChip.key` or hit the infinite-refetch loop again.
- [`src/shared/components/date-time-picker.tsx`](../src/shared/components/date-time-picker.tsx) — the picker reused by both the proposal-flow table and the new customer tables. `children` slot overrides the button content.

---

## 5. Hard rules to remember while redesigning (from the playbook)

- **One primary-color moment at rest** (60-30-10 rule). Action buttons + selected-state indicators shouldn't pile up in the same surface.
- **Flat surfaces** — no nested cards.
- **Destructive color at rest**, not hover-gated.
- **Touch targets ≥ 44px** on mobile contexts.
- **One uppercase-tracked label per section max.**
- **Placeholder never replaces a label.**
- **`tabular-nums`** on every number.
- **All transitions behind `motion-safe:*`.**
- **Semantic color tokens**, not raw Tailwind colors.

Banned patterns:
- Side-stripe borders >1px
- Gradient text
- Hero-metric template
- Nested cards
- Full-row primary hover
- Centered-title-+-centered-content generic dialog
- `window.confirm` / `window.alert`
- Emoji as icons

---

## 6. Suggested execution order for the next session

1. **Rewrite `leadSourcesRouter.list`** per §1a. One tight PR, no scope creep. Verify on dev (`pnpm dev`), then ship.
2. **Ask the user** about the truncated Bug #1 / Addition #1 — they may already be resolved by #129's intent-if-not-implementation; no point investigating the old symptom if it's gone.
3. **Ask the user** what specifically feels wrong about the source Overview top section — 1-2 diagnostic questions, not a blank redesign.
4. **Mobile responsiveness PR** — drill-down nav + chip toolbar scroll. Run the three-phase methodology.
5. **Source Overview top section redesign** — based on the diagnostic answer.
6. **Customers table → DataTable** — larger PR, might split into "wire DataTable" + "wire row-click profile modal" + "wire entity actions menu".

---

## 7. Context that may not be obvious

- The `list` procedure's role is specifically for the left-pane picker. It needs to stay fast (it's called every time the range chip changes). Whatever rewrite replaces the sentinel-dates version should be benchmarked at >100 sources if you want to be thorough — but realistically the tri-pros dataset is small, so correctness matters more than microseconds.
- The `Manual` lead source is a real `lead_sources` row (slug `manual`, seeded by `scripts/seed-lead-sources.ts`). `createFromIntake` defaults to that slug when none is passed, which is the path used by the dashboard's `AddCustomerSheet`.
- The public intake URL is now `?source=<slug>&token=<token>` with both validated. Tokens never auto-rotate — the manual `Rotate` button in `IntakeUrlCard` regenerates on demand, per user decision.
- `?id=all` is a sentinel in the view; it's the literal string `'all'`, centralised in [`src/features/lead-sources-admin/constants/pseudo-ids.ts`](../src/features/lead-sources-admin/constants/pseudo-ids.ts).
- `resolveTimeRange` is called inside `useMemo` with `[activeChip.key]` as the deps array. Don't remove that — you'll reintroduce the infinite-refetch loop that was fixed in #127.
