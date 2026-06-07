# Campaigns Overview & Setup Visual Refinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the visual hierarchy, kill layout instability, and fix mobile on the Campaigns **Overview** and **Setup** tabs — with zero behavior, data, or API change.

**Architecture:** Pure presentational refactor of `src/features/campaigns-admin/`. Overview gains a slim summary bar (replacing 3 KPI cards), splits sources into actionable rich cards (sorted by eligible desc) + an always-open compact idle list, and replaces the amber banner with a header pill + one-line helper. Setup moves to a responsive 2/1 grid. A shared nuqs tab parser lets the card deep-link to Setup.

**Tech Stack:** Next.js 15 (App Router, RSC), React client components, TypeScript, Tailwind v4, shadcn/ui, tRPC + TanStack Query, nuqs.

**Spec:** `docs/superpowers/specs/2026-06-07-campaigns-overview-setup-refinement-design.md`

**Testing note:** These are presentational components with no existing unit-test harness, and this change is zero-behavior. The verification gate for every task is `pnpm tsc` (clean) + `pnpm lint` (clean). A final task does visual verification at desktop + 375px via Playwright. Never run `pnpm build`.

**Conventions enforced:** one React component per file; named exports only; no file-level constants/helpers in component files; no barrels; imports sorted (perfectionist) — run `pnpm lint` after each task and reorder imports if it flags `perfectionist/sort-imports`. Use `outline-2 outline-primary -outline-offset-2` for focus (never `ring-*`). `tabular-nums` on all counts.

---

## File map

| File | Responsibility | Action |
|---|---|---|
| `constants/query-parsers.ts` | Shared `CAMPAIGN_TABS` literal + `campaignTabParser` (single source of truth for tab keys) | Create |
| `ui/views/campaigns-view.tsx` | Tab shell | Modify (consume shared parser) |
| `lib/partition-source-summaries.ts` | Pure split of summaries → `{ actionable, idle }` + sort; exports `SourceSummary` type | Create |
| `ui/components/overview/overview-summary-bar.tsx` | Slim totals bar | Create (replaces totals-strip) |
| `ui/components/overview/overview-totals-strip.tsx` | old KPI strip | Delete |
| `ui/components/overview/source-rollup-card.tsx` | Needs-action rich card | Modify (redesign) |
| `ui/components/overview/idle-source-row.tsx` | One compact idle row | Create |
| `ui/components/overview/idle-sources-list.tsx` | Bordered divided idle container | Create |
| `ui/views/campaigns-overview-view.tsx` | Overview orchestration | Modify (rewire) |
| `ui/views/campaigns-setup-view.tsx` | Setup layout | Modify (2/1 grid) |
| `ui/components/setup/cloudtalk-sync-card.tsx` | Sync + binding table | Modify (responsive header + table scroll) |

---

## Task 0: Branch

- [ ] **Step 1: Create a feature branch** (only if the user has approved execution; we are on `main`)

```bash
git checkout -b refactor/campaigns-overview-setup-refinement
```

Expected: switched to a new branch.

---

## Task 1: Shared tab parser

**Files:**
- Create: `src/features/campaigns-admin/constants/query-parsers.ts`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-view.tsx`

- [ ] **Step 1: Create the parser constants file**

```ts
import { parseAsStringLiteral } from 'nuqs'

export const CAMPAIGN_TABS = ['overview', 'leads', 'setup'] as const

export type CampaignTab = typeof CAMPAIGN_TABS[number]

export const campaignTabParser = parseAsStringLiteral(CAMPAIGN_TABS).withDefault('overview')
```

- [ ] **Step 2: Update `campaigns-view.tsx` to consume it**

Replace the entire file with:

```tsx
'use client'

import { useQueryState } from 'nuqs'

import type { CampaignTab } from '@/features/campaigns-admin/constants/query-parsers'

import { campaignTabParser } from '@/features/campaigns-admin/constants/query-parsers'
import { CampaignsLeadsView } from '@/features/campaigns-admin/ui/views/campaigns-leads-view'
import { CampaignsOverviewView } from '@/features/campaigns-admin/ui/views/campaigns-overview-view'
import { CampaignsSetupView } from '@/features/campaigns-admin/ui/views/campaigns-setup-view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

