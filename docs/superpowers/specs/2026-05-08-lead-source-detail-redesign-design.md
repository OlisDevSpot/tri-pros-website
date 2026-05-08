# Lead Source Detail Panel — Phase 1 Redesign

**Date:** 2026-05-08
**Branch (current):** `refactor/lead-sources-mobile-responsive`
**Phase:** 1 of 3 (shell + Customers default + Settings consolidation + total sales). Phase 2 = Analytics funnel. Phase 3 = trend + funnel × time + cohort.
**Scope:** The right-pane "lead source detail" surface in `src/features/lead-sources-admin/ui/components/source-detail.tsx`, plus its child components (`LeadSourceDetailHeader`, `PerformanceStrip`, `IntakeUrlCard`, `FormConfigEditor`, `LeadSourceCustomersSection`).
**Out of scope:** the left-rail picker (`lead-source-list.tsx`), the All pane (`all-detail.tsx`) — both untouched in Phase 1. The Analytics tab content (Phases 2 and 3). Schema changes beyond what's needed for archive/delete + total-sales aggregation.
**Supersedes / extends:** [`2026-04-22-lead-source-top-section-redesign.md`](./2026-04-22-lead-source-top-section-redesign.md). That spec's masthead motion/typography stays; this spec replaces the hero metric (`{signed} of {total} signed` → dollar-led `${totalSales}`), drops conversion %, and reorganizes the rest of the panel.

## Problem

