# Proposal Flow — Feature Rules

The proposal-flow feature is the **multi-step customer-and-agent UX** for authoring, reviewing, and signing a proposal. Both the agent (building) and the homeowner (reviewing/signing) consume the same flow — distinguished by `?view=agent|customer` and a CASL permission gate.

This DOCS.md captures flow-level UX rules. **Data invariants** (status transitions, kind derivation, JSONB merge, etc.) live in [`../../shared/entities/proposals/DOCS.md`](../../shared/entities/proposals/DOCS.md).

## Layout

```
src/features/proposal-flow/
  constants/
    proposal-steps.ts        the 6-step sequence + role gating
    scopes-of-work/          static SOW templates by trade
  contexts/                  scroll context (used by step nav)
  hooks/
    use-current-proposal.ts  TRPC query + draft-mode state
    use-proposal-flow-store.ts  zustand store for flow-level UI state
    use-view-mode.ts         customer vs agent view (CASL-gated)
  schemas/                   step-form schemas
  types/                     local types
  lib/                       computed values used inside the flow
  dal/                       feature-local DAL (mostly client-side mutations)
  ui/
    components/              step components + step navigation + table view
    views/                   page-level views (the whole flow)
```

## Rules

### six-step-sequence-with-role-gating

The proposal flow has 6 steps in fixed order:

1. **Project Overview** — title, description, project type, customer context
2. **Trusted Contractor** — about Tri Pros (licenses, warranties)
3. **Past Results** — related projects from portfolio
4. **Scope of Work** — line-itemized SOW with optional cost lines (agent-only)
5. **Funding** — pricing breakdown, incentives, finance options, monthly payment
6. **Agreement** — Zoho Sign envelope status panel; signing + delivery

Steps are filtered by user role via `generateProposalSteps(userRole)` — currently all 6 are visible to both `homeowner` and `agent`, but the filter exists to differentiate in future.

**Why**: fixed sequence builds trust progressively — credentials before pricing, pricing before signing. Skipping order makes the sales narrative incoherent.
**Reference impl**: `constants/proposal-steps.ts:proposalSteps`
**Enforced by**: constant array order (steps render in array order)

### view-mode-defaults-to-customer-casl-gates-agent

`?view=customer` (default) or `?view=agent`. The `useViewMode` hook applies a CASL `can('update', 'Proposal')` gate **inside the hook** — a homeowner appending `?view=agent` deterministically gets `customer`. Default (no param) is `customer`.

**Why**: internal data (cost lines, margin, agent notes) is hidden by default. Agents must explicitly opt in to the agent view. The CASL gate inside the hook means no caller can accidentally bypass it.
**Reference impl**: `hooks/use-view-mode.ts`
**Enforced by**: CASL ability check inside the hook (single chokepoint)

### customizable-sections-vs-static

Most steps are **static**: their content comes from constants + portfolio data. Two steps are **customizable**: agents edit `funding` and `agreement` per proposal (defined in `proposal-steps.ts:customizableSections`).

**Why**: project overview, trusted contractor, past results are brand/portfolio surfaces — same for every proposal. Scope of Work edits the proposal's `projectJSON.data.sow`. Funding edits `fundingJSON.data`. Agreement reads contract status from the proposal record (no edits in flow — signing is via Zoho).

**Reference impl**: `constants/proposal-steps.ts:customizableSections`
**Enforced by**: convention (which steps render edit UI for the agent view)

### sow-edits-merge-jsonb-not-replace

Scope-of-Work edits write to `projectJSON.data.sow` via the proposal entity router's update mutation. Per `../../shared/entities/proposals/DOCS.md#jsonb-merge-on-update`, the column is configured for deep-merge in the server spec — never full replacement.

**Why**: SOW edits are partial submissions (one section at a time, sometimes one line item at a time). Replacement would wipe other sections during a save.
**Reference impl**: server spec at `src/shared/entities/proposals/lib/server-spec.ts:update.jsonbMergeColumns`
**Enforced by**: `createCrudRouter` update handler (DAL layer)

