# Dashboard Proposals — Two Truthful Sections (Design)

**Status:** approved-in-brainstorm 2026-08-08; revised after a three-way review
pass (coding-conventions · ADRs · ubiquitous-language). Supersedes the
proposals half of `docs/superpowers/plans/2026-08-06-agent-dashboard-data-correctness.md`
(Plan 2). Part of the Agent Dashboard epic (`2026-08-06-agent-dashboard-epic.md`).

## Why this replaces the old Plan 2

Plan 2 was written to "broaden `awaitingSignature` to a union (proposal
`status='sent'` OR contract out)." Trust-but-verify against the code and the dev
DB shows that premise is wrong:

- The DAL filter `awaitingSignature` (`src/shared/entities/proposals/dal/server/queries.ts:228`)
  is **already** contract-only: `contractSentAt` set, `contractSignedAt` null,
  `contractDeclinedAt` null. It is not status-based.
- The two rows currently on the dashboard ("Shingle Roof Re-Deck" → `draft`
  badge, "Porch cement pad + stairs" → `declined` badge) genuinely **have a
  contract envelope out for signature**. Verified: `Shingle Roof Re-Deck` is
  `status='draft'` **with `contract_sent_at` set**. Their badges show the
  *proposal status*, a different axis from the *contract state* (ADR-0004), so
  the badge lies while the filter is right.
- Against real data the union would surface **26 rows** (24 `sent` + 2
  contract-out). Only 2 of 26 would truly be "out for signature"; the other 24
  are proposals awaiting the customer's *response*. A single list titled
  "Awaiting signature" that is 92% not-awaiting-signature is worse, not better.

**Decision:** split the concern into two accurately-labeled sections inside one
module. No union. No schema migration. Because the two sections are each
pre-filtered to a single state, **the section header is the state** — there is no
per-row status badge to lie (this also removes the earlier plan's need to derive
per-row state, which would re-encode the canonical lock ladder — see §ADR notes).

## Goal

Replace the single "Awaiting signature" list with one **Proposals** module
containing two labeled sub-sections that partition the active (non-terminal)
proposals with no overlap, each section naming the true state of its rows.

## Data model — two predicates (no overlap)

