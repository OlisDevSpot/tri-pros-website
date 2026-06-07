# Campaigns Control Center — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/dashboard/campaigns` as a three-tab operations console (Overview · Leads · Setup) for managing CloudTalk lead-conversion campaigns, on top of the already-shipped backend.

**Architecture:** A tab shell (`nuqs` `tab` param) renders three views. **Overview** = totals strip + per-source rollup cards. **Leads** = the power tool: a `usePaginatedQuery` + shared `DataTable` over `listLeads`, with feature-local multi-select (a `Set<customerId>` in view state, surfaced via table `meta`), a bulk action bar, and a `Sheet` drawer that hydrates a customer on open via `customersRouter.crud.getById`. **Setup** = relocated CloudTalk sync + campaign-binding table + a contact-attributes readout. All status colors and the location formatter live in `lib/`. The live CloudTalk drawer block + per-row live-signal cell are **deferred to backend Phase 2** — components are shaped so they slot in later without rework.

**Tech Stack:** Next.js 15 App Router (client components), tRPC (`useTRPC()`), TanStack Query, the shared query toolkit (`usePaginatedQuery` + `QueryToolbar` + `DataTable`), `nuqs`, shadcn/ui (`Sheet`/`Tabs`/`Badge`/`Select`/`Popover`/`Checkbox`/`Skeleton`/`Tooltip`), `motion/react`, `sonner` toasts, `useConfirm`.

---

## Pre-flight (read before any task)

**Conventions — non-negotiable:**
- **No test runner.** Verify every task with `pnpm tsc` + `pnpm lint` ONLY. **NEVER `pnpm build`. NEVER `pnpm db:push`** — this plan changes zero schema and zero backend.
- ONE React component per file. Named exports only — no `export default`. No file-level constants or helper functions inside component files (extract to `constants/` / `lib/`). No barrels in `ui/components`, `ui/views`, `hooks`, `lib`, `constants`.
- Imports must be sorted (`perfectionist/sort-imports`, `sort-named-imports`); always brace + newline `if` bodies (`antfu/if-newline`); no duplicate import sources.
- Commit per task, conventional messages (`feat(campaigns): …`), end every commit body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Stay on `main`. Do not push.

**Backend is done — the consumable API (all in `trpc.voipCampaignsRouter`, super-admin):**
- Reads: `getSourceCampaignSummaries` → `{ sourceSlug, name, isActive, defaultCampaignId, dncCount, eligibleCount, enrolledCount, needsBinding }[]`; `listCampaigns`; `listAttributes`; `listLeads` (paginated, see below); `getEnrollmentCounts`; `listEnrolledLeads`.
- Mutations: `resyncFromCloudtalk`, `bindCampaignToSource`, `setDefaultCampaign`, `enroll({customerId, campaignId?})`, `enrollAll({sourceSlug, campaignId})`, `enrollSelected({customerIds, campaignId})` → `{requested, enrolled}`, `removeFromCampaign({customerId})`, `removeBulk({customerIds})` → `{requested, removed}`, `disqualify({customerId})`, `disqualifyBulk({customerIds})` → `{requested, unenrolled}`, `unenrollAll({sourceSlug})`, `switchCampaign({customerId, toCampaignId})`, `markDnc({customerIds})` → `{count}`, `removeDnc({customerId})`.

**`listLeads` contract** (input via `paginatedQueryInput`):
```ts
// input.filters: { status: 'eligible'|'enrolled'|'removed'|'dnc', sourceSlug?, campaignId? }
// status defaults to 'eligible' server-side if omitted — but ALWAYS send it.
// Returns PaginatedResult<CampaignLeadRow>:
interface CampaignLeadRow {
  customerId: string
  name: string
  status: 'eligible' | 'enrolled' | 'removed' | 'dnc'
  campaignId: string | null
  campaignName: string | null
  enrolledAt: string | null     // ISO string
  leadSourceId: string | null
}
```
`CampaignLeadRow` does **not** carry phone/address/trades — the drawer fetches the full customer on open (decision below).

**Resolved decisions (do not revisit):**
- **Drawer identity source:** drawer fetches `trpc.customersRouter.crud.getById({ id: customerId })` on open. Zero backend change. Shows a skeleton while loading.
- **Profile deep-link:** open the existing `CustomerProfileModal` via `useModalStore` (NOT a route) — same pattern as `lead-source-customers-section.tsx`.
- **Address:** `address` is nullable (render only when present); `city` + `zip` always present (`state` defaults `'CA'`). Format: optional address line, then `city, state zip`.
- **Row selection:** not supported by the shared `DataTable`; manage a `Set<customerId>` in the Leads view and expose select state/handlers through table `meta`. Select-all toggles the current page only (server-paginated).
- **Status/source/campaign filters:** modeled as query-toolkit filter definitions (built at runtime from loaded sources/campaigns), driven entirely by `usePaginatedQuery` — never hand-rolled URL state. Only the `tab` param uses `nuqs` directly.
- **Live CloudTalk block + per-row live-signal cell:** DEFERRED (backend Phase 2). Not built here.

**Reference implementations to mirror:**
- Query-toolkit + DataTable full stack: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
- Filter config shape: `src/shared/entities/customers/constants/customer-filter-config.ts`
- `useConfirm`: `[ConfirmDialog, confirm] = useConfirm({ title, message })`; render `<ConfirmDialog/>`, `await confirm()`.
- Mutations+invalidation+toast: existing `src/features/campaigns-admin/hooks/use-campaign-mutations.ts`.

---

## File structure

