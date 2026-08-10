# Dashboard Proposals — Two Truthful Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Supersedes** `docs/superpowers/plans/2026-08-06-agent-dashboard-data-correctness.md`
(Plan 2 — its "union" premise was wrong; see the spec). Design spec:
`docs/superpowers/specs/2026-08-08-dashboard-proposals-sections-design.md`.

**Goal:** Replace the single "Awaiting signature" list with one **Proposals**
module of two accurately-labeled, non-overlapping sections — **Out for signature**
(contract envelope out) and **Sent — awaiting response** (proposal sent, no
contract) — each section header naming the state so no per-row status badge lies.

**Architecture:** One new entity-DAL list filter (`sentNoContract`) beside the
existing (unchanged) `awaitingSignature`; two shared query-input builders capped
per-section; a reusable `DashboardProposalSection` (label + count + list + empty
state) rendered twice inside a rewritten `DashboardProposals` module; the proposal
card drops its status badge/icon and takes a section-correct `timeSince`.

**Tech Stack:** Drizzle (Postgres/Neon), tRPC, Zod, TanStack Query, Next.js 15
App Router (RSC + `'use client'`), Tailwind v4.

## Global Constraints

- **No test runner exists.** Verify every task with `pnpm tsc` + `pnpm lint` only;
  UI tasks add a live browser smoke. **Never `pnpm build`.**
- **Coding conventions:** one exported component per file; named exports only; no
  file-level constants or helper functions in component files (extract to
  `constants/` or `lib/`); `schemas/` is a sibling of `lib/` — but **list filters
  are the documented exception, co-located in the entity's `queries.ts`**.
- **Reuse mandate:** expand the existing `proposalsRouter.business.list` procedure
  and `listProposals` DAL; add no ad-hoc query, no new API surface (ADR-0002).
- **`awaitingSignature` DAL semantics are UNCHANGED** — only new code is added.
- **No schema migration** (all columns already exist).
- **Hydration parity:** each section's `useQuery` must call the *same* shared
  builder the page prefetches; an inline input object breaks the key match.
- **Proposal/contract independence (ADR-0004):** sections are partitioned by the
  DAL query — do **not** re-encode contract state client-side (the canonical
  `getProposalLockState` owns the `inflight-locked` signal). No per-row state derivation.
- **Ubiquitous language:** "proposal" (never "quote"); "contract envelope"; the
  only user-facing state strings are the two section headers; no "in-flight"/"flight state".
- Worktree `.worktrees/issue-281` on `feat/281`. Do **not** open a PR or push.

---

### Task 1: `sentNoContract` list filter (entity DAL)

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (the
  `proposalListFiltersSchema` around line 77, and the `buildFilterWhere` map's
  `awaitingSignature` entry around line 228)

**Interfaces:**
- Produces: filter key `sentNoContract` on `proposalListFiltersSchema` (so
  `ProposalListInput` gains `filters.sentNoContract?: boolean`) + its predicate.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Add the schema field.** In `proposalListFiltersSchema`, directly
  below the existing `awaitingSignature: z.boolean().optional(),` line, add:

```ts
sentNoContract: z.boolean().optional(),
```

- [ ] **Step 2: Add the predicate.** In the `buildFilterWhere` filter map, directly
  after the `awaitingSignature` entry (the `(v: boolean) => v ? and(isNotNull(...),
  isNull(...), isNull(...)) : undefined` block ending near line 235), add:

```ts
// Proposal sent (status='sent') with no contract envelope yet — the
// `proposal_sent` pipeline stage; user-facing "Sent — awaiting response".
// Distinct from `awaitingSignature` (contract out): the two partition the
// active proposals with no overlap.
sentNoContract: (v: boolean) =>
  v
    ? and(
        eq(proposals.status, 'sent'),
        isNull(proposals.contractSentAt),
      )
    : undefined,
```

`eq`, `and`, and `isNull` are already imported in this file (`eq` is used by the
`customerId` filter; `and`/`isNull` by `awaitingSignature`).

- [ ] **Step 3: Verify.** Run `pnpm tsc` and `pnpm lint`. Both must pass.