Current panel (the red rectangle in the user's screenshot) leaks attention to the wrong things:

1. **Form configuration occupies prime real estate** but is set once and rarely revisited. It shouldn't sit above the customer table.
2. **Intake URL card** is full-width and persistent even after the URL has been copied once. Same problem — it's a setup-time tool, not an operating-time tool.
3. **Customers — the agent's actual job** — is the *second* tab and is empty by default until clicked.
4. **No money signal anywhere.** "0 of 9 signed" is the strongest number on the page even though the page is about a revenue channel. Total sales is the metric that decides whether a source earns its budget.
5. **Active toggle in the header** sits next to the kebab — easy to flip by accident, no separation between routine and destructive actions.
6. **Tab triggers (pill style) read as filters,** not navigation, especially with no other navigation context above them.
7. **No analytics surface** — the page commits to one summary line and stops.

## Decisions locked (from brainstorming)

| Decision | Choice |
|---|---|
| Tab structure | `Customers (default) / Analytics / Settings`, plus an always-on KPI strip *above* the tabs |
| KPI strip metrics | `$totalSales` headline, `{signed} of {total} signed` and `{range} in the last {window}` as twin subtitles. **Conversion % dropped.** |
| Total sales formula | Reuse `computeProjectValue` (sum of `approved` proposal values) where each proposal value comes from `computeFinalTcp(fundingJSON.data)`. **No new aggregation logic.** |
| Active toggle | Stays interactive in the header (compact, not jumbo). Only `Archive` and `Delete` move to Settings → Danger zone. |
| Customers default | Pill segmented control (`All / Active / Signed / Dead`) above the table. **`Active` is the default segment**, persisted via `?seg=`. |
| Settings tab | Four sub-sections: Identity (name + slug), Intake URL, Form configuration, Danger zone (Archive / Delete) |
| Tab styling | Underline-active style with count badge on Customers — so tabs read as navigation, not as another filter row |
| Phasing | 3 PRs. Phase 1 = this spec. Phase 2 = Analytics funnel. Phase 3 = trend + funnel × time + cohort. |

## Design

### Visual sketch

```
┌────────────────────────────────────────────────────────────────────────────┐
│ LEAD SOURCE · /quoteme                              ● Active     ⋯        │
│ QuoteMe                                                                    │
│                                                                            │
│ $275,000                                                                   │
│ 10 of 25 signed   ·   12 in the last 30 days                               │
│                                                                            │
│ [7d]  [Month]  [30d ●]  [90d]  [2026]  [All]                               │
├────────────────────────────────────────────────────────────────────────────┤
│  Customers (8)   Analytics   Settings                                      │
│  ─────────────                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  [All 12]  [Active 8 ●]  [Signed 3]  [Dead 1]            + Add customer    │
│  [ search lead-source customers… ]                                         │
│                                                                            │
│  Name           Phone        Stage         Created      Last activity      │
│  Sarah Cohen    (555)…       Sent prop.    3d ago       2h ago             │
│  …                                                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Header — `LeadSourceDetailHeader`

Per the April 22 spec, the masthead (eyebrow + display name + status pill + kebab) is already correct in production. This spec keeps it as-is **except**:

- The `Active` indicator becomes an actual interactive `<Switch>`, sized compact (`size-sm` if the design system has it; otherwise the existing `Switch` with `data-[state=checked]:bg-emerald-500` to keep the dot semantic). Touch target hit area must remain ≥44×44 via `hitSlop`-equivalent padding wrapper.
- Kebab menu items: `Deactivate` (mirrors the toggle for keyboard/SR users), `Archive` (jumps to Settings → Danger zone with the section scrolled into view).
- Delete is **not** in the kebab. It's only in Danger zone, behind a typed confirmation.

### KPI strip — replaces `PerformanceStrip` body

Same component, same file (`src/features/lead-sources-admin/ui/components/performance-strip.tsx`). Body rewritten.

**Layout (desktop):**
```
$275,000                                       ← text-3xl font-semibold tracking-tight tabular-nums
10 of 25 signed · 12 in the last 30 days       ← text-sm text-muted-foreground
```

**Range chips stay at the page level** (their current home in `lead-sources-view.tsx:78-82`). The `activeChip` is the single source of truth shared across both the per-source pane and the All pane (confirmed by the comment at lines 41-43 of that file). The KPI strip *consumes* `chip` to phrase the second clause; it does not render chips.

**Mobile:** stacks (single column); subtitle wraps if needed.

**Empty state (`total === 0`):**
- Headline: `$0` (not "—" or "No leads yet" — keep the visual shape stable)
- Subtitle: `No leads yet` (single line, no middot)

**Loading:**
- Headline skeleton: `h-9 w-40`
- Subtitle skeleton: `h-4 w-72`
- Skeletons match final dimensions to avoid CLS (Quick Reference §3 `image-dimension`/`content-jumping`).

**Component API change:**
- `PerformanceStrip` props: `{ stats: { total: number; range: number; signedCustomers: number; totalSales: number }; chip: TimeRangeChip; isLoading: boolean; }`
- The output field is already named `signedCustomers` (verified at `lead-sources.router.ts:171,177,193,199`) — counting customers with at least one approved proposal. No rename needed.

**Subtitle composition:**
- `{signed} of {total} signed` — when `chip.kind === 'all'`, omit the second clause and middot.
- `{range} in the last 7 days` etc. — phrase reuses `renderRangePhrase` from the current `performance-strip.tsx`, but now flows inline as the second clause instead of a separate right column.

### Tabs

**File:** `src/features/lead-sources-admin/ui/components/source-detail.tsx`

- Three triggers: `Customers` (with count badge), `Analytics`, `Settings`.
- Default tab: `customers` (was `overview`). `parseAsStringEnum([...]).withDefault('customers')`.
- Old tab values (`overview`) gracefully redirect to `customers` to avoid breaking saved URLs.
- Visual: underline-active style. There is no existing underline variant in `shared/components/ui/tabs.tsx` (only the default pill style). Implement inline:
  - `TabsList`: `h-auto rounded-none bg-transparent border-b border-border/40 gap-4 p-0 justify-start`
  - `TabsTrigger`: `rounded-none bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none`
- Count badge on Customers: shadcn `Badge variant="secondary"` showing total customers from `getStatusCounts.all`. Hidden during loading.

### Customers tab — new wrapper component

**New file:** `src/features/lead-sources-admin/ui/components/lead-source-customers-panel.tsx`

Wraps the existing `LeadSourceCustomersSection` and adds the segmented control + Add Customer button.

```tsx
interface Props {
  leadSourceId: string
  onAddCustomer: () => void
}

export function LeadSourceCustomersPanel({ leadSourceId, onAddCustomer }: Props) {
  // Reads ?seg=, defaults to 'active'
  // Calls leadSourcesRouter.getStatusCounts to badge segments
  // Passes status filter down to LeadSourceCustomersSection
}
```

**New file:** `src/features/lead-sources-admin/ui/components/customer-status-segments.tsx`

Pill segmented control. 4 segments. Each pill = `Button` (variant tied to active state) with a count `Badge` inline. Hidden when count = 0 for that segment? **No** — keep all 4 visible always; an empty `Dead` segment with `0` is informative.

**Active = default**:
- `parseAsStringEnum(['all','active','signed','dead']).withDefault('active')`
- nuqs key: `seg`
- When the segment is the default (`active`), the param is omitted from the URL (nuqs default-stripping). Other segments persist in the URL for shareable links.

**`LeadSourceCustomersSection` changes:**
- Accepts new prop: `status?: 'active' | 'signed' | 'dead'`
- Passes to `getCustomers` query input.
- The "X total" caption updates to "X active" / "X signed" / "X dead" based on segment.

### Settings tab — new wrapper

**New file:** `src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx`

Composes 4 sub-sections, separated by `border-t border-border/40 pt-6 mt-6`. Each section uses the existing single-uppercase-label-per-section rule from the April 22 spec.

**Section 1 — Identity** (new component: `identity-editor.tsx`)
- Inputs: `Name` (text), `Slug` (text, kebab-case validation)
- Dirty-state Save/Revert (mirrors `FormConfigEditor` pattern at lines 51-76 of `form-config-editor.tsx`)
- Slug change is gated by a confirmation dialog: *"Changing the slug rotates the intake URL. The current URL stops working immediately. Continue?"* (reuse `useConfirm` from `IntakeUrlCard.tsx:21`)
- Inline error if slug collides (server returns `CONFLICT`).

**Section 2 — Intake URL**
- Reuse existing `IntakeUrlCard` as-is. Drop the leading uppercase label (`Intake URL`) since the section already has its own label one level up — avoid double-labeling.

**Section 3 — Form configuration**
- Reuse existing `FormConfigEditor` body. Drop the inner `<h3>Form configuration</h3>` heading at lines 53-55 (section heading already provides it).

**Section 4 — Danger zone** (new component: `danger-zone.tsx`)
- Container: `border border-destructive/40 rounded-lg p-4`
- 2 rows (not 3 — Active toggle stays in header):
  - **Archive** — sets `archivedAt` timestamp. Lead source disappears from the picker but data is preserved. Right button: outline destructive, `Archive`.
  - **Delete** — only enabled if customer count = 0. Otherwise the button is disabled with tooltip "Reassign or archive — N customers still attached." Right button: solid destructive, `Delete…`. Click opens typed-confirmation dialog ("Type `quoteme` to confirm").
- Per row: `flex items-center justify-between py-3` + `border-t border-destructive/20` between rows.

### Analytics tab — placeholder

**New file:** `src/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder.tsx`

```
┌──────────────────────────────────────────────────────────┐
│   📊  Coming soon                                         │
│   Funnel breakdown, weekly trend, cohort analysis.        │
│   In the meantime, the headline metrics above and the     │
│   Customers tab cover the daily questions.                │
└──────────────────────────────────────────────────────────┘
```

Plain centered card, `text-muted-foreground`, no spinner. (No emoji per project rule — use `BarChart3Icon` from lucide.)

## Server changes — `leadSourcesRouter`

**File:** `src/trpc/routers/lead-sources.router.ts`

### `getStats` — modify

Output shape extends from `{ total, range, signedCustomers }` to:
```ts
{
  total: number
  range: number
  signedCustomers: number
  totalSales: number  // NEW
}
```

**Implementation:**
- Existing logic computes `total` (lifetime), `range` (within from/to), `signedCustomers`.
- Add: select all proposals belonging to customers of this lead source where `proposals.status = 'approved'`, hydrate `fundingJSON`, derive each `value = computeFinalTcp(fundingJSON.data)`, then sum via `computeProjectValue([...])`.
- Reference call shape: see [src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:467-469](src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts#L467-L469).
- Time range does **not** filter `totalSales` in Phase 1 — it's a lifetime number on the strip. (Confirmed in brainstorming: total sales is treated as the headline regardless of range.) If we want range-scoped total sales later, that's Phase 2.

### `getStatusCounts` — new

```ts
getStatusCounts: agentProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    // Single SQL CTE returning all 4 counts.
    return { all: number, active: number, signed: number, dead: number }
  })