```
src/features/campaigns-admin/
  constants/
    lead-status.ts                 # NEW: status union + presentation meta (label/dot/text classes)
  lib/
    format-lead-location.ts        # NEW: address+city+state+zip → display lines
    build-leads-filter-config.ts   # NEW: runtime filter-definition builder (status/source/campaign)
  hooks/
    use-campaign-mutations.ts      # EXTEND: enrollSelected, removeBulk, markDnc, removeDnc, switchCampaign
  ui/
    views/
      campaigns-view.tsx           # REWRITE: tab shell (nuqs `tab`)
      campaigns-overview-view.tsx  # NEW
      campaigns-leads-view.tsx     # NEW (orchestrates table + selection + drawer)
      campaigns-setup-view.tsx     # NEW
    components/
      overview/
        overview-totals-strip.tsx  # NEW
        source-rollup-card.tsx     # NEW
        enroll-all-popover.tsx     # NEW (shared w/ leads filter bar)
      leads/
        leads-filter-bar.tsx       # NEW (QueryToolbar composition + enroll-all)
        lead-status-badge.tsx      # NEW
        lead-select-header.tsx     # NEW (header checkbox)
        lead-select-cell.tsx       # NEW (row checkbox)
        lead-row-actions.tsx       # NEW (per-row action menu)
        leads-bulk-action-bar.tsx  # NEW (motion slide-up)
        lead-drawer.tsx            # NEW (Sheet shell + orchestration)
        lead-drawer-identity.tsx   # NEW (fetches customer on open)
        lead-drawer-actions.tsx    # NEW (status-contextual actions)
        switch-campaign-popover.tsx# NEW
      setup/
        cloudtalk-sync-card.tsx    # MOVED from ui/components/
        campaign-binding-row.tsx   # MOVED from ui/components/
        contact-attributes-readout.tsx # NEW
  ui/lib/
    leads-columns.tsx              # NEW: buildLeadsColumns() — ColumnDef<CampaignLeadRow>[]
```

**Retired** (delete after salvage): `ui/components/source-enrollment-panel.tsx`, `ui/components/campaign-source-list.tsx`, `ui/components/enrolled-leads-list.tsx`, `ui/components/enrolled-lead-row.tsx`. (`cloudtalk-sync-card.tsx` + `campaign-binding-row.tsx` move into `setup/`.)

---

## Task 1: Status constants + location formatter

**Files:**
- Create: `src/features/campaigns-admin/constants/lead-status.ts`
- Create: `src/features/campaigns-admin/lib/format-lead-location.ts`

- [ ] **Step 1: Status presentation map**

`constants/lead-status.ts` — the feature-local source of the status union + semantic colors (dot + text label; never color-alone). Mirrors how meetings/proposals colocate status colors.

```ts
export type LeadStatus = 'eligible' | 'enrolled' | 'removed' | 'dnc'

export interface LeadStatusMeta {
  label: string
  /** Tailwind class for the status dot (semantic color). */
  dotClass: string
  /** Tailwind class for the badge text/border tint. */
  toneClass: string
}

export const LEAD_STATUS_META: Record<LeadStatus, LeadStatusMeta> = {
  enrolled: { label: 'Enrolled', dotClass: 'bg-green-500', toneClass: 'text-green-700 dark:text-green-400 border-green-500/30' },
  eligible: { label: 'Eligible', dotClass: 'bg-muted-foreground', toneClass: 'text-muted-foreground border-border' },
  removed: { label: 'Removed', dotClass: 'bg-amber-500', toneClass: 'text-amber-700 dark:text-amber-400 border-amber-500/30' },
  dnc: { label: 'DNC', dotClass: 'bg-red-500', toneClass: 'text-red-700 dark:text-red-400 border-red-500/30' },
}

export const LEAD_STATUS_OPTIONS: { label: string, value: LeadStatus }[] = [
  { label: 'Eligible', value: 'eligible' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Removed', value: 'removed' },
  { label: 'DNC', value: 'dnc' },
]
```

- [ ] **Step 2: Location formatter** (honors optional address; city+zip always present)

`lib/format-lead-location.ts`:

```ts
interface LeadLocationParts {
  address?: string | null
  city: string
  state?: string | null
  zip: string
}

export interface FormattedLeadLocation {
  /** Street address line — null when the lead has no street address. */
  street: string | null
  /** Always present: "City, ST 92805". */
  cityLine: string
}

export function formatLeadLocation(parts: LeadLocationParts): FormattedLeadLocation {
  const street = parts.address?.trim() ? parts.address.trim() : null
  const state = parts.state?.trim() ? `, ${parts.state.trim()}` : ''
  const cityLine = `${parts.city}${state} ${parts.zip}`.trim()
  return { street, cityLine }
}
```

- [ ] **Step 3:** `pnpm tsc` → clean. `pnpm lint` → clean.
- [ ] **Step 4: Commit** — `feat(campaigns): add lead-status presentation map + location formatter`

---

## Task 2: Extend the mutations hook

**Files:**
- Modify: `src/features/campaigns-admin/hooks/use-campaign-mutations.ts`

The hook already wraps `resync`, `bindCampaignToSource`, `setDefaultCampaign`, `enrollAll`, `unenrollAll`, `disqualify`, `disqualifyBulk`, `removeFromCampaign`, `enroll`. Add five more, each invalidating via `invalidateVoipCampaigns()` + a `sonner` toast, following the existing pattern exactly. Bulk ops surface "X of Y" so partial failures are visible (the 3 minor follow-ups).

- [ ] **Step 1: Add the five mutations** (insert before the `return`, keep alphabetical-ish grouping consistent with the file):

```ts
  const enrollSelected = useMutation(
    trpc.voipCampaignsRouter.enrollSelected.mutationOptions({
      onSuccess: (res) => {
        invalidateVoipCampaigns()
        toast.success(`Enrolled ${res.enrolled} of ${res.requested} lead(s)`, {
          description: res.enrolled < res.requested
            ? 'Some were skipped — check eligibility (already enrolled / DNC / no phone).'
            : undefined,
        })
      },
      onError: err => toast.error(err.message || 'Failed to enroll selected leads'),
    }),
  )

  const removeBulk = useMutation(
    trpc.voipCampaignsRouter.removeBulk.mutationOptions({
      onSuccess: (res) => {
        invalidateVoipCampaigns()
        toast.success(`Removed ${res.removed} of ${res.requested} lead(s) — re-enrollable`)
      },
      onError: err => toast.error(err.message || 'Failed to remove leads'),
    }),
  )

  const switchCampaign = useMutation(
    trpc.voipCampaignsRouter.switchCampaign.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Lead moved to the new campaign')
      },
      onError: err => toast.error(err.message || 'Failed to switch campaign'),
    }),
  )

  const markDnc = useMutation(
    trpc.voipCampaignsRouter.markDnc.mutationOptions({
      onSuccess: (res) => {
        invalidateVoipCampaigns()
        toast.success(`Marked ${res.count} lead(s) Do-Not-Call — unenrolled`)
      },
      onError: err => toast.error(err.message || 'Failed to mark DNC'),
    }),
  )

  const removeDnc = useMutation(
    trpc.voipCampaignsRouter.removeDnc.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('DNC cleared — lead can be contacted again')
      },
      onError: err => toast.error(err.message || 'Failed to clear DNC'),
    }),
  )
```