export function CampaignsView() {
  const [tab, setTab] = useQueryState('tab', campaignTabParser)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
        <p className="text-xs text-muted-foreground">
          CloudTalk lead-conversion campaigns — enroll, curate, and inspect leads.
        </p>
      </header>

      <Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={v => setTab(v as CampaignTab)} value={tab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent className="min-h-0 flex-1" value="overview"><CampaignsOverviewView /></TabsContent>
        <TabsContent className="flex min-h-0 flex-1 flex-col" value="leads"><CampaignsLeadsView /></TabsContent>
        <TabsContent className="min-h-0 flex-1" value="setup"><CampaignsSetupView /></TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. Fix import ordering if perfectionist flags it.

- [ ] **Step 4: Commit**

```bash
git add src/features/campaigns-admin/constants/query-parsers.ts src/features/campaigns-admin/ui/views/campaigns-view.tsx
git commit -m "refactor(campaigns): extract shared tab parser for nuqs deep-linking"
```

---

## Task 2: Partition helper + shared summary type

**Files:**
- Create: `src/features/campaigns-admin/lib/partition-source-summaries.ts`

- [ ] **Step 1: Create the helper**

```ts
import type { AppRouterOutputs } from '@/trpc/routers/app'

export type SourceSummary = AppRouterOutputs['voipCampaignsRouter']['getSourceCampaignSummaries'][number]

export interface PartitionedSummaries {
  actionable: SourceSummary[]
  idle: SourceSummary[]
}

/**
 * Split source summaries into actionable (has eligible leads) and idle (none).
 * Actionable sources are sorted by eligible count desc so the most urgent lead.
 */
export function partitionSourceSummaries(summaries: SourceSummary[]): PartitionedSummaries {
  const actionable: SourceSummary[] = []
  const idle: SourceSummary[] = []

  for (const summary of summaries) {
    if (summary.eligibleCount > 0) {
      actionable.push(summary)
    }
    else {
      idle.push(summary)
    }
  }

  actionable.sort((a, b) => b.eligibleCount - a.eligibleCount)

  return { actionable, idle }
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc`
Expected: clean. (`AppRouterOutputs` resolves the summary shape; confirms no drift from the router.)

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns-admin/lib/partition-source-summaries.ts
git commit -m "refactor(campaigns): add source-summary partition helper + shared type"
```

---

## Task 3: Slim summary bar

**Files:**
- Create: `src/features/campaigns-admin/ui/components/overview/overview-summary-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { cn } from '@/shared/lib/utils'

interface OverviewSummaryBarProps {
  dnc: number
  eligible: number
  enrolled: number
}

export function OverviewSummaryBar({ dnc, eligible, enrolled }: OverviewSummaryBarProps) {
  const segments = [
    { dotClass: 'bg-green-500', label: 'Enrolled', value: enrolled },
    { dotClass: 'bg-muted-foreground', label: 'Eligible', value: eligible },
    { dotClass: 'bg-red-500', label: 'DNC', value: dnc },
  ]

  return (
    <div className="flex items-center rounded-lg bg-muted/40 px-1 py-2.5 sm:px-2">
      {segments.map((seg, i) => (
        <div
          key={seg.label}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-1 sm:gap-2.5 sm:px-2',
            i > 0 && 'border-l border-border/60',
          )}
        >
          <span
            aria-hidden="true"
            className={cn('size-1.5 shrink-0 rounded-full sm:size-2', seg.dotClass)}
          />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
            {seg.label}
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground sm:text-lg">
            {seg.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
```

Note: `i` is used only for the divider class, not as the React `key` (key is `seg.label`) — no `react/no-array-index-key` violation.

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns-admin/ui/components/overview/overview-summary-bar.tsx
git commit -m "feat(campaigns): slim overview summary bar"
```

---

## Task 4: Redesign the needs-action card

**Files:**
- Modify: `src/features/campaigns-admin/ui/components/overview/source-rollup-card.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useQueryState } from 'nuqs'

import type { SourceSummary } from '@/features/campaigns-admin/lib/partition-source-summaries'

import { campaignTabParser } from '@/features/campaigns-admin/constants/query-parsers'
import { EnrollAllPopover } from '@/features/campaigns-admin/ui/components/overview/enroll-all-popover'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

export function SourceRollupCard({ summary }: { summary: SourceSummary }) {
  const [, setTab] = useQueryState('tab', campaignTabParser)

  const stats = [
    { hero: false, label: 'Enrolled', tone: 'text-green-600 dark:text-green-400', value: summary.enrolledCount },
    { hero: true, label: 'Eligible', tone: 'text-foreground', value: summary.eligibleCount },
    { hero: false, label: 'DNC', tone: 'text-red-600 dark:text-red-400', value: summary.dncCount },
  ]

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-foreground">{summary.name}</span>
          <span className="truncate text-xs text-muted-foreground">{summary.sourceSlug}</span>
        </div>
        {summary.defaultCampaignId
          ? <Badge className="shrink-0" variant="secondary">Bound</Badge>
          : (
              <Badge
                className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                variant="outline"
              >
                No default
              </Badge>
            )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div
            key={s.label}
            className="flex flex-col"
          >
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
            <span className={cn('tabular-nums', s.hero ? 'text-2xl font-bold' : 'text-base font-semibold', s.tone)}>
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {summary.needsBinding && (
        <p className="text-xs text-muted-foreground">
          Pick a campaign on enroll, or
          {' '}
          <button
            className="rounded font-medium text-amber-700 underline-offset-2 outline-2 outline-primary -outline-offset-2 hover:underline focus-visible:outline dark:text-amber-400"
            type="button"
            onClick={() => setTab('setup')}
          >
            set a default → Setup
          </button>
        </p>
      )}

      <div className="mt-auto pt-1">
        <EnrollAllPopover
          defaultCampaignId={summary.defaultCampaignId}
          eligibleCount={summary.eligibleCount}
          sourceSlug={summary.sourceSlug}
        />
      </div>
    </Card>
  )
}
```

Key changes vs old card: amber banner removed; binding shown as a header pill + a single muted helper line whose "→ Setup" switches the `tab` param via the shared parser; Eligible is the hero stat (`text-2xl font-bold`); the action is wrapped in `mt-auto` so buttons align across a row; `SourceSummary` type now comes from the partition helper (the local interface is deleted).

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns-admin/ui/components/overview/source-rollup-card.tsx
git commit -m "feat(campaigns): redesign needs-action source card (pill, hero stat, helper)"
```

---

## Task 5: Idle row + idle list

**Files:**
- Create: `src/features/campaigns-admin/ui/components/overview/idle-source-row.tsx`
- Create: `src/features/campaigns-admin/ui/components/overview/idle-sources-list.tsx`

- [ ] **Step 1: Create `idle-source-row.tsx`**

```tsx
'use client'

import type { SourceSummary } from '@/features/campaigns-admin/lib/partition-source-summaries'

import { Badge } from '@/shared/components/ui/badge'

export function IdleSourceRow({ summary }: { summary: SourceSummary }) {
  const stats = [
    { label: 'Enrolled', value: summary.enrolledCount },
    { label: 'Eligible', value: summary.eligibleCount },
    { label: 'DNC', value: summary.dncCount },
  ]

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {summary.name}
      </span>
      <div className="flex shrink-0 items-center gap-2.5 text-xs tabular-nums text-muted-foreground sm:gap-3">
        {stats.map(s => (
          <span key={s.label}>
            <span className="hidden sm:inline">{`${s.label} `}</span>
            {s.value.toLocaleString()}
          </span>
        ))}
      </div>
      {summary.defaultCampaignId
        ? <Badge className="shrink-0" variant="secondary">Bound</Badge>
        : <Badge className="shrink-0" variant="outline">No default</Badge>}
    </div>
  )
}
```

- [ ] **Step 2: Create `idle-sources-list.tsx`**

```tsx
'use client'

import type { SourceSummary } from '@/features/campaigns-admin/lib/partition-source-summaries'

import { IdleSourceRow } from '@/features/campaigns-admin/ui/components/overview/idle-source-row'

export function IdleSourcesList({ summaries }: { summaries: SourceSummary[] }) {
  if (summaries.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {`Idle · ${summaries.length} ${summaries.length === 1 ? 'source' : 'sources'}`}
      </h2>
      <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
        {summaries.map(s => (
          <IdleSourceRow
            key={s.sourceSlug}
            summary={s}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/campaigns-admin/ui/components/overview/idle-source-row.tsx src/features/campaigns-admin/ui/components/overview/idle-sources-list.tsx
git commit -m "feat(campaigns): compact idle-source rows + container"
```

---

## Task 6: Rewire the Overview view + delete old strip

**Files:**
- Modify: `src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx`
- Delete: `src/features/campaigns-admin/ui/components/overview/overview-totals-strip.tsx`

- [ ] **Step 1: Replace the entire view**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

import { partitionSourceSummaries } from '@/features/campaigns-admin/lib/partition-source-summaries'
import { IdleSourcesList } from '@/features/campaigns-admin/ui/components/overview/idle-sources-list'
import { OverviewSummaryBar } from '@/features/campaigns-admin/ui/components/overview/overview-summary-bar'
import { SourceRollupCard } from '@/features/campaigns-admin/ui/components/overview/source-rollup-card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

export function CampaignsOverviewView() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions(),
  )
  const summaries = data ?? []

  const totals = summaries.reduce(
    (acc, s) => ({
      dnc: acc.dnc + s.dncCount,
      eligible: acc.eligible + s.eligibleCount,
      enrolled: acc.enrolled + s.enrolledCount,
    }),
    { dnc: 0, eligible: 0, enrolled: 0 },
  )

  const { actionable, idle } = partitionSourceSummaries(summaries)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 overflow-y-auto">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="h-44 w-full"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto">
      <OverviewSummaryBar
        dnc={totals.dnc}
        eligible={totals.eligible}
        enrolled={totals.enrolled}
      />

      {actionable.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {`Needs action · ${actionable.length}`}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {actionable.map(s => (
              <SourceRollupCard
                key={s.sourceSlug}
                summary={s}
              />
            ))}
          </div>
        </section>
      )}

      <IdleSourcesList summaries={idle} />

      {summaries.length === 0 && (
        <p className="text-sm text-muted-foreground">No lead sources found.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete the old totals strip**

```bash
git rm src/features/campaigns-admin/ui/components/overview/overview-totals-strip.tsx
```

Expected: file removed. (Confirm nothing else imports it.)

- [ ] **Step 3: Confirm no dangling imports**

Run: `grep -rn "overview-totals-strip\|OverviewTotalsStrip" src`
Expected: no output.

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx
git commit -m "feat(campaigns): rewire overview into summary bar + needs-action grid + idle list"
```

---

## Task 7: Setup tab — responsive 2/1 grid + table scroll

**Files:**
- Modify: `src/features/campaigns-admin/ui/views/campaigns-setup-view.tsx`
- Modify: `src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx`

- [ ] **Step 1: Replace `campaigns-setup-view.tsx`**

```tsx
'use client'

import { CloudtalkSyncCard } from '@/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card'
import { ContactAttributesReadout } from '@/features/campaigns-admin/ui/components/setup/contact-attributes-readout'

export function CampaignsSetupView() {
  return (
    <div className="grid grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-3">
      <div className="lg:col-span-2">
        <CloudtalkSyncCard />
      </div>
      <div className="lg:col-span-1">
        <ContactAttributesReadout />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Make the sync card header responsive**

In `cloudtalk-sync-card.tsx`, change the `CardHeader` opening tag from:

```tsx
      <CardHeader className="flex flex-row items-start justify-between gap-4">
```

to:

```tsx
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
```

- [ ] **Step 3: Wrap the binding table for horizontal scroll on mobile**

In `cloudtalk-sync-card.tsx`, the `<Table>…</Table>` block lives in the final `: (` branch of the `CardContent` ternary. Wrap it in an `overflow-x-auto` div. Change:

```tsx
            : (
                <Table>
```

to:

```tsx
            : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[640px]">
```

and add the matching closing `</div>` immediately after `</Table>`:

```tsx
                  </Table>
                </div>
              )}
```

(The existing `</Table>` indentation shifts right by two spaces inside the new div — re-indent the table body if lint requires, but functionally only the wrapper + `min-w` + closing `</div>` are added.)

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/campaigns-admin/ui/views/campaigns-setup-view.tsx src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx
git commit -m "feat(campaigns): responsive 2/1 setup layout + mobile table scroll"
```

---

## Task 8: Visual verification + audit pass

**Files:** none (verification + any small fixes surfaced).

- [ ] **Step 1: Run the dev server**

```bash
pnpm dev -- --port 3002
```

(Background it; super-admin auth required to view `/dashboard/campaigns`.)

- [ ] **Step 2: Capture Overview at desktop + mobile**

Use Playwright MCP: navigate to `/dashboard/campaigns?tab=overview`, screenshot at 1440px and at 375px. Confirm:
  - Summary bar reads as one slim bar (not 3 cards); fits one line at 375px.
  - Needs-action cards are structurally uniform; "Enroll all" buttons align across each row; unbound cards show the amber `No default` pill + one helper line (no banner).
  - Eligible is the visually dominant stat.
  - Idle sources render as compact rows in one bordered container.
  - No horizontal page overflow at 375px.

- [ ] **Step 3: Capture Setup at desktop + mobile**

Navigate to `?tab=setup`, screenshot at 1440px and 375px. Confirm:
  - Binding table card spans 2 cols, attributes card 1 col, width filled (no dead zone).
  - At 375px both stack; Resync button drops below the title; binding table scrolls horizontally with no page overflow.

- [ ] **Step 4: Run the design-audit skill chain**

Apply the project's standard UI audit to the changed components (per the user's UI methodology): `ui-ux-pro-max` review → `web-design-guidelines` compliance check → `impeccable` audit. Address any high-value findings with focused edits, re-running `pnpm tsc && pnpm lint` after each.

- [ ] **Step 5: Final gate + commit any audit fixes**

```bash
pnpm tsc && pnpm lint
git add -A
git commit -m "polish(campaigns): address visual audit findings on overview + setup"
```

Expected: tsc + lint clean. Skip the commit if Step 4 produced no changes.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Slim summary bar → Task 3 + Task 6. ✓
- Needs-action cards (pill, hero Eligible, helper, bottom-pinned action, sorted desc) → Task 4 (card) + Task 2 (sort) + Task 6 (render). ✓
- Idle compact rows, always-open bordered container → Task 5 + Task 6. ✓
- `needsBinding` pill + helper link replacing banner; "→ Setup" via nuqs → Task 4 + Task 1 (shared parser). ✓
- Name emoji rendered raw → cards/rows render `summary.name` unmodified. ✓
- Setup 2/1 split, drop `max-w-3xl`, responsive header, table scroll → Task 7. ✓
- Mobile behavior (summary bar one line, cards stack, idle rows, setup stack/scroll) → Tasks 3,4,5,7 + verified in Task 8. ✓
- New `constants/query-parsers.ts` + `lib/partition-source-summaries.ts` → Tasks 1, 2. ✓
- No router/service/DAL/Leads/enroll-popover-logic change → no task touches them. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full content. ✓

**Type consistency:** `SourceSummary` defined once in `lib/partition-source-summaries.ts` and imported by the card, idle row, and idle list. `campaignTabParser`/`CAMPAIGN_TABS`/`CampaignTab` defined once in `constants/query-parsers.ts` and consumed by the view + card. `partitionSourceSummaries` returns `{ actionable, idle }` consumed verbatim in Task 6. ✓