```

**Status definitions** — grounded in the verified schema (`customers.pipelineStage` is `text('pipeline_stage')` and the `customerPipelines` enum is `['active', 'rehash', 'dead']`):

- `all` — every customer attached to this lead source (no filter)
- `signed` — has ≥1 proposal with `status='approved'`. Pipeline-stage agnostic.
- `dead` — `pipelineStage = 'dead'` AND has no approved proposal (a customer with an approved proposal counts as `signed` even if later marked dead).
- `active` — `pipelineStage IN ('active', 'rehash')` AND has no approved proposal.

Counts must satisfy the invariant: `active + signed + dead === all` (no double-count, no orphans).

### `getCustomers` — modify

Add optional `status` input: `z.enum(['active','signed','dead']).optional()`. Filter the query accordingly. Defaults to no filter when omitted (the All segment).

### `updateLeadSource` — extend

Already exists for `formConfigJSON`. Extend to accept optional `name` and `slug`. Slug change must:
- Validate uniqueness (return `CONFLICT` on collision).
- Rotate the token in the same transaction (so the old URL stops working immediately, matching the dialog promise).
- Validate kebab-case via existing slug schema.

### `archiveLeadSource` — new

Sets `archivedAt = now()`. Idempotent. Returns the updated row. Lead source list query must filter `archivedAt IS NULL` going forward (verify in `lead-source-list.tsx`).

### `deleteLeadSource` — new

Hard delete. Server-side guard: throw if customers exist (`PRECONDITION_FAILED`). Client must surface this as a toast.

### Schema changes

Add `archived_at TIMESTAMPTZ` to `lead_sources` table if not already present. Migration via Drizzle (`pnpm db:push:dev` per project memory — never `db:push`).

## Data flow

```
SourceDetail
  ├─ leadSourcesRouter.getById            (name, slug, token, active, formConfig, archivedAt)
  ├─ leadSourcesRouter.getStats           (total, range, signed, totalSales)
  └─ Tabs
     ├─ Customers (default)
     │   ├─ leadSourcesRouter.getStatusCounts   (segment badges)
     │   └─ leadSourcesRouter.getCustomers      (paginated, +status filter, +search)
     ├─ Analytics  → placeholder
     └─ Settings
         ├─ identity:    leadSourcesRouter.updateLeadSource (name, slug)
         ├─ intake URL:  leadSourcesRouter.rotateToken (existing)
         ├─ form config: leadSourcesRouter.updateLeadSource (formConfigJSON) (existing)
         └─ danger zone:
             ├─ leadSourcesRouter.archiveLeadSource
             └─ leadSourcesRouter.deleteLeadSource