- [ ] **Step 2: Extend the returned object** with `enrollSelected, removeBulk, switchCampaign, markDnc, removeDnc`.
- [ ] **Step 3:** `pnpm tsc` + `pnpm lint` clean. **Step 4: Commit** — `feat(campaigns): extend mutations hook with bulk enroll/remove, switch, DNC`

---

## Task 3: Relocate Setup components + new attributes readout + Setup view

**Files:**
- Move: `ui/components/cloudtalk-sync-card.tsx` → `ui/components/setup/cloudtalk-sync-card.tsx`
- Move: `ui/components/campaign-binding-row.tsx` → `ui/components/setup/campaign-binding-row.tsx`
- Create: `ui/components/setup/contact-attributes-readout.tsx`
- Create: `ui/views/campaigns-setup-view.tsx`

- [ ] **Step 1: Move the two files** into `setup/`. Use `git mv` so history is preserved:
```bash
git mv src/features/campaigns-admin/ui/components/cloudtalk-sync-card.tsx src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx
git mv src/features/campaigns-admin/ui/components/campaign-binding-row.tsx src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx
```
Then update any import of these two paths (e.g. in `cloudtalk-sync-card.tsx` it imports `campaign-binding-row` — fix the relative path; and grep the repo for other importers).
```bash
grep -rn "campaigns-admin/ui/components/cloudtalk-sync-card\|campaigns-admin/ui/components/campaign-binding-row" src
```

- [ ] **Step 2: Contact-attributes readout** — renders the synced CT attribute→app-key bridge (`listAttributes`) so merge-field wiring is verifiable. Read the existing `listAttributes` row shape first (`src/shared/entities/voip-contact-attributes/dal/server/queries.ts`) and type the rows from the tRPC output. Component:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

import { Card } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

export function ContactAttributesReadout() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.voipCampaignsRouter.listAttributes.queryOptions())
  const attributes = data ?? []

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">Contact attributes</h3>
        <p className="text-xs text-muted-foreground">
          CloudTalk merge-field bridge — verify lead_source / primary_trade / trades_interested are wired.
        </p>
      </div>

      {isLoading
        ? <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        : attributes.length === 0
          ? <p className="text-xs text-muted-foreground">No attributes synced yet. Run a resync above.</p>
          : (
              <ul className="flex flex-col divide-y divide-border/60">
                {attributes.map(attr => (
                  <li key={attr.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{attr.ctAttributeName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{attr.appKey}</span>
                  </li>
                ))}
              </ul>
            )}
    </Card>
  )
}
```
> If the real `listAttributes` field names differ from `id`/`ctAttributeName`/`appKey`, use the actual names from the query file — do not invent fields.

- [ ] **Step 3: Setup view** — composes the three pieces, scrollable column:

```tsx
'use client'

import { CampaignBindingRow } from '@/features/campaigns-admin/ui/components/setup/campaign-binding-row'
import { CloudtalkSyncCard } from '@/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card'
import { ContactAttributesReadout } from '@/features/campaigns-admin/ui/components/setup/contact-attributes-readout'

