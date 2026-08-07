# Dashboard Data Correctness — Proposals + Meetings (Plan 2 of the dashboard epic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
> Steps use checkbox (`- [ ]`) syntax. Part of `2026-08-06-agent-dashboard-epic.md`.
> Runs **after** Plan 1 (UI). Projects correctness is Plan 3 (needs the status-derivation
> refactor). No schema change in this plan.

**Goal:** Make the dashboard's Awaiting-signature and Meetings data mean what the user
operates on: "awaiting signature" = the union of *sent proposals* and *contracts out for
signature*, shown with an honest badge; Today/Upcoming meetings exclude cancelled/no-show.

**Architecture:** Two DAL/query-input changes plus one dashboard-card display fix. The
`awaitingSignature` proposal filter predicate is broadened to a union; a `LIVE_MEETING_OUTCOMES`
complement drives the existing meetings `outcome[]` filter for the non-past windows; the
dashboard proposal card renders a contract-aware badge instead of the bare proposal status.

**Tech Stack:** Drizzle (Postgres/Neon), tRPC, Zod, TanStack Query, React.

## Global Constraints

- **No `pnpm build`.** Verify with `pnpm tsc` + `pnpm lint` + live browser smoke (no test runner).
- **Backend layering:** filter predicates live in the entity DAL (`…/dal/server/queries.ts`),
  not in components or routers. Reuse existing filter surface; do not add ad-hoc queries.
  (ADR-0003; [[feedback-backend-three-layer-convention]].)
- **Proposal/contract independence is real** (ADR-0004): `status` (draft/sent/approved/declined)
  and the contract e-sign fields (`contractSentAt/contractSignedAt/contractDeclinedAt`) are
  separate axes. "Awaiting signature" spans both.
- **Meeting outcome sentiment classifier** (`MEETING_OUTCOME_SENTIMENT`) is canonical — do
  not re-encode. This plan only *excludes* two literal outcomes, it does not classify.
- **Dashboard query keys unchanged** — `awaitingProposalsInput()` still passes
  `awaitingSignature: true`; `meetingsWindowInput(kind)` keeps its shape. Only predicates/
  filter contents change, so the snapshot chips + module lists stay in sync automatically.

---

### Task 1: Union `awaitingSignature` proposal filter

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (the `awaitingSignature`
  filter builder around line 228, and its imports).

**Interfaces:**
- Consumes: `awaitingProposalsInput()` already passes `filters: { awaitingSignature: true }`
  — unchanged. Produces: a broadened predicate; no signature change.

- [ ] **Step 1: Broaden the predicate to the union.** Replace the current
  `awaitingSignature` builder body:
  ```ts
  awaitingSignature: (v: boolean) =>
    v
      ? or(
          eq(proposals.status, 'sent'),
          and(
            isNotNull(proposals.contractSentAt),
            isNull(proposals.contractSignedAt),
            isNull(proposals.contractDeclinedAt),
          ),
        )
      : undefined,
  ```
  Ensure `or` and `eq` are imported from `drizzle-orm` (the file already imports `and`,
  `isNotNull`, `isNull` from there — add `or`, `eq` if not present).

- [ ] **Step 2: Update the filter's doc/JSDoc** on `awaitingSignature` in
  `proposalListFiltersSchema` (and any `// see` comment) to state the union semantics:
  "proposal sent OR contract out (sent, unsigned, undeclined)."

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint` pass.

- [ ] **Step 4: Browser smoke.** Dashboard Awaiting-signature list + the snapshot chip:
  **no draft rows**; sent proposals and contracts-out both appear; the count matches the list.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/shared/entities/proposals/dal/server/queries.ts
  git commit -m "fix(proposals): awaitingSignature = sent proposals OR contracts out for signature"
  ```

---

### Task 2: Honest contract-aware badge on the dashboard proposal card