```

## Invalidation

Per `feedback-participant-invalidation.md` pattern — invalidate at the surface, not the universe.

| Mutation | Invalidate |
|---|---|
| `updateLeadSource` (name/slug/formConfig) | `getById`, `lead-source-list` |
| `rotateToken` | `getById` |
| `setActive` (header switch) | `getById`, `lead-source-list` |
| `archiveLeadSource` | `getById`, `lead-source-list` (which now filters `archivedAt IS NULL`) |
| `deleteLeadSource` | `getById`, `lead-source-list`; navigate to `/dashboard/lead-sources` (no detail to show) |
| `addCustomerToLeadSource` (existing) | `getStats`, `getStatusCounts`, `getCustomers` |

## Loading, empty, error states

- **KPI strip loading:** skeleton matches final dims (above).
- **KPI strip empty:** `$0` headline, `No leads yet` subtitle, chips visible.
- **Customers tab loading:** existing skeleton from `LeadSourceCustomersSection`. Segments render with skeleton counts (`h-3 w-6`).
- **Customers tab empty (per segment):**
  - Active empty: "No active customers from this source yet" + ghost button "+ Add customer"
  - Signed empty: "No signed customers from this source yet"
  - Dead empty: "No dead customers"
  - All empty: existing empty state from `DataTable`
- **Settings tab loading:** sections render with disabled inputs and a single skeleton.
- **Slug collision:** inline error text under input.
- **Delete blocked:** disabled button + tooltip + on-attempt toast.
- **Archive success:** toast + navigate back to `/dashboard/lead-sources`.

## Motion

Reuse the existing `useEntranceMotion` hook from [src/features/lead-sources-admin/lib/use-entrance-motion.ts](src/features/lead-sources-admin/lib/use-entrance-motion.ts). Stagger pattern from the April 22 spec preserved:
1. Eyebrow → 180ms
2. Display name → 220ms (delay +40ms)
3. KPI hero (`$275,000`) → 260ms (delay +100ms)
4. KPI subtitle → 200ms (delay +180ms)
5. Range chips → fade only, 200ms (delay +220ms)

No motion on tab content (it would compete with the entrance). All motion respects `prefers-reduced-motion` via Tailwind's `motion-safe:` (already pattern in codebase).

## Component API summary

| Component | Status | Change |
|---|---|---|
| `LeadSourceDetailHeader` | modified | Active becomes interactive Switch; kebab adds Deactivate/Archive items |
| `PerformanceStrip` | modified | New body (dollar-led hero), absorbs range chips, accepts `totalSales` + chip props |
| `IntakeUrlCard` | modified | Drop inner uppercase heading (parent provides it) |
| `FormConfigEditor` | modified | Drop inner heading (parent provides it) |
| `LeadSourceCustomersSection` | modified | New `status?` prop |
| `LeadSourceCustomersPanel` | new | Wraps Section + Segments + Add CTA |
| `CustomerStatusSegments` | new | 4-pill segmented control with counts |
| `LeadSourceSettingsPanel` | new | Composes 4 sub-sections |
| `IdentityEditor` | new | Name + slug edit with rotate-confirm dialog |
| `DangerZone` | new | Archive + Delete rows |
| `LeadSourceAnalyticsPlaceholder` | new | Coming-soon card |
| `SourceDetail` | modified | New tab list, Customers default, range chips moved into strip |

## Non-goals (Phase 1)

Explicitly deferred:

- **Analytics content** — funnel breakdown (Phase 2), trend chart, funnel × time, cohort table (Phase 3)
- **All pane (`all-detail.tsx`)** — keeps current shape. Aggregate KPI strip update happens when Phase 2 data is available.
- **Range-scoped total sales** — total sales is lifetime in Phase 1; range-scoped variant is a Phase 2 nice-to-have once the funnel is in place.
- **Per-source assignment to a rep / owner** — not in this scope.
- **Mobile responsive pass beyond the existing flex direction swap** — the project memory entry [`project-lead-sources-mobile-responsive.md`](../../memory/project-lead-sources-mobile-responsive.md) tracks the broader mobile work.

## Verification

- `pnpm tsc` clean, `pnpm lint` clean (per project rule: never `pnpm build` unless asked).
- `pnpm db:push:dev` cleanly applies the `archived_at` column migration.
- Manual dev check on `/dashboard/lead-sources/quoteme`:
  - Customers tab is active by default; URL `?tab=customers&seg=active` is the default state.
  - KPI strip reads `$X / N of M signed · K in the last 30 days` with all numbers tabular.
  - Range chip change updates `range` and `K in the last...` clause without flicker (placeholderData kept).
  - Active segment row count matches the segment badge count.
  - Settings → Identity: rename works; slug change shows confirm and rotates URL.
  - Settings → Danger zone: Archive returns to picker; Delete is disabled when customers exist.
- Vitest:
  - `getStats.totalSales` returns Σ approved-proposal final TCPs across this source's customers.
  - `getStatusCounts` returns 4 numbers consistent with `getCustomers` row counts under each filter.
  - `getCustomers` honors each `status` value.
  - Slug-change mutation rotates token in the same transaction.
- Playbook self-audit (per April 22 spec): one uppercase label per section, no nested cards, flat surfaces, tabular-nums on all numbers, motion-safe transitions, semantic tokens only.

## Risk

- **Medium.** Server changes touch a hot router; new mutations need permission gates (agentProcedure already enforces auth, but archive/delete deserve a super-admin gate — verify against `permissions/`).
- **Low blast radius on UI:** all changes are inside `features/lead-sources-admin/`, with one hub file (`source-detail.tsx`) reorchestrated. The All pane is untouched, the picker is untouched.
- **Migration risk:** `archived_at` is additive; safe with concurrent writes. Existing rows backfill to `NULL`. The picker query gains a `WHERE archivedAt IS NULL` clause — verify no caller depends on archived rows being visible.
- **Rollback:** revert the PR. Schema migration is additive and can stay (column unused) or be reverted independently.

## Future phases

Out of this spec, but recorded so the writing-plans skill can sketch follow-ups:

**Phase 2 — Analytics: funnel breakdown**
- New tRPC procedure: `leadSourcesRouter.getFunnel`
- 4-step funnel: Lead → Meeting booked → Proposal sent → Signed
- Server computes counts + drop rates for the active range
- UI: simple horizontal bar with drop-off rates between steps
- Replaces the placeholder card

**Phase 3 — Analytics: trend, funnel × time, cohort**
- Trend over time: weekly bucket, leads-per-week + signed-per-week overlay
- Funnel × time: bucketed table (week rows × funnel-stage cols)
- Cohort: lead-creation-week × outcome (signed / dead / open)
- Probably requires a chart lib choice (Recharts vs visx); deferred until the actual data shape is built
