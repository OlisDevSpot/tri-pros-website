# Dashboard Proposals — Two Truthful Sections (Design)

**Status:** approved (brainstorm 2026-08-08). Supersedes the proposals half of
`docs/superpowers/plans/2026-08-06-agent-dashboard-data-correctness.md` (Plan 2).
Part of the Agent Dashboard epic (`2026-08-06-agent-dashboard-epic.md`).

## Why this replaces the old Plan 2

Plan 2 was written to "broaden `awaitingSignature` to a union (proposal
`status='sent'` OR contract out)." Trust-but-verify against the code and the dev
DB shows that premise is wrong:

- The DAL filter `awaitingSignature` (`src/shared/entities/proposals/dal/server/queries.ts:228`)
  is **already** contract-only: `contractSentAt` set, `contractSignedAt` null,
  `contractDeclinedAt` null. It is not status-based.
- The two rows currently on the dashboard ("Shingle Roof Re-Deck" → `draft`
  badge, "Porch cement pad + stairs" → `declined` badge) genuinely **have
  contracts out for signature**. Verified: `Shingle Roof Re-Deck` is
  `status='draft'` **with `contract_sent_at` set**. Their badges show the
  *proposal status*, a different axis from the *contract state* (ADR-0004), so
  the badge lies while the filter is right.
- Against real data the union would surface **26 rows** (24 `sent` + 2
  contract-out). Only 2 of 26 would truly be "awaiting *signature*"; the other
  24 are quotes awaiting the customer's *response*. A module titled "Awaiting
  signature" that is 92% not-awaiting-signature is worse, not better.

**Decision:** split the concern into two accurately-labeled sections inside one
module, each with an honest per-row state. No union. No schema migration.

## Goal

Replace the single "Awaiting signature" list with one **Proposals** module
containing two labeled sub-sections that partition the in-flight proposals with
no overlap, each row showing its true state.

## Data model — two predicates (no overlap)

Both are DAL filters on `proposalListFiltersSchema`; both respect the entity's
existing scope middleware (agent sees own via meeting participation, super-admin
omni).

| Section | Predicate | Sort | Filter key |
|---|---|---|---|
| **Out for signature** | `contractSentAt` IS NOT NULL **AND** `contractSignedAt` IS NULL **AND** `contractDeclinedAt` IS NULL | `contractSentAt` desc | `awaitingSignature` *(existing — unchanged)* |
| **Sent — awaiting response** | `status = 'sent'` **AND** `contractSentAt` IS NULL | `sentAt` desc | `sentAwaitingResponse` *(new)* |

The `contractSentAt IS NULL` clause on the second predicate guarantees a proposal
that has advanced to a contract appears only in the first section. Terminal/dead
states — `draft` with no contract, `declined`, `approved`, `signed` — appear in
neither.

Partition proof against current dev data: 2 rows → Out for signature; 24 rows →
Sent — awaiting response; 0 overlap; remaining 33 proposals (draft/approved/etc.)
in neither.

## UI — one "Proposals" module, two sub-sections

Renders in the existing right rail (`#proposals`, `lg:col-span-4`) using the
shared `DashboardModule` chrome. Newest-first ordering (chosen); view-count and
time-since are shown but do not drive order.

Structure (top to bottom inside the one module):

```
┌─ Proposals ───────────────────── See all →┐
│ OUT FOR SIGNATURE                     2    │  ← eyebrow label + total count
│  • <label>   Awaiting signature   · meta   │  ← up to 5 rows
│  • <label>   Awaiting signature   · meta   │
│                                            │
│ SENT — AWAITING RESPONSE             24    │
│  • <label>   Sent   · 3 views · 2d ago     │
│  • <label>   Sent   · not viewed · 5d ago  │
└────────────────────────────────────────────┘
```

- **Section header:** Space-Mono eyebrow (`font-mono text-[0.72rem]
  uppercase tracking-[0.2em]`) + the section's total (`query.data.total`).
