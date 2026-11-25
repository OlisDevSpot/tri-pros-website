# Proposal Flow — Feature Rules

The proposal-flow feature is the **customer-and-agent UX** for authoring, reviewing, and signing a proposal. Both the agent and the homeowner read the same proposal page; CASL alone decides what each sees (a session that can update the proposal gets the cockpit, a share-link holder gets nothing internal).

This DOCS.md captures flow-level UX rules. **Data invariants** (status transitions, kind derivation, JSONB merge, etc.) live in [`../../shared/modules/proposals/core/DOCS.md`](../../shared/modules/proposals/core/DOCS.md).

## Layout

```
src/features/proposal-flow/
  constants/
    proposal-steps.ts        the six chapters, in order
    scopes-of-work/          static SOW templates by trade
  contexts/                  the document (proposal, token, canAct), the scroll root,
                             the active chapter, the portfolio match
  hooks/
    use-current-proposal.ts  the page's proposal query (route params + token)
    use-funding-choice.ts    the homeowner's cash down and term, with debounced saves
    use-proposal-flow-store.ts  zustand store for flow-level UI state
  schemas/                   step-form schemas
  types/                     local types
  lib/                       computed values used inside the flow
  dal/                       feature-local DAL (mostly client-side mutations)
  ui/
    components/              chapters (proposal/), cockpit (cockpit/), top bar menu (navbar/), table view
    views/                   page-level views (the whole flow)
```

## Rules

### six-chapters-in-fixed-order

The proposal page is one long scroll with six chapters in fixed order:

1. **Overview** (`overview`) — hero, meeting reps, the visit facts, the parts
2. **Trusted contractor** (`contractor`) — review standing and the four contractor questions
3. **Past results** (`results`) — portfolio projects matched to the proposal's trades
4. **Scope of work** (`scope`) — one spec card per part
5. **Funding** (`funding`) — price breakdown, how you'll pay, the payment schedule
6. **Next steps** (`next-steps`) — request to move forward, then the agreement's signing states

The accessors are the section ids, so no other code names them. Every chapter shows to every viewer; there is no role filter.

**Why**: fixed sequence builds trust progressively — credentials before pricing, pricing before signing. Skipping order makes the sales narrative incoherent.
**Reference impl**: `constants/proposal-steps.ts:proposalSteps`
**Enforced by**: constant array order (chapters render in array order)

### casl-alone-decides-what-the-page-shows

There is no view mode and no `?view=` param. The page root reads `can('update', 'Proposal')` once and puts it in the document context as `canAct`. A session that can update the proposal gets the Cockpit button, the customer name in the top bar and the cockpit sheet; a share-link holder gets neither. Agents preview the homeowner view only from a signed-out window.

**Why**: internal data (cost lines, margin, agent notes) must never reach a homeowner. One read at the root means no chapter can bypass it.
**Reference impl**: `ui/components/proposal/index.tsx` (`canAct`), `contexts/proposal-document-context.tsx`, `ui/components/proposal/top-bar.tsx`
**Enforced by**: one CASL check at the page root; chapters read `canAct` from context

The top bar's ⋮ menu (`ui/components/navbar/navbar-menu.tsx:ProposalNavbarMenu`) offers "View as PDF" to everyone and, to a share-link holder, a call or text to the owner rep (the company line when there is no rep or the rep has no phone).

### sow-edits-merge-jsonb-not-replace

**Retired (Wave 1, epic #256; the merge mechanism itself was deleted entirely in Wave
2).** `projectJSON` is a whole-document column — see
`../../shared/modules/proposals/core/DOCS.md#jsonb-merge-on-update`. Scope-of-Work edits
write to `projectJSON.data.sow` via the proposal entity router's update mutation, and
the client reconstructs and submits the full `projectJSON` document on every save
(never a bare `{ sow: [...] }` partial), so the plain CRUD path is safe.

**Why**: the column was previously registered in `jsonbMergeColumns` on the (mistaken)
assumption that SOW edits were partial; every writer actually sends the whole document,
so the merge config was deregistered rather than fixing a race that never existed. The
`jsonbMergeColumns` mechanism no longer exists at all as of Wave 2 — `update` always
plain-replaces a column now, so this is simply how `update` behaves, not an opt-out.
**Reference impl**: `ui/views/edit-proposal-view.tsx` seeds mutation state from `proposal.data.projectJSON` and rebuilds the whole object (`projectJSON: rawData.project`) before calling `updateProposal.mutate`.
**Enforced by**: convention (whole-document writer discipline)

### customer-token-access-is-update-capable