Both are list filters on the concrete `proposalListFiltersSchema`, built inside
`listProposals`'s `buildFilterWhere` map, so both respect the existing scope
middleware (`ctx.scope`) and reuse the existing `proposalsRouter.business.list`
procedure — no new API surface (ADR-0002, Entity Server System: "every entity
writes its own list; filter predicates are entity-specific").

| Section (user-facing) | Predicate | Sort | Filter key |
|---|---|---|---|
| **Out for signature** | `contractSentAt` IS NOT NULL **AND** `contractSignedAt` IS NULL **AND** `contractDeclinedAt` IS NULL | `contractSentAt` desc | `awaitingSignature` *(existing — unchanged)* |
| **Sent — awaiting response** | `status = 'sent'` **AND** `contractSentAt` IS NULL | `sentAt` desc | `sentNoContract` *(new)* |

- The new builder mirrors the existing boolean-guard shape exactly:
  `sentNoContract: (v: boolean) => v ? and(eq(proposals.status, 'sent'), isNull(proposals.contractSentAt)) : undefined`
  (`eq` is already imported; `and`/`isNull` already imported). It maps to the
  canonical `proposal_sent` pipeline stage; "awaiting response" is a user-facing
  gloss only, never a code token.
- The `contractSentAt IS NULL` clause guarantees a proposal that has advanced to
  a **contract envelope** appears only in the first section — zero overlap.
- Terminal and not-yet-in-flight proposals appear in neither: a bare `draft`
  (unlocked/editable, no envelope), and the terminal states — `declined`,
  `approved` (a signed contract auto-approves to `approved`; there is no proposal
  `status='signed'`).

Partition proof against current dev data: 2 rows → Out for signature; 24 rows →
Sent — awaiting response; 0 overlap; the remaining 33 proposals
(draft/approved/declined) in neither.

## UI — one "Proposals" module, two sub-sections

Renders in the existing right rail (`#proposals`, `lg:col-span-4`) using the
shared `DashboardModule` chrome. Newest-first ordering (chosen); view-count and
time-since are shown per row but do not drive order.

```
┌─ Proposals ───────────────────── See all →┐
│ OUT FOR SIGNATURE                     2    │  ← Space-Mono eyebrow + section total
│  • <label>            · 2d · $37,792       │  ← up to 5 rows; no per-row state badge
│  • <label>            · viewed 6× · $4,300 │
│                                            │
│ SENT — AWAITING RESPONSE             24    │
│  • <label>            · 2d · 3 views       │
│  • <label>            · 5d · not viewed    │
└────────────────────────────────────────────┘
```

- **Section header:** a Space-Mono eyebrow (`font-mono text-[0.72rem]
  uppercase tracking-[0.2em]`) naming the state, plus the section's total from
  `query.data.total` (a separate SQL `count()` over the full predicate — honest,
  independent of the display cap).
- **Rows:** up to the per-section display cap (see below), then the section's own
  empty state if zero.
- **No per-row status badge.** The section header is the single source of state,
  so `DashboardProposalCard` **drops** the status-colored `ProposalOverviewCard.StatusBadge`
  and `StatusIcon` slots (a raw `draft`/`declined` badge on a contract-out row is
  exactly the lie we're removing). The row leads with the proposal label; if a
  leading glyph is wanted, use a neutral document icon, never a status-colored one.
- **Row content:** label, trade, time-since, value, existing view-count, compact
  actions — via the unchanged `ProposalOverviewCard` compound slots.
- **One `See all →`** in the module header → proposals list page (route unchanged).
- **Empty states:** per section — "None out for signature" / "Nothing sent
  awaiting a response."

### Time-since must be section-correct (silent-bug guard)

`mapProposalRowToCardData` currently hardcodes `createdAt: row.contractSentAt ??
row.createdAt` — deliberately awaiting-signature-specific (its only consumer
today). The **Sent — awaiting response** section must show time since the
*proposal* was sent, not a contract that doesn't exist. Parameterize the mapper:
`mapProposalRowToCardData(row, timeSince: 'contractSentAt' | 'sentAt' = 'contractSentAt')`
— Out-for-signature passes the default; Sent passes `'sentAt'`. Update the
mapper's comment to describe both callers.

### Per-section cap (fix the "5" inconsistency)

`DASHBOARD_LIMITS.proposals` is `20` — it is **not** 5. Add an explicit
`DASHBOARD_LIMITS.proposalsPerSection = 5`; both `awaitingProposalsInput()` and
`sentProposalsInput()` fetch that value. Section counts stay accurate regardless
(they come from the separate `count()` query, not the fetched page), so a small
fetch cap is correct and avoids fetching 20 to show 5.

### Snapshot strip — count logic unchanged, label aligned

`DashboardSnapshotStrip`'s chip reads `awaitingProposalsInput().data.total` = the
Out-for-signature count (currently 2). The **count logic is unchanged**; only the
chip's label string changes from "Awaiting signature" → **"Out for signature"** so
the snapshot, the section header, and the vocabulary all match. The `#proposals`
anchor still targets the module.

## Architecture / files

Units, each with one responsibility:

- **`src/shared/entities/proposals/dal/server/queries.ts`** — add the
  `sentNoContract` predicate to the `buildFilterWhere` map (beside
  `awaitingSignature`) and a `sentNoContract: z.boolean().optional()` field on the
  concrete `proposalListFiltersSchema` (so `sentProposalsInput()`'s `satisfies
  ProposalListInput` type-checks). List filters are correctly co-located in
  `queries.ts` (documented exception to "schemas/ sibling of lib/"; matches the
  `awaitingSignature` precedent). `awaitingSignature` is **untouched**.
- **`src/features/agent-dashboard/constants/dashboard-queries.ts`** — add
  `DASHBOARD_LIMITS.proposalsPerSection = 5`; keep `awaitingProposalsInput()` but
  cap it at `proposalsPerSection`; add `sentProposalsInput()` (`proposalsPerSection`
  cap, `sortBy: 'sentAt'` desc — already in the `buildOrderBy` whitelist, no
  change there — `filters: { sentNoContract: true }`), `satisfies ProposalListInput`.
- **`src/features/agent-dashboard/lib/map-proposal-row-to-card-data.ts`** —
  parameterize with the `timeSince` arg above.
- **`src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx`** —
  new component (one exported component per file): eyebrow label + count + capped
  `EntityList` of `DashboardProposalCard` + per-section empty state. Consumes a
  query-input builder + a title + an empty message; each section's loading
  skeleton stays private/co-located.
- **`src/features/agent-dashboard/ui/components/dashboard-proposals.tsx`** —
  rewrite: one `DashboardModule` titled "Proposals" wrapping two
  `DashboardProposalSection`s, each calling its own builder hook. Two query keys,
  one per section ("one query key per concern"); each section imports its builder
  verbatim so its `useQuery` key equals the server-prefetched key (hydration
  parity — an inline input object would break it).
- **`src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx`** —
  remove the `StatusBadge` + status-colored `StatusIcon` slots; pass the section's
  `timeSince` into the mapper. Compound card and its style maps stay untouched
  (they're used elsewhere). No new file-level constants/helpers in this component.
- **`src/app/(frontend)/dashboard/page.tsx`** — add a void fire-and-forget
  `prefetch(trpc.proposalsRouter.business.list.queryOptions(sentProposalsInput()))`
  beside the existing awaiting prefetch (never awaited).

No new pure helper is introduced (the earlier `deriveProposalFlightState` is
dropped along with the per-row badge).

## ADR & convention notes

- **ADR-0002 (Entity Server System):** new filter is a list-DAL predicate through
  the existing procedure; no ad-hoc query, no new API surface. ✔
- **ADR-0004 (proposal/contract independence):** the whole design keeps the two
  axes separate and refuses the union. Because sections are partitioned by the DAL
  query, **no client-side contract-state is re-encoded anywhere** — we don't
  reproduce the `inflight-locked` field check that `getProposalLockState`
  (`entities/proposals/lib/proposal-lock.ts`) canonically owns. ✔
- **ADR-0005 (derived values):** section counts are SQL `count()` (not
  client-side); both sort keys are real columns; nothing sortable/filterable lives
  only in JSONB. ✔
- **Ubiquitous language:** "proposal" (never "quote"); contract envelope is the
  entity noun; the single user-facing state strings are the two section headers
  ("Out for signature" / "Sent — awaiting response"); no "in-flight"/"flight
  state" vocabulary (it collides with a retired anti-pattern and the
  `inflight-locked` tier).

## Non-goals / scope guards

- **No schema migration.** `status` and contract columns already exist.
- **`awaitingSignature` DAL semantics unchanged** — only new code is added.
- **No engagement/staleness sort** (deferred; newest-first chosen).
- **Snapshot count logic unchanged** (label string only).
- Projects correctness stays Plan 3 / #283; meetings correctness shipped in Plan 1b.

## Known pre-existing divergence (out of scope — flagged, not fixed)

⚠️ The pre-existing `awaitingSignature` filter (`queries.ts:228`) and the canonical
lock ladder disagree on one edge: a `status='approved'` proposal with
`contractSentAt` set and unsigned/undeclined is `terminal-locked` per
`getProposalLockState` (`proposal-lock.ts:36`) yet still matches
`awaitingSignature` (no `status != 'approved'` clause). This spec leaves
`awaitingSignature` untouched, so no change here — but it should be reconciled
separately (either the filter excludes `approved`, or the divergence is documented
as intentional).

## Verification

`pnpm tsc` + `pnpm lint` (no test runner — never `pnpm build`), plus live browser
smoke on desktop 1440 + mobile 390, omni + agent roles:

- Out for signature lists exactly the contract-out rows; no bare `draft`/`declined`
  badge appears anywhere (no per-row status badge at all).
- Sent — awaiting response lists `status='sent'` rows with no contract; none appear
  in both sections; its time-since reflects `sentAt` (not a contract date).
- Each section header count equals its list's `total`; empty states render when a
  section is empty.
- Snapshot "Out for signature" chip equals the Out-for-signature section count.