- **Rows:** up to **5** per section (`DASHBOARD_LIMITS`), then the section's
  empty state if zero. Caps are tunable.
- **Honest per-row badge** via a new pure helper `deriveProposalFlightState(row)`:
  - contract out (`contractSentAt` set, unsigned, undeclined) → `{ label:
    'Awaiting signature', tone: 'warning' }`
  - else `status === 'sent'` → `{ label: 'Sent', tone: 'muted' }`
  Because each section's rows are homogeneous by construction, the helper yields
  the right label per section; it replaces the bare `ProposalOverviewCard.StatusBadge`.
- **Row content** otherwise unchanged from today's `DashboardProposalCard`:
  label, trade, time-since (`sentAt`/`contractSentAt`), value, existing view-count.
- **One `See all →`** in the module header → proposals list page (unchanged route).
- **Empty states:** per section — "None out for signature" / "Nothing sent
  awaiting a response."

### Snapshot strip — unchanged

`DashboardSnapshotStrip`'s "Awaiting signature" chip reads
`awaitingProposalsInput().data.total` = the Out-for-signature count (genuine
awaiting-signature number, currently 2). Semantics stay accurate; no change.
The chip's `#proposals` anchor still targets the module.

## Architecture / files

Units, each with one responsibility:

- **`src/shared/entities/proposals/dal/server/queries.ts`** — add
  `sentAwaitingResponse` filter (`status='sent'` AND `contractSentAt IS NULL`)
  next to `awaitingSignature`, plus its `z.boolean().optional()` field on
  `proposalListFiltersSchema`. `awaitingSignature` is **untouched**.
- **`src/features/agent-dashboard/constants/dashboard-queries.ts`** — keep
  `awaitingProposalsInput()`; add `sentProposalsInput()` (limit from
  `DASHBOARD_LIMITS`, `sortBy: 'sentAt'` desc, `filters: { sentAwaitingResponse: true }`),
  `satisfies ProposalListInput`.
- **`src/features/agent-dashboard/lib/derive-proposal-flight-state.ts`** — new
  pure helper returning `{ label: string; tone: 'warning' | 'muted' }`.
- **`src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx`** —
  new component: eyebrow label + count + capped `EntityList` of
  `DashboardProposalCard` + per-section empty state. One component per file.
- **`src/features/agent-dashboard/ui/components/dashboard-proposals.tsx`** —
  rewrite: one `DashboardModule` titled "Proposals" wrapping two
  `DashboardProposalSection`s, each fed its own query. Two query hooks (one per
  section) — matches the "one query key per concern" convention.
- **`src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx`** —
  swap `ProposalOverviewCard.StatusBadge` for a small badge driven by
  `deriveProposalFlightState(row)` (tones: `warning` →
  `bg-warning/10 text-warning border-warning/20`; `muted` →
  `bg-muted text-muted-foreground`). Compound card + style maps untouched.
- **`src/app/(frontend)/dashboard/page.tsx`** — prefetch the second query
  (`sentProposalsInput()`) alongside the existing `awaitingProposalsInput()`.

## Non-goals / scope guards

- **No schema migration.** `status` and contract columns already exist.
- **`awaitingSignature` semantics unchanged** — only new code is added.
- **No engagement/staleness sort** (explicitly deferred; newest-first chosen).
- **No snapshot change.**
- Projects correctness stays Plan 3 / #283; meetings correctness already shipped
  in Plan 1b. This spec is proposals-only.

## Verification

`pnpm tsc` + `pnpm lint` (no test runner — never `pnpm build`), plus live browser
smoke on desktop 1440 + mobile 390, omni + agent roles:

- Out for signature lists exactly the contract-out rows, each badged "Awaiting
  signature" (no bare `draft`/`declined`).
- Sent — awaiting response lists `status='sent'` rows with no contract, badged
  "Sent" + view cue; none appear in both sections.
- Each section header count equals its list's `total`; empty states render when a
  section is empty.
- Snapshot "Awaiting signature" chip still equals the Out-for-signature count.