Homeowners access their proposal via `?token=<shareToken>` (see `../../shared/modules/proposals/core/DOCS.md#shareable-via-token`). Crucially, the token allows **read AND update** — homeowners can change their funding choice on the proposal page: the loan term writes the `proposals.financeOptionId` scalar column (FK → `finance_options`), and the cash down goes through `funding.setCashInDeal`, which the server bounds to the whole price or [deposit, price − $3,500] (`hooks/use-funding-choice.ts`).

**Corrected 2026-08-11**: `selectedFinanceOptionId` was never a real field — it was never stored in either JSONB blob (verified: zero rows, dev 59 blobs / prod 100 blobs, carried that key). The finance-option selection has always lived on the plain `financeOptionId` column; this rule previously mis-cited a blob path that doesn't exist.

**Why**: finance selection is part of the homeowner's decision; forcing them to call the agent to flip an option breaks the self-service flow.
**Reference impl**: `proposalServerSpec.shareable = { tokenColumn: 'token' }` + `createCrudRouter` selecting `shareableProcedure` for update; `db/schema/proposals.ts:financeOptionId`
**Enforced by**: server spec + shareable middleware

### contract-status-derives-from-proposal-row

The Next steps chapter (`lib/derive-next-steps.ts`, `ui/components/proposal/next-steps-action.tsx`) and the cockpit's Agreement step (`ui/components/cockpit/agreement-step.tsx`) read `useContractStatus`, which derives status display from the proposal row's contract event columns (`contractSentAt`, `contractViewedAt`, `contractSignedAt`, `contractDeclinedAt`) — no separate "contract status" column.

When a Zoho webhook fires, contracts service updates these timestamps and both surfaces reflect the new state on the next query.

**Why**: contract events are real-world facts (when did the email get sent? when did the homeowner open it?). Persisting as timestamps preserves the audit trail without requiring a denormalized "status" column.
**Reference impl**: `src/shared/components/contract-status-panel/` (hooks, timeline, envelope card); events mapped in `src/shared/modules/proposals/core/lib/contract-events.ts`
**Enforced by**: convention (status is derived from timestamps, never stored as a separate column)

### one-scroller-one-chapter-tracker

`#proposal-container` is the page's only scroller; `contexts/scroll-context.tsx` holds it as the scroll root. `contexts/active-chapter-context.tsx` runs one `useActiveSection` tracker over that root, and the rail (1100px and up) and the top bar's chapter tabs (below 1100px) both read it. A tap marks its chapter at once and holds it until the jump ends; scrolling moves the mark as each chapter crosses a fixed line under the top edge.

**Why**: customers scroll naturally; agents may want to jump. Two trackers disagreed mid-scroll, so the rail and the tabs share one.
**Reference impl**: `contexts/active-chapter-context.tsx`, `src/shared/hooks/use-active-section.ts`; consumed by `ui/components/proposal/chapter-nav.tsx`
**Enforced by**: convention (single scroll container per flow page)

## Anti-patterns

- **Re-adding a view mode or a `?view=` param.** CASL decides through `canAct`; a URL switch would let a link pick what a viewer sees.
- **Sending a partial `projectJSON` object on update.** It is a whole-document column; `update` always plain-replaces (the `jsonbMergeColumns` mechanism it was deregistered from in Wave 1 was deleted entirely in Wave 2) — always reconstruct and submit the full object. See `../../shared/modules/proposals/core/DOCS.md#jsonb-merge-on-update`. (`fundingJSON` no longer applies — W3 moved funding to scalar columns + incentive rows, and the blob is omitted from the insert/update schemas.)
- **Storing a denormalized "contract status" enum.** Derive from the timestamp columns.
- **Manual proposal status flips inside the flow** (e.g., setting `status = 'approved'` from a button). Approval is a contract-event consequence (`completed` webhook), or the explicit approve mutation.
- **Putting cost lines on the page.** Cost lines are agent-only (the cockpit's Internal financials dialog) — they show margin/multiplier info that must not leak to homeowners.

## See also

- `../../shared/modules/proposals/core/DOCS.md` — proposal data invariants (kind, TCP, JSONB merge, CSLB, contract events)
- `../../shared/entities/customers/DOCS.md#phone-visibility-threshold` — paired customer-side gate
- `../../trpc/DOCS.md#shareable-middleware-token-or-session` — token-or-session middleware
- `docs/proposal/creation-guide.md` — sales-side proposal-authoring playbook
- `docs/proposal/scope-presentation.md` — how to present scope to a homeowner
- `docs/proposal/financing-presentation.md` — how to present financing