**Files:**
- Create: `src/features/agent-dashboard/lib/derive-awaiting-state.ts`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx`

**Interfaces:**
- Consumes: `ProposalListRow` (carries `status`, `contractSentAt`, `contractSignedAt`,
  `contractDeclinedAt`). Produces: `deriveAwaitingState(row) → { label: string; tone:
  'warning' | 'muted' }` — the reason the row is in the awaiting-signature list.

- [ ] **Step 1: Create `derive-awaiting-state.ts`.** Pure helper (no component):
  ```ts
  import type { ProposalListRow } from '@/shared/entities/proposals/dal/server/queries'

  /**
   * Why a row qualifies for the dashboard's awaiting-signature roster. The list is the
   * union (proposal sent OR contract out), so the bare `proposal.status` badge lies for
   * contract-out rows (a status='declined' proposal can still have a pending contract).
   * This derives the honest, contract-aware label. See ADR-0004 (proposal/contract independence).
   */
  export function deriveAwaitingState(row: ProposalListRow): { label: string; tone: 'warning' | 'muted' } {
    const contractOut = Boolean(row.contractSentAt) && !row.contractSignedAt && !row.contractDeclinedAt
    if (contractOut) return { label: 'Awaiting signature', tone: 'warning' }
    return { label: 'Sent', tone: 'muted' }
  }
  ```

- [ ] **Step 2: Swap the badge in `dashboard-proposal-card.tsx`.** Replace
  `<ProposalOverviewCard.StatusBadge className="shrink-0" />` with a small badge driven by
  `deriveAwaitingState(row)` — `tone: 'warning'` → `bg-warning/10 text-warning border-warning/20`,
  `tone: 'muted'` → `bg-muted text-muted-foreground`. Keep the `StatusIcon`, `Label`,
  `Actions`, and second-line meta as-is. (The compound `ProposalOverviewCard` and its style
  maps stay untouched — this is a dashboard-local display choice.)

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint` pass.

- [ ] **Step 4: Browser smoke.** No row shows a bare "declined"/"draft" badge; contract-out
  rows read "Awaiting signature", sent-only rows read "Sent".

- [ ] **Step 5: Commit.**
  ```bash
  git add src/features/agent-dashboard/lib/derive-awaiting-state.ts \
    src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx
  git commit -m "fix(dashboard): honest contract-aware badge on awaiting-signature cards"
  ```

---

### Task 3: Exclude cancelled/no-show from Today + Upcoming meetings

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts` (add the live-outcome constant)
- Modify: `src/features/agent-dashboard/constants/dashboard-queries.ts` (`meetingsWindowInput`)

**Interfaces:**
- Consumes: the meetings list `outcome[]` filter (existing `inArray` predicate — no DAL
  change). Produces: `LIVE_MEETING_OUTCOMES` and a windowed outcome filter.

- [ ] **Step 1: Add `LIVE_MEETING_OUTCOMES` to `enums/meetings.ts`** (beside
  `DECIDED_OUTCOMES`):
  ```ts
  /** Outcomes that keep a meeting "live" — everything except the two that mean it never happened. */
  export const LIVE_MEETING_OUTCOMES: MeetingOutcome[] =
    meetingOutcomes.filter(o => o !== 'cancelled' && o !== 'no_show')
  ```

- [ ] **Step 2: Apply it for the non-past windows in `meetingsWindowInput`.** Today and
  Upcoming filter `outcome: LIVE_MEETING_OUTCOMES`; Past passes no `outcome` filter (keeps
  everything for history):
  ```ts
  export function meetingsWindowInput(kind: MeetingWindowKind) {
    return {
      pagination: { limit: DASHBOARD_LIMITS.meetings, offset: 0 },
      sort: { sortBy: 'scheduledFor', sortDir: kind === 'past' ? 'desc' : 'asc' },
      filters: {
        scheduledFor: meetingWindow(kind),
        ...(kind === 'past' ? {} : { outcome: LIVE_MEETING_OUTCOMES }),
      },
    } satisfies MeetingListInput
  }
  ```
  Import `LIVE_MEETING_OUTCOMES` from `@/shared/constants/enums`. The `satisfies
  MeetingListInput` check confirms `outcome` is a valid filter key.

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint` pass.

- [ ] **Step 4: Browser smoke.** Seed/verify a cancelled and a no-show meeting for today:
  neither appears in Today or Upcoming; both still appear in Past. The "Meetings today"
  snapshot chip count matches the filtered Today list.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/shared/constants/enums/meetings.ts \
    src/features/agent-dashboard/constants/dashboard-queries.ts
  git commit -m "fix(dashboard): exclude cancelled/no-show from Today + Upcoming meetings"
  ```

---

## Self-Review

- **Coverage:** awaiting-signature union filter (T1) · honest badge so no draft/declined
  confusion (T2) · Today/Upcoming exclude cancelled+no_show, Past keeps all (T3). All three
  requirement answers mapped; projects correctness is Plan 3.
- **Placeholders:** none — exact predicates, the `LIVE_MEETING_OUTCOMES` definition, and the
  badge tones are spelled out.
- **Type consistency:** `deriveAwaitingState`'s return `tone` union matches the Tailwind
  classes in T2-Step2; `outcome: LIVE_MEETING_OUTCOMES` is validated by `satisfies
  MeetingListInput`; `awaitingProposalsInput()` / `meetingsWindowInput()` signatures are
  unchanged so Plan 1's snapshot + modules keep working.
- **No schema change** — safe to ship before Plan 3's migration.