### customer-token-access-is-update-capable

Homeowners access their proposal via `?token=<shareToken>` (see `../../shared/entities/proposals/DOCS.md#shareable-via-token`). Crucially, the token allows **read AND update** — homeowners can change their finance option selection from the customer view (which writes to `fundingJSON.data.selectedFinanceOptionId`).

**Why**: finance selection is part of the homeowner's decision; forcing them to call the agent to flip an option breaks the self-service flow.
**Reference impl**: `proposalServerSpec.shareable = { tokenColumn: 'token' }` + `createCrudRouter` selecting `shareableProcedure` for update
**Enforced by**: server spec + shareable middleware

### funding-mode-cash-vs-finance

The funding step has two pricing modes: `cash` and `finance`. The mode toggles which inputs are visible (deposit amount + percentage vs. APR + term + monthly payment) and which derived values are computed.

Mode is stored in `fundingJSON.data.mode`. Both modes share `startingTcp` + `incentives`; only the mode-specific fields differ.

**Why**: residential remodeling sells in both modalities — cash gets a deposit discussion, finance gets a monthly-payment discussion. Same proposal, different framing per customer.
**Reference impl**: `schemas/`; UI in `ui/components/proposal/funding/`
**Enforced by**: Zod (discriminated union or branching `optional()` fields per mode)

### contract-status-panel-derives-from-proposal-row

The Agreement step renders `ContractStatusPanel` which derives status display purely from the proposal row's contract event columns (`contractSentAt`, `contractViewedAt`, `contractSignedAt`, `contractDeclinedAt`) — no separate "contract status" column.

When a Zoho webhook fires, contracts service updates these timestamps and the panel reflects new state on next query.

**Why**: contract events are real-world facts (when did the email get sent? when did the homeowner open it?). Persisting as timestamps preserves the audit trail without requiring a denormalized "status" column.
**Reference impl**: `src/shared/components/contract-status-panel/`; events mapped in `src/shared/entities/proposals/lib/contract-events.ts`
**Enforced by**: convention (status is derived from timestamps, never stored as a separate column)

### scroll-context-syncs-step-nav

`contexts/scroll-context.tsx` tracks which step is currently in the viewport and syncs the step-nav highlight. Steps are rendered in one scrollable container — clicking a nav item scrolls to the section; scrolling updates the nav.

**Why**: customers scroll naturally; agents may want to jump. Both behaviors share one nav.
**Reference impl**: `contexts/scroll-context.tsx`; consumed by `ui/components/navbar/`
**Enforced by**: convention (single scroll container per flow page)

## Anti-patterns

- **Adding a new step without role gating.** Even if it's visible to both today, the `roles` field is the future seam — don't drop it.
- **Bypassing `useViewMode`.** Always go through the hook so the CASL gate runs. Reading `searchParams.get('view')` directly is a bug.
- **Replacing `projectJSON` / `fundingJSON` on update.** Merge — see `../../shared/entities/proposals/DOCS.md#jsonb-merge-on-update`.
- **Storing a denormalized "contract status" enum.** Derive from the timestamp columns.
- **Manual proposal status flips inside the flow** (e.g., setting `status = 'approved'` from a button). Approval is a contract-event consequence (`completed` webhook), or the explicit approve mutation.
- **Putting cost-line edits in the customer view.** Cost lines are agent-only — they show margin/multiplier info that must not leak to homeowners.

## See also

- `../../shared/entities/proposals/DOCS.md` — proposal data invariants (kind, TCP, JSONB merge, CSLB, contract events)
- `../../shared/entities/customers/DOCS.md#phone-visibility-threshold` — paired customer-side gate
- `../../trpc/DOCS.md#shareable-middleware-token-or-session` — token-or-session middleware
- `docs/proposal/creation-guide.md` — sales-side proposal-authoring playbook
- `docs/proposal/scope-presentation.md` — how to present scope to a homeowner
- `docs/proposal/financing-presentation.md` — how to present financing