- [ ] **Step 4: Commit.**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts
git commit -m "feat(proposals): sentNoContract list filter (status=sent, no contract envelope)"
```

---

### Task 2: Per-section query-input builders + cap

**Files:**
- Modify: `src/features/agent-dashboard/constants/dashboard-queries.ts`
  (`DASHBOARD_LIMITS` at line 26; `awaitingProposalsInput` at lines 47-53)

**Interfaces:**
- Consumes: `sentNoContract` filter key (Task 1).
- Produces: `sentProposalsInput(): ProposalListInput` and a re-capped
  `awaitingProposalsInput()`, plus `DASHBOARD_LIMITS.proposalsPerSection`.

- [ ] **Step 1: Add the per-section cap.** Change the `DASHBOARD_LIMITS` object
  (currently `{ meetings: 8, proposals: 20, projects: 15, actionQueue: 8 }`) to
  include a per-section cap:

```ts
export const DASHBOARD_LIMITS = { meetings: 8, proposals: 20, proposalsPerSection: 5, projects: 15, actionQueue: 8 } as const
```

- [ ] **Step 2: Re-cap `awaitingProposalsInput`.** In its `pagination.limit`, replace
  `DASHBOARD_LIMITS.proposals` with `DASHBOARD_LIMITS.proposalsPerSection`. The rest
  (sort `contractSentAt` desc, `filters: { awaitingSignature: true }`) is unchanged.

- [ ] **Step 3: Add `sentProposalsInput`.** Directly after `awaitingProposalsInput()`, add:

```ts
/** Proposals sent, awaiting the customer's response — `status='sent'` with no contract envelope yet (the `proposal_sent` stage). */
export function sentProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposalsPerSection, offset: 0 },
    sort: { sortBy: 'sentAt', sortDir: 'desc' },
    filters: { sentNoContract: true },
  } satisfies ProposalListInput
}
```

`sentAt` is already a whitelisted sort key in `listProposals`'s `buildOrderBy` map
— no DAL change needed for the sort.

- [ ] **Step 4: Verify.** Run `pnpm tsc` (the `satisfies ProposalListInput` proves
  the filter key + sort key are valid) and `pnpm lint`. Both must pass.

- [ ] **Step 5: Commit.**

```bash
git add src/features/agent-dashboard/constants/dashboard-queries.ts
git commit -m "feat(dashboard): sentProposalsInput builder + per-section proposal cap"
```

---

### Task 3: Section-correct `timeSince` on the card-data mapper

**Files:**
- Modify: `src/features/agent-dashboard/lib/map-proposal-row-to-card-data.ts`

**Interfaces:**
- Produces: `mapProposalRowToCardData(row, timeSince?: 'contractSentAt' | 'sentAt')`
  — new optional second arg, default `'contractSentAt'` (backward-compatible).

- [ ] **Step 1: Parameterize the signature.** Change the function signature to:

```ts
export function mapProposalRowToCardData(
  row: ProposalListRow,
  timeSince: 'contractSentAt' | 'sentAt' = 'contractSentAt',
): ProposalOverviewCardData {
```

- [ ] **Step 2: Choose the timestamp.** Replace the `createdAt:` line and its
  comment with:

```ts
    // The card's "time since" is section-specific: the Out-for-signature roster
    // measures since the *contract envelope* went out (`contractSentAt`), while
    // the Sent — awaiting response roster measures since the *proposal* was sent
    // (`sentAt`). The two lifecycles are independent
    // (see entities/proposals/DOCS.md#proposal-contract-independence).
    createdAt: (timeSince === 'sentAt' ? row.sentAt : row.contractSentAt) ?? row.createdAt,
```

- [ ] **Step 3: Verify.** Run `pnpm tsc` and `pnpm lint`. The existing sole caller
  (`DashboardProposalCard`) still type-checks via the default. Both must pass.

- [ ] **Step 4: Commit.**

```bash
git add src/features/agent-dashboard/lib/map-proposal-row-to-card-data.ts
git commit -m "feat(dashboard): parameterize proposal card-data mapper with section timeSince"
```

---

### Task 4: `DashboardProposalCard` — drop status badge/icon, take `timeSince`

**Files:**
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx`

**Interfaces:**
- Consumes: `mapProposalRowToCardData(row, timeSince)` (Task 3).
- Produces: `DashboardProposalCard` now accepts `timeSince?: 'contractSentAt' | 'sentAt'`.

- [ ] **Step 1: Replace the component.** Overwrite the props interface and component
  body (keep the file's `'use client'`, imports, and doc-comment intent) with:

```tsx
interface DashboardProposalCardProps {
  row: ProposalListRow
  /** Which timestamp the row's "time since" reflects: the contract went out (default) or the proposal was sent. */
  timeSince?: 'contractSentAt' | 'sentAt'
  className?: string
}

export function DashboardProposalCard({ row, timeSince = 'contractSentAt', className }: DashboardProposalCardProps) {
  const proposal = mapProposalRowToCardData(row, timeSince)

  return (
    <ProposalOverviewCard
      proposal={proposal}
      className={cn('rounded-lg border border-border bg-card p-2.5', className)}
    >
      <ProposalOverviewCard.Header className="min-w-0 gap-1.5">
        <ProposalOverviewCard.Label className="min-w-0 flex-1 truncate font-medium" />
        <ProposalOverviewCard.Actions mode="compact" className="shrink-0" />
      </ProposalOverviewCard.Header>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <ProposalOverviewCard.Trade />
        <ProposalOverviewCard.CreatedAt format="relative" />
        <ProposalOverviewCard.Value className="text-sm" />
        <ProposalOverviewCard.ViewCount />
      </div>
    </ProposalOverviewCard>
  )
}
```

This removes the `ProposalOverviewCard.StatusIcon` and `ProposalOverviewCard.StatusBadge`
slots (the section header now names the state). The `ProposalOverviewCard` compound
and its style maps are untouched (used elsewhere). Update the file's doc-comment to
say the row leads with the label and carries no status badge (state lives on the
section header).

- [ ] **Step 2: Verify.** Run `pnpm tsc` and `pnpm lint`. Both must pass.

- [ ] **Step 3: Commit.**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx
git commit -m "feat(dashboard): proposal card drops status badge/icon, takes section timeSince"
```

---

### Task 5: `DashboardProposalSection` component

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx`

**Interfaces:**
- Consumes: `DashboardProposalCard` (Task 4); `ProposalListInput` type (Task 1/2).
- Produces: `DashboardProposalSection({ title, input, timeSince, emptyMessage })`.

- [ ] **Step 1: Create the file.** One exported component + a private skeleton:

```tsx
'use client'

import type { ProposalListInput } from '@/shared/entities/proposals/dal/server/queries'

import { useQuery } from '@tanstack/react-query'

import { DashboardProposalCard } from '@/features/agent-dashboard/ui/components/dashboard-proposal-card'
import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProposalSectionProps {
  /** Space-Mono eyebrow naming the section's single state. */
  title: string
  /** List query input from a shared builder, so the key matches the server prefetch (hydration parity). */
  input: ProposalListInput
  /** Which timestamp each row's "time since" reflects. */
  timeSince: 'contractSentAt' | 'sentAt'
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Proposals module: an eyebrow label +
 * the full-predicate total (a SQL `count()`, independent of the display cap),
 * then a capped `EntityList` of `DashboardProposalCard`s (or its empty state).
 * The section header IS the state — the cards carry no status badge.
 */
export function DashboardProposalSection({ title, input, timeSince, emptyMessage }: DashboardProposalSectionProps) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.proposalsRouter.business.list.queryOptions(input))

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        {data?.total !== undefined && (
          <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">{data.total}</span>
        )}
      </div>
      {isLoading
        ? <DashboardProposalSectionSkeleton />
        : (
            // EntityList renders the list body + empty state only. Its built-in
            // header is bypassed (`hideHeader`) on purpose: it is hardcoded
            // `text-[10px]` sans `Title (n)` (entity-list.tsx:88), which violates
            // the dashboard type floor (no `text-[10px]`) and cannot express the
            // spec's Space-Mono eyebrow + right-aligned count — so this section
            // renders its own header above. `title` is a required EntityList prop
            // but inert here. We deliberately do NOT extend the shared EntityList
            // with dashboard eyebrow chrome (feature styling stays out of shared/).
            <EntityList
              title={title}
              hideHeader
              items={data?.rows ?? []}
              getItemKey={row => row.id}
              renderItem={row => <DashboardProposalCard row={row} timeSince={timeSince} />}
              emptyState={{ message: emptyMessage }}
              itemsClassName="space-y-2"
              variant="flush"
            />
          )}
    </section>
  )
}

/** Two dense card-shaped rows while the section query is in flight. */
function DashboardProposalSectionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify.** Run `pnpm tsc` and `pnpm lint`. Both must pass.

- [ ] **Step 3: Commit.**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx
git commit -m "feat(dashboard): DashboardProposalSection (label + count + list + empty state)"
```

---

### Task 6: Wire the two-section module + prefetch + snapshot label

**Files:**
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposals.tsx` (rewrite)
- Modify: `src/app/(frontend)/dashboard/page.tsx` (add one prefetch)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx` (label string)

**Interfaces:**
- Consumes: `DashboardProposalSection` (Task 5); `awaitingProposalsInput`,
  `sentProposalsInput` (Task 2).

- [ ] **Step 1: Rewrite `dashboard-proposals.tsx`.** Replace the whole file with:

```tsx
'use client'

import Link from 'next/link'

import { awaitingProposalsInput, sentProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardModule } from '@/features/agent-dashboard/ui/components/dashboard-module'
import { DashboardProposalSection } from '@/features/agent-dashboard/ui/components/dashboard-proposal-section'
import { ROOTS } from '@/shared/config/roots'

/**
 * Proposals module — two truthful, non-overlapping sections: "Out for signature"
 * (contract envelope out for signature) and "Sent — awaiting response" (proposal
 * sent, no contract yet). Each section header names the state, so the rows carry
 * no status badge. Each section reuses the exact query keys the dashboard route
 * prefetches (`awaitingProposalsInput` / `sentProposalsInput`), so both hydrate
 * instantly. See docs/superpowers/specs/2026-08-08-dashboard-proposals-sections-design.md.
 */
export function DashboardProposals() {
  return (
    <DashboardModule
      title="Proposals"
      action={(
        <Link
          href={ROOTS.dashboard.proposals.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      )}
    >
      <div className="flex flex-col gap-4">
        <DashboardProposalSection
          title="Out for signature"
          input={awaitingProposalsInput()}
          timeSince="contractSentAt"
          emptyMessage="None out for signature"
        />
        <DashboardProposalSection
          title="Sent — awaiting response"
          input={sentProposalsInput()}
          timeSince="sentAt"
          emptyMessage="Nothing sent awaiting a response"
        />
      </div>
    </DashboardModule>
  )
}
```

- [ ] **Step 2: Prefetch the second query.** In `src/app/(frontend)/dashboard/page.tsx`,
  inside the `authState.status === 'authenticated'` block, directly after the existing
  `prefetch(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))`
  line, add:

```tsx
    prefetch(trpc.proposalsRouter.business.list.queryOptions(sentProposalsInput()))
```

  Then add `sentProposalsInput` to the existing named import from
  `@/features/agent-dashboard/constants/dashboard-queries` at the top of the file.

- [ ] **Step 3: Align the snapshot chip label.** In
  `src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx`, change the
  proposals chip's `label` from `'Awaiting signature'` to `'Out for signature'`
  (the `count` binding and everything else stay as-is — count logic unchanged).

- [ ] **Step 4: Verify (types + lint).** Run `pnpm tsc` and `pnpm lint`. Both must pass.

- [ ] **Step 5: Browser smoke.** With the dev server on `:3003`, authenticate via
  `http://localhost:3003/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&redirect=/dashboard`
  then verify on desktop 1440 + mobile 390:
  - The module title is "Proposals" with two eyebrow sections and per-section counts.
  - "Out for signature" lists only contract-out rows; **no `draft`/`declined` badge
    appears anywhere** (no per-row status badge at all).
  - "Sent — awaiting response" lists `status='sent'` rows with no contract; a row's
    "time since" reads from `sentAt` (not a contract date); no row appears in both sections.
  - Each section's header count equals its list length's full total; empty a section
    (or reason from data) → its empty message renders.
  - The snapshot chip reads "Out for signature" with the Out-for-signature count.
  - Console shows no NEW errors (the pre-existing sidebar `AvatarFallback` hydration
    error may remain).

- [ ] **Step 6: Commit.**

```bash
git add src/features/agent-dashboard/ui/components/dashboard-proposals.tsx \
  src/app/\(frontend\)/dashboard/page.tsx \
  src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx
git commit -m "feat(dashboard): two-section Proposals module + prefetch + snapshot label"
```

---

### Task 7: Supersede the stale Plan 2 + update the epic index

**Files:**
- Modify: `docs/superpowers/plans/2026-08-06-agent-dashboard-data-correctness.md` (add a superseded banner)
- Modify: `docs/superpowers/plans/2026-08-06-agent-dashboard-epic.md` (repoint the Plan 2 entry)

**Interfaces:** docs only.

- [ ] **Step 1: Banner the old plan.** At the very top of
  `2026-08-06-agent-dashboard-data-correctness.md`, add:

```markdown
> **SUPERSEDED (2026-08-08).** The "union" premise here was wrong — the
> `awaitingSignature` DAL filter is already contract-only. Replaced by
> `docs/superpowers/plans/2026-08-08-dashboard-proposals-sections.md` (two
> truthful sections). Kept for history; do not implement.
```

- [ ] **Step 2: Repoint the epic.** In `2026-08-06-agent-dashboard-epic.md`, in the
  Plan 2 entry, replace the filename reference with
  `2026-08-08-dashboard-proposals-sections.md` and note it is a two-section design
  (Out for signature / Sent — awaiting response), not a union.

- [ ] **Step 3: Commit.**

```bash
git add docs/superpowers/plans/2026-08-06-agent-dashboard-data-correctness.md \
  docs/superpowers/plans/2026-08-06-agent-dashboard-epic.md
git commit -m "docs(plans): supersede Plan 2 union with two-section proposals plan"
```

---

## Self-Review

- **Spec coverage:** two predicates (Task 1–2) · per-section cap fix (Task 2) ·
  section-correct time-since (Task 3) · drop per-row badge (Task 4) · section
  component with count + empty state (Task 5) · two-section module + prefetch +
  snapshot label (Task 6) · supersede Plan 2 (Task 7). All spec sections mapped.
- **Placeholders:** none — every code step has concrete code.
- **Type consistency:** `timeSince: 'contractSentAt' | 'sentAt'` identical across
  Tasks 3/4/5/6; `sentNoContract` filter key identical in Tasks 1/2; `sentProposalsInput`
  used in Tasks 2/6; `DASHBOARD_LIMITS.proposalsPerSection` defined in Task 2, used
  by both builders.
- **No test runner:** every task verifies with `pnpm tsc` + `pnpm lint`; Task 6
  adds the browser smoke (matches Plans 1/1b).
- **Scope guards honored:** `awaitingSignature` untouched; no schema migration;
  snapshot count logic unchanged (label only); no client-side contract re-encoding.

## Reuse review (extend-don't-invent audit)

A convention audit checked every new unit for thin ad-hoc surface that should
have extended existing code. Outcome: Tasks 1–4 and 6 are clean **extensions**
(DAL filter map, `DASHBOARD_LIMITS`, the mapper, the card, the page prefetch);
Task 2's per-concern builder and Task 5's component/hook/skeleton are
**justified-new** (one-builder-per-concern is the established pattern; no existing
"query-bound labeled section" primitive exists — `DashboardModule` is card chrome,
`EntityList` is list chrome, this composes both). One decision was ratified:

- **Task 5 bypasses `EntityList`'s built-in header on purpose.** `EntityList`
  already owns a `title`/`count` header, but it is `text-[10px]` sans (banned by
  the dashboard type floor) and can't express the Space-Mono eyebrow — and
  extending the *shared* primitive with dashboard chrome is wrong. The section
  renders its own eyebrow header; the inline comment in Task 5 documents this so a
  future reader doesn't "fix" it into the `entity-frontend.md` redundant-header
  anti-pattern.
- **Rule-of-three watch (do NOT build now):** `DashboardProjects`, the old
  `DashboardProposals`, and `DashboardProposalSection` now share the
  `DashboardModule?` + `useQuery` + skeleton + `EntityList(hideHeader, flush)`
  shape. If a 4th appears, extract a `DashboardListModule<T>`; forcing it now
  would drag `dashboard-projects.tsx` into this plan's scope. Recorded as a
  candidate only.