export function CampaignsSetupView() {
  return (
    <div className="flex max-w-3xl flex-col gap-4 overflow-y-auto">
      <CloudtalkSyncCard />
      <ContactAttributesReadout />
    </div>
  )
}
```
> `CloudtalkSyncCard` already renders the campaign→source binding table internally via `CampaignBindingRow`. If it does NOT (verify by reading it), render the binding table here instead and drop the unused `CampaignBindingRow` import. Keep exactly one home for the binding table.

- [ ] **Step 4:** `pnpm tsc` + `pnpm lint` clean. **Step 5: Commit** — `feat(campaigns): relocate setup components + add contact-attributes readout + setup view`

---

## Task 4: Overview tab

**Files:**
- Create: `ui/components/overview/enroll-all-popover.tsx`
- Create: `ui/components/overview/overview-totals-strip.tsx`
- Create: `ui/components/overview/source-rollup-card.tsx`
- Create: `ui/views/campaigns-overview-view.tsx`

The `getSourceCampaignSummaries` row type (infer from tRPC output): `{ sourceSlug, name, isActive, defaultCampaignId, dncCount, eligibleCount, enrolledCount, needsBinding }`.

- [ ] **Step 1: Enroll-all popover** — campaign picker + "Enroll all eligible" for one source. Shared with the Leads filter bar. Loads `listCampaigns` for options; on confirm calls `enrollAll`.

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface EnrollAllPopoverProps {
  sourceSlug: string
  eligibleCount: number
  defaultCampaignId: string | null
}

export function EnrollAllPopover({ sourceSlug, eligibleCount, defaultCampaignId }: EnrollAllPopoverProps) {
  const trpc = useTRPC()
  const { enrollAll } = useCampaignMutations()
  const [open, setOpen] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(defaultCampaignId)

  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = data ?? []

  const disabled = eligibleCount === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className="w-full" disabled={disabled} size="sm">
          {`Enroll all eligible (${eligibleCount})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3">
        <p className="text-sm font-medium">Pick a campaign</p>
        <Select value={campaignId ?? undefined} onValueChange={setCampaignId}>
          <SelectTrigger><SelectValue placeholder="Select campaign…" /></SelectTrigger>
          <SelectContent>
            {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.ctCampaignName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          disabled={!campaignId || enrollAll.isPending}
          onClick={() => {
            if (!campaignId) {
              return
            }
            enrollAll.mutate({ sourceSlug, campaignId })
            setOpen(false)
          }}
          size="sm"
        >
          {enrollAll.isPending ? 'Queuing…' : 'Enroll all'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
```
> Verify the campaign label field is `ctCampaignName` and id is `id` from `listCampaigns` output; adjust if different.

- [ ] **Step 2: Totals strip** — DB-count aggregate across all sources, `tabular-nums`, fast. Takes the summaries array as a prop (parent already loads it).

```tsx
'use client'

interface OverviewTotalsStripProps {
  enrolled: number
  eligible: number
  dnc: number
}

export function OverviewTotalsStrip({ enrolled, eligible, dnc }: OverviewTotalsStripProps) {
  const stats = [
    { label: 'Enrolled', value: enrolled, tone: 'text-green-600 dark:text-green-400' },
    { label: 'Eligible', value: eligible, tone: 'text-foreground' },
    { label: 'DNC', value: dnc, tone: 'text-red-600 dark:text-red-400' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(s => (
        <div key={s.label} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</span>
          <span className={`text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Source rollup card** — per-source stats + enroll-all + binding-health warning. Takes one summary row.

```tsx
'use client'

import { AlertTriangleIcon } from 'lucide-react'

import { EnrollAllPopover } from '@/features/campaigns-admin/ui/components/overview/enroll-all-popover'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'

interface SourceSummary {
  sourceSlug: string
  name: string
  isActive: boolean
  defaultCampaignId: string | null
  dncCount: number
  eligibleCount: number
  enrolledCount: number
  needsBinding: boolean
}

export function SourceRollupCard({ summary }: { summary: SourceSummary }) {
  const stats = [
    { label: 'Enrolled', value: summary.enrolledCount },
    { label: 'Eligible', value: summary.eligibleCount },
    { label: 'DNC', value: summary.dncCount },
  ]
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{summary.name}</span>
          <span className="text-xs text-muted-foreground">{summary.sourceSlug}</span>
        </div>
        {summary.defaultCampaignId
          ? <Badge variant="secondary">Bound</Badge>
          : <Badge variant="outline">No default</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {summary.needsBinding && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangleIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>Has eligible leads but no bound campaign. Set a default in Setup.</span>
        </div>
      )}

      <EnrollAllPopover
        defaultCampaignId={summary.defaultCampaignId}
        eligibleCount={summary.eligibleCount}
        sourceSlug={summary.sourceSlug}
      />
    </Card>
  )
}
```

- [ ] **Step 4: Overview view** — loads summaries once, sums totals, renders strip + responsive card grid + loading/empty states.

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

import { OverviewTotalsStrip } from '@/features/campaigns-admin/ui/components/overview/overview-totals-strip'
import { SourceRollupCard } from '@/features/campaigns-admin/ui/components/overview/source-rollup-card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

export function CampaignsOverviewView() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
  const summaries = data ?? []

  const totals = summaries.reduce(
    (acc, s) => ({
      enrolled: acc.enrolled + s.enrolledCount,
      eligible: acc.eligible + s.eligibleCount,
      dnc: acc.dnc + s.dncCount,
    }),
    { enrolled: 0, eligible: 0, dnc: 0 },
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 overflow-y-auto">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <OverviewTotalsStrip dnc={totals.dnc} eligible={totals.eligible} enrolled={totals.enrolled} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map(s => <SourceRollupCard key={s.sourceSlug} summary={s} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 5:** `pnpm tsc` + `pnpm lint` clean. **Step 6: Commit** — `feat(campaigns): build Overview tab — totals strip, source rollup cards, enroll-all`

---

## Task 5: Leads — status badge, filter config builder, columns, selection cells

**Files:**
- Create: `ui/components/leads/lead-status-badge.tsx`
- Create: `lib/build-leads-filter-config.ts`
- Create: `ui/components/leads/lead-select-header.tsx`
- Create: `ui/components/leads/lead-select-cell.tsx`
- Create: `ui/components/leads/lead-row-actions.tsx`
- Create: `ui/lib/leads-columns.tsx`

This task builds the table's parts. The view that wires them is Task 6.

**Selection model:** the Leads view holds `selectedIds: Set<string>` + handlers, passed to the table via `meta`. Define the meta shape once here and reuse it:

```ts
// (declared in ui/lib/leads-columns.tsx, exported for the view + cells)
export interface LeadsTableMeta {
  selectedIds: Set<string>
  toggleSelect: (customerId: string) => void
  toggleSelectAll: (rowIds: string[], checked: boolean) => void
  pageRowIds: string[]
  onEnroll: (customerId: string) => void
  onOpenDrawer: (row: CampaignLeadRow) => void
  onOpenProfile: (customerId: string) => void
}
```

- [ ] **Step 1: Status badge** (dot + label; never color-alone):

```tsx
'use client'

import type { LeadStatus } from '@/features/campaigns-admin/constants/lead-status'

import { LEAD_STATUS_META } from '@/features/campaigns-admin/constants/lead-status'

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const meta = LEAD_STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.toneClass}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  )
}
```

- [ ] **Step 2: Filter config builder** — builds query-toolkit `select` filter definitions at runtime. Status is static; source + campaign options come from loaded data. Mirror the `FilterDefinition` shape from `customer-filter-config.ts`.

```ts
import type { FilterDefinition } from '@/shared/dal/client/lib/types'

import { LEAD_STATUS_OPTIONS } from '@/features/campaigns-admin/constants/lead-status'

interface BuildArgs {
  sources: { label: string, value: string }[]   // value = sourceSlug
  campaigns: { label: string, value: string }[]  // value = campaignId
}

export function buildLeadsFilterConfig({ sources, campaigns }: BuildArgs): FilterDefinition[] {
  return [
    { id: 'status', type: 'select', label: 'Status', options: LEAD_STATUS_OPTIONS },
    { id: 'sourceSlug', type: 'select', label: 'Source', options: sources },
    { id: 'campaignId', type: 'select', label: 'Campaign', options: campaigns },
  ]
}
```
> Read `src/shared/dal/client/lib/types.ts` to confirm the `FilterDefinition` `select` shape (id/type/label/options). If `select` requires extra keys, add them. Do NOT use reserved ids `p/q/sort/dir/ps`.

- [ ] **Step 3: Select header + cell** — checkboxes wired to `meta`:

```tsx
// lead-select-header.tsx
'use client'

import type { Table } from '@tanstack/react-table'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import type { LeadsTableMeta } from '@/features/campaigns-admin/ui/lib/leads-columns'

import { Checkbox } from '@/shared/components/ui/checkbox'

export function LeadSelectHeader({ table }: { table: Table<CampaignLeadRow> }) {
  const meta = table.options.meta as LeadsTableMeta
  const ids = meta.pageRowIds
  const allSelected = ids.length > 0 && ids.every(id => meta.selectedIds.has(id))
  return (
    <Checkbox
      aria-label="Select all on this page"
      checked={allSelected}
      onCheckedChange={checked => meta.toggleSelectAll(ids, checked === true)}
    />
  )
}
```
```tsx
// lead-select-cell.tsx
'use client'

import type { Table } from '@tanstack/react-table'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import type { LeadsTableMeta } from '@/features/campaigns-admin/ui/lib/leads-columns'

import { Checkbox } from '@/shared/components/ui/checkbox'

export function LeadSelectCell({ row, table }: { row: CampaignLeadRow, table: Table<CampaignLeadRow> }) {
  const meta = table.options.meta as LeadsTableMeta
  return (
    <Checkbox
      aria-label={`Select ${row.name}`}
      checked={meta.selectedIds.has(row.customerId)}
      onCheckedChange={() => meta.toggleSelect(row.customerId)}
      onClick={e => e.stopPropagation()}
    />
  )
}
```
> Type-only import of `CampaignLeadRow` from the DAL server file is erased at compile time (`import type`) — safe across the client boundary. If the lint boundary rule flags it, instead derive the row type from `inferRouterOutputs` of `voipCampaignsRouter.listLeads`.

- [ ] **Step 4: Row actions** — status-contextual per-row menu (enroll/open/remove/DNC). Keep it lean; the drawer holds the full action set.

```tsx
'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { MoreHorizontalIcon } from 'lucide-react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'

interface LeadRowActionsProps {
  row: CampaignLeadRow
  onEnroll: (customerId: string) => void
  onOpenProfile: (customerId: string) => void
}

export function LeadRowActions({ row, onEnroll, onOpenProfile }: LeadRowActionsProps) {
  const { removeFromCampaign, markDnc, removeDnc } = useCampaignMutations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Lead actions" size="icon" variant="ghost" onClick={e => e.stopPropagation()}>
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onOpenProfile(row.customerId)}>Open full profile</DropdownMenuItem>
        {row.status === 'eligible' && <DropdownMenuItem onSelect={() => onEnroll(row.customerId)}>Enroll</DropdownMenuItem>}
        {row.status === 'enrolled' && <DropdownMenuItem onSelect={() => removeFromCampaign.mutate({ customerId: row.customerId })}>Remove</DropdownMenuItem>}
        {row.status !== 'dnc' && <DropdownMenuItem className="text-red-600" onSelect={() => markDnc.mutate({ customerIds: [row.customerId] })}>Mark DNC</DropdownMenuItem>}
        {row.status === 'dnc' && <DropdownMenuItem onSelect={() => removeDnc.mutate({ customerId: row.customerId })}>Clear DNC</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```
> Confirm `dropdown-menu.tsx` exists in `src/shared/components/ui/` (used widely in the repo — almost certainly present; if absent, use `Popover` with buttons instead).

- [ ] **Step 5: Columns builder** — `ui/lib/leads-columns.tsx`. Returns `ColumnDef<CampaignLeadRow>[]`. Defines `LeadsTableMeta` (exported). Name cell deep-links to profile; eligible rows show an inline Enroll button; enrolled show campaign + enrolled date.

```tsx
import type { ColumnDef } from '@tanstack/react-table'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { LeadRowActions } from '@/features/campaigns-admin/ui/components/leads/lead-row-actions'
import { LeadSelectCell } from '@/features/campaigns-admin/ui/components/leads/lead-select-cell'
import { LeadSelectHeader } from '@/features/campaigns-admin/ui/components/leads/lead-select-header'
import { LeadStatusBadge } from '@/features/campaigns-admin/ui/components/leads/lead-status-badge'
import { Button } from '@/shared/components/ui/button'

export interface LeadsTableMeta {
  selectedIds: Set<string>
  toggleSelect: (customerId: string) => void
  toggleSelectAll: (rowIds: string[], checked: boolean) => void
  pageRowIds: string[]
  onEnroll: (customerId: string) => void
  onOpenProfile: (customerId: string) => void
}

function formatEnrolledAt(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function buildLeadsColumns(): ColumnDef<CampaignLeadRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => <LeadSelectHeader table={table} />,
      cell: ({ row, table }) => <LeadSelectCell row={row.original} table={table} />,
      enableSorting: false,
      size: 36,
    },
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row, table }) => {
        const meta = table.options.meta as LeadsTableMeta
        return (
          <button
            className="text-left font-medium text-foreground underline-offset-2 hover:underline"
            onClick={(e) => { e.stopPropagation(); meta.onOpenProfile(row.original.customerId) }}
            type="button"
          >
            {row.original.name}
          </button>
        )
      },
    },
    {
      id: 'campaign',
      header: 'Campaign',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.campaignName ?? '—'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
    },
    {
      id: 'enrolledAt',
      header: 'Enrolled',
      cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{formatEnrolledAt(row.original.enrolledAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row, table }) => {
        const meta = table.options.meta as LeadsTableMeta
        if (row.original.status === 'eligible') {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); meta.onEnroll(row.original.customerId) }}
            >
              Enroll
            </Button>
          )
        }
        return <LeadRowActions row={row.original} onEnroll={meta.onEnroll} onOpenProfile={meta.onOpenProfile} />
      },
    },
  ]
}
```
> `getRowId` in the table must be set to `row.customerId` (Task 6) so selection keys match.

- [ ] **Step 6:** `pnpm tsc` + `pnpm lint` clean. **Step 7: Commit** — `feat(campaigns): leads table parts — status badge, filter config, selection cells, columns`

---

## Task 6: Leads view — table + selection + bulk bar + filter bar

**Files:**
- Create: `ui/components/leads/leads-filter-bar.tsx`
- Create: `ui/components/leads/leads-bulk-action-bar.tsx`
- Create: `ui/views/campaigns-leads-view.tsx`

- [ ] **Step 1: Bulk action bar** — motion slide-up, appears on selection. Destructive actions (Disqualify/DNC) in danger color, separated, behind `useConfirm`.

```tsx
'use client'

import { AnimatePresence, motion } from 'motion/react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { useConfirm } from '@/shared/hooks/use-confirm'

interface LeadsBulkActionBarProps {
  selectedIds: string[]
  onClear: () => void
}

export function LeadsBulkActionBar({ selectedIds, onClear }: LeadsBulkActionBarProps) {
  const { removeBulk, disqualifyBulk, markDnc } = useCampaignMutations()
  const [ConfirmDialog, confirm] = useConfirm({
    title: 'Apply to selected leads?',
    message: 'This affects every selected lead and stops/curates their CloudTalk calls.',
  })

  const count = selectedIds.length
  const settle = () => onClear()

  return (
    <>
      <ConfirmDialog />
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            animate={{ y: 0, opacity: 1 }}
            className="absolute inset-x-0 bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-lg"
            exit={{ y: 16, opacity: 0 }}
            initial={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <span className="text-sm font-medium tabular-nums">{count} selected</span>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button size="sm" variant="outline" onClick={() => { removeBulk.mutate({ customerIds: selectedIds }, { onSuccess: settle }) }}>Remove</Button>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button
              className="text-amber-700 dark:text-amber-400"
              size="sm"
              variant="ghost"
              onClick={async () => { if (await confirm()) { disqualifyBulk.mutate({ customerIds: selectedIds }, { onSuccess: settle }) } }}
            >
              Disqualify
            </Button>
            <Button
              className="text-red-600"
              size="sm"
              variant="ghost"
              onClick={async () => { if (await confirm()) { markDnc.mutate({ customerIds: selectedIds }, { onSuccess: settle }) } }}
            >
              Mark DNC
            </Button>
            <span className="mx-1 h-4 w-px bg-border" />
            <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
```
> Enroll-selected needs a campaign picker → omit it from the bar's inline buttons and instead reuse `switch-campaign-popover` styled as an "Enroll selected" picker, OR add a small Popover here. Simplest for v1: leave bulk-enroll out of the bar (cherry-pick single-enroll covers it via row buttons) and note it. If the user wants bulk-enroll-with-picker, add a Popover wrapping `enrollSelected.mutate({ customerIds, campaignId })`.

- [ ] **Step 2: Filter bar** — `QueryToolbar` composition (search + filter chips for status/source/campaign) + a global "Enroll all eligible" entry point. Receives the `pagination` object from the view.

```tsx
'use client'

import type { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'

type Pagination = ReturnType<typeof usePaginatedQuery<Record<string, never>, CampaignLeadRow>>

export function LeadsFilterBar({ pagination }: { pagination: Pagination }) {
  return (
    <QueryToolbar entityName="leads" pagination={pagination}>
      <QueryToolbar.Bar>
        <QueryToolbar.Search placeholder="Search name or phone…" />
        <QueryToolbar.FilterTrigger />
        <QueryToolbar.PageSize />
      </QueryToolbar.Bar>
      <QueryToolbar.ChipRail />
      <QueryToolbar.LiveStatus />
    </QueryToolbar>
  )
}
```
> Confirm the `QueryToolbar` generic/prop usage against the reference impl (`lead-source-customers-section.tsx`). If passing `pagination` typing is awkward, inline the `<QueryToolbar>` directly in the view instead of a wrapper component — acceptable, but keep one component per file.

- [ ] **Step 3: Leads view** — the orchestrator. Loads filter options, builds filter config, runs `usePaginatedQuery`, holds selection state + drawer state, wires `meta`, renders toolbar + DataTable + bulk bar + drawer.

```tsx
'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import type { LeadsTableMeta } from '@/features/campaigns-admin/ui/lib/leads-columns'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { buildLeadsFilterConfig } from '@/features/campaigns-admin/lib/build-leads-filter-config'
import { LeadDrawer } from '@/features/campaigns-admin/ui/components/leads/lead-drawer'
import { LeadsBulkActionBar } from '@/features/campaigns-admin/ui/components/leads/leads-bulk-action-bar'
import { LeadsFilterBar } from '@/features/campaigns-admin/ui/components/leads/leads-filter-bar'
import { buildLeadsColumns } from '@/features/campaigns-admin/ui/lib/leads-columns'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

export function CampaignsLeadsView() {
  const trpc = useTRPC()
  const { enroll } = useCampaignMutations()
  const { setModal, open: openModal } = useModalStore()

  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())

  const filterConfig = useMemo(
    () => buildLeadsFilterConfig({
      sources: (summariesQuery.data ?? []).map(s => ({ label: s.name, value: s.sourceSlug })),
      campaigns: (campaignsQuery.data ?? []).map(c => ({ label: c.ctCampaignName, value: c.id })),
    }),
    [summariesQuery.data, campaignsQuery.data],
  )

  const pagination = usePaginatedQuery<Record<string, never>, CampaignLeadRow>(
    trpc.voipCampaignsRouter.listLeads.queryOptions,
    {},
    { pageSize: 25, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS, filters: filterConfig },
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerRow, setDrawerRow] = useState<CampaignLeadRow | null>(null)

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((rowIds: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      rowIds.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }, [])

  const handleOpenProfile = useCallback((customerId: string) => {
    setModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
    openModal()
  }, [setModal, openModal])

  const pageRowIds = useMemo(() => pagination.rows.map(r => r.customerId), [pagination.rows])
  const columns = useMemo(() => buildLeadsColumns(), [])

  const meta = useMemo<LeadsTableMeta>(() => ({
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    pageRowIds,
    onEnroll: (customerId: string) => enroll.mutate({ customerId }),
    onOpenProfile: handleOpenProfile,
  }), [selectedIds, toggleSelect, toggleSelectAll, pageRowIds, enroll, handleOpenProfile])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3">
      <LeadsFilterBar pagination={pagination} />

      <div className="min-h-0 flex-1">
        <DataTable
          columns={columns}
          data={pagination.rows}
          entityName="lead"
          getRowId={row => row.customerId}
          meta={meta}
          onRowClick={row => setDrawerRow(row)}
          serverPagination={toDataTablePagination(pagination)}
          tableId="campaign-leads"
        />
      </div>

      <LeadsBulkActionBar onClear={() => setSelectedIds(new Set())} selectedIds={[...selectedIds]} />

      <LeadDrawer
        onOpenChange={(open) => { if (!open) { setDrawerRow(null) } }}
        onOpenProfile={handleOpenProfile}
        row={drawerRow}
      />
    </div>
  )
}
```
> Verify `DataTable` accepts `getRowId` — the survey showed `data/columns/meta/tableId/entityName/onRowClick/serverPagination/serverSorting/columnVisibility`. If `getRowId` is NOT a prop, selection still works (meta uses `row.customerId` directly), so drop the prop. Confirm against `data-table/types.ts`.
> `summariesQuery`/`campaignsQuery` are also consumed by Overview — that's fine, TanStack dedupes by key.

- [ ] **Step 4:** `pnpm tsc` + `pnpm lint` clean. **Step 5: Commit** — `feat(campaigns): Leads tab — paginated table, multi-select, bulk bar, filters`

---

## Task 7: Lead drawer (DB-first)

**Files:**
- Create: `ui/components/leads/switch-campaign-popover.tsx`
- Create: `ui/components/leads/lead-drawer-identity.tsx`
- Create: `ui/components/leads/lead-drawer-actions.tsx`
- Create: `ui/components/leads/lead-drawer.tsx`

The drawer is DB-first: header + identity (fetched on open) + actions. **No live CloudTalk block** — that's Phase 2. Leave a clearly-marked comment where it will mount.

- [ ] **Step 1: Switch-campaign popover** — campaign picker → `switchCampaign`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface SwitchCampaignPopoverProps {
  customerId: string
  currentCampaignId: string | null
}

export function SwitchCampaignPopover({ customerId, currentCampaignId }: SwitchCampaignPopoverProps) {
  const trpc = useTRPC()
  const { switchCampaign } = useCampaignMutations()
  const [open, setOpen] = useState(false)
  const [toCampaignId, setToCampaignId] = useState<string | null>(null)
  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = (data ?? []).filter(c => c.id !== currentCampaignId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button size="sm" variant="outline">Switch campaign</Button></PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <Select value={toCampaignId ?? undefined} onValueChange={setToCampaignId}>
          <SelectTrigger><SelectValue placeholder="Move to…" /></SelectTrigger>
          <SelectContent>
            {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.ctCampaignName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          disabled={!toCampaignId || switchCampaign.isPending}
          onClick={() => { if (toCampaignId) { switchCampaign.mutate({ customerId, toCampaignId }, { onSuccess: () => setOpen(false) }) } }}
          size="sm"
        >
          {switchCampaign.isPending ? 'Moving…' : 'Move'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Identity block** — fetches the full customer on open; renders phone + address (optional) + city/zip + lead source + interested trades + enrolled campaign/date. Skeleton while loading.

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { formatLeadLocation } from '@/features/campaigns-admin/lib/format-lead-location'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

export function LeadDrawerIdentity({ row }: { row: CampaignLeadRow }) {
  const trpc = useTRPC()
  const { data: customer, isLoading } = useQuery(trpc.customersRouter.crud.getById.queryOptions({ id: row.customerId }))

  if (isLoading || !customer) {
    return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
  }

  const location = formatLeadLocation({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })
  const trades = customer.leadMetaJSON?.interestedTradesRaw ?? []

  const rows: { label: string, value: string }[] = [
    { label: 'Phone', value: customer.phone ?? '—' },
    { label: 'Location', value: location.street ? `${location.street} · ${location.cityLine}` : location.cityLine },
    { label: 'Campaign', value: row.campaignName ?? '—' },
  ]

  return (
    <dl className="flex flex-col gap-2 text-sm">
      {rows.map(r => (
        <div key={r.label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-right font-medium text-foreground">{r.value}</dd>
        </div>
      ))}
      {trades.length > 0 && (
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Trades</dt>
          <dd className="text-right font-medium text-foreground">{trades.join(', ')}</dd>
        </div>
      )}
    </dl>
  )
}
```
> Verify `customersRouter.crud.getById` output field names (`phone`, `address`, `city`, `state`, `zip`, `leadMetaJSON.interestedTradesRaw`) against the customer schema/spec. The survey confirmed `address`/`city`/`state`/`zip` on the table and `interestedTradesRaw` in `leadMetaJSON`. Adjust the access path if the inferred type nests differently.

- [ ] **Step 3: Drawer actions** — status-contextual:

```tsx
'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { SwitchCampaignPopover } from '@/features/campaigns-admin/ui/components/leads/switch-campaign-popover'
import { Button } from '@/shared/components/ui/button'
import { useConfirm } from '@/shared/hooks/use-confirm'

export function LeadDrawerActions({ row }: { row: CampaignLeadRow }) {
  const { enroll, removeFromCampaign, disqualify, markDnc, removeDnc } = useCampaignMutations()
  const [ConfirmDialog, confirm] = useConfirm({ title: 'Confirm', message: 'Apply this action to the lead?' })
  const id = row.customerId

  return (
    <>
      <ConfirmDialog />
      <div className="flex flex-wrap gap-2">
        {row.status === 'eligible' && <Button size="sm" onClick={() => enroll.mutate({ customerId: id })}>Enroll</Button>}
        {row.status === 'removed' && <Button size="sm" onClick={() => enroll.mutate({ customerId: id })}>Re-enroll</Button>}
        {row.status === 'enrolled' && <SwitchCampaignPopover currentCampaignId={row.campaignId} customerId={id} />}
        {row.status === 'enrolled' && <Button size="sm" variant="outline" onClick={() => removeFromCampaign.mutate({ customerId: id })}>Remove</Button>}
        {row.status !== 'dnc' && <Button className="text-amber-700 dark:text-amber-400" size="sm" variant="ghost" onClick={async () => { if (await confirm()) { disqualify.mutate({ customerId: id }) } }}>Disqualify</Button>}
        {row.status !== 'dnc'
          ? <Button className="text-red-600" size="sm" variant="ghost" onClick={async () => { if (await confirm()) { markDnc.mutate({ customerIds: [id] }) } }}>Mark DNC</Button>
          : <Button size="sm" variant="outline" onClick={() => removeDnc.mutate({ customerId: id })}>Clear DNC</Button>}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Drawer shell** — `Sheet` from right; header (name + status badge + open-profile) + identity + actions; Phase-2 mount point commented.

```tsx
'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { LeadDrawerActions } from '@/features/campaigns-admin/ui/components/leads/lead-drawer-actions'
import { LeadDrawerIdentity } from '@/features/campaigns-admin/ui/components/leads/lead-drawer-identity'
import { LeadStatusBadge } from '@/features/campaigns-admin/ui/components/leads/lead-status-badge'
import { Button } from '@/shared/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'

interface LeadDrawerProps {
  row: CampaignLeadRow | null
  onOpenChange: (open: boolean) => void
  onOpenProfile: (customerId: string) => void
}

export function LeadDrawer({ row, onOpenChange, onOpenProfile }: LeadDrawerProps) {
  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-5 sm:max-w-md" side="right">
        {row && (
          <>
            <SheetHeader className="gap-2">
              <div className="flex items-center gap-2">
                <SheetTitle>{row.name}</SheetTitle>
                <LeadStatusBadge status={row.status} />
              </div>
              <Button className="w-fit px-0" onClick={() => onOpenProfile(row.customerId)} size="sm" variant="link">
                Open full profile ↗
              </Button>
            </SheetHeader>

            <LeadDrawerIdentity row={row} />

            {/*
              PHASE 2 (deferred): live CloudTalk activity block mounts here —
              <LeadDrawerCtActivity ctContactId={...} /> with its own
              loading/data/error states. Do NOT build until getLeadCtActivity ships.
            */}

            <div className="mt-auto border-t border-border pt-4">
              <LeadDrawerActions row={row} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5:** `pnpm tsc` + `pnpm lint` clean. **Step 6: Commit** — `feat(campaigns): DB-first lead drawer — identity, actions, switch campaign`

---

## Task 8: Tab shell + retire old scaffold

**Files:**
- Rewrite: `ui/views/campaigns-view.tsx`
- Delete: `ui/components/source-enrollment-panel.tsx`, `ui/components/campaign-source-list.tsx`, `ui/components/enrolled-leads-list.tsx`, `ui/components/enrolled-lead-row.tsx`

- [ ] **Step 1: Tab shell** — `nuqs` `tab` param (default `overview`), shadcn underline `Tabs`, renders the active view. Keeps the page header.

```tsx
'use client'

import { parseAsStringLiteral, useQueryState } from 'nuqs'

import { CampaignsLeadsView } from '@/features/campaigns-admin/ui/views/campaigns-leads-view'
import { CampaignsOverviewView } from '@/features/campaigns-admin/ui/views/campaigns-overview-view'
import { CampaignsSetupView } from '@/features/campaigns-admin/ui/views/campaigns-setup-view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

const TABS = ['overview', 'leads', 'setup'] as const

export function CampaignsView() {
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('overview'))

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
        <p className="text-xs text-muted-foreground">
          CloudTalk lead-conversion campaigns — enroll, curate, and inspect leads.
        </p>
      </header>

      <Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={v => setTab(v as typeof TABS[number])} value={tab}>
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
> Use the project's underline-tab styling if `TabsList`/`TabsTrigger` default to boxed — check an existing tabs usage in the repo and match it.

- [ ] **Step 2: Delete the four retired files.** Confirm nothing imports them:
```bash
grep -rn "source-enrollment-panel\|campaign-source-list\|enrolled-leads-list\|enrolled-lead-row" src
git rm src/features/campaigns-admin/ui/components/source-enrollment-panel.tsx \
       src/features/campaigns-admin/ui/components/campaign-source-list.tsx \
       src/features/campaigns-admin/ui/components/enrolled-leads-list.tsx \
       src/features/campaigns-admin/ui/components/enrolled-lead-row.tsx
```
> If any of the deleted files held logic not yet reproduced (e.g. a label helper), salvage it into the appropriate `lib/` before deleting.

- [ ] **Step 3:** `pnpm tsc` + `pnpm lint` clean. **Step 4: Commit** — `feat(campaigns): three-tab shell + retire ring-1 master-detail scaffold`

---

## Task 9: Final pass

- [ ] **Step 1: Full-feature review** — dispatch the final code reviewer over the whole `src/features/campaigns-admin/` diff (per subagent-driven-development): one-component-per-file, named exports, no file-level consts/helpers in components, sorted imports, no barrels, a11y (44px targets, `aria-label`s on icon buttons, focus order), status-color-not-alone, `tabular-nums` on counts.
- [ ] **Step 2: Manual smoke** (dev server on port 3002 if needed): `/dashboard/campaigns` loads → Overview totals + cards render → Leads table paginates, filters by status/source/campaign, search works → row select + bulk bar appears → drawer opens, identity hydrates (address shows when present, city+zip always) → Setup resync + binding + attributes render → tab state survives reload (URL `?tab=`).
- [ ] **Step 3:** Final `pnpm tsc` + `pnpm lint` clean.

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| IA: 3 tabs, `nuqs` tab | 8 |
| Overview totals strip + rollup cards + enroll-all + binding-health | 4 |
| Leads: toolkit table + filters + search | 5, 6 |
| Cherry-pick (row Enroll) + bulk (bar) | 5, 6 |
| DNC first-class (filter + row + bulk + drawer) | 5, 6, 7 |
| Drawer DB-first (header + identity + actions) | 7 |
| Switch campaign | 7 |
| Deep-link to profile (modal) | 6, 7 |
| Status colors (dot + label) | 1, 5 |
| Setup: resync + binding + attributes readout | 3 |
| Mutations (enrollSelected/removeBulk/markDnc/removeDnc/switchCampaign) | 2 |
| Live CT block + per-row signal cell | **DEFERRED — Phase 2, not in this plan** |

## Deferred (do NOT build here)
- `lead-live-signal-cell.tsx`, `lead-drawer-ct-activity.tsx`, `lib/format-ct-signal.ts`, `getLeadCtActivity` consumption — all gated on backend Phase 2 (CloudTalk `/calls?contact_id` verification). The drawer leaves a marked mount point.
