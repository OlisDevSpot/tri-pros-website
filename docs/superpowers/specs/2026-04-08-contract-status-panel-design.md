# Contract Status Panel Design

**Date:** 2026-04-08
**Scope:** Reusable component showing contract signing status + agent actions, replacing existing `agreement-link` and `send-proposal-link` sections.
**Depends on:** `contractService` (Zoho Sign), `contracts.router.ts`

---

## Context

The app uses Zoho Sign for contract signing. Agents send proposals → a draft signing request is created in the background → the homeowner clicks "Get Agreement Link" to trigger signing → the contractor signs first, then the homeowner.

Currently, the proposal page has two separate sections (`send-proposal-link` for emailing, `agreement-link` for homeowner signing) with no visibility into the contract's lifecycle status. Agents have no way to see whether the contractor has signed, whether the homeowner has viewed the document, or to recall/resend contracts.

---

## Component Architecture

One component, two modes. `ContractStatusPanel` receives proposal data and the viewer's role, renders accordingly.

### File Structure

```
src/shared/components/contract-status-panel/
  ui/
    contract-status-panel.tsx      <- main component, variant: 'full' | 'compact'
    agent-contract-view.tsx        <- agent rendering: status + actions + tooltips
    homeowner-contract-view.tsx    <- homeowner rendering: messages + request button
    signer-status-row.tsx          <- single row: icon + role + status label
  constants/
    contract-statuses.ts           <- status labels, colors, icons mapping
  hooks/
    use-contract-status.ts         <- wraps tRPC query + polling (30s when inprogress)
    use-credit-cooldown.ts         <- 30-second cooldown timer for credit-consuming buttons
  types.ts                         <- ContractStatusPanelProps, variant type
```

### Props Interface

```ts
interface ContractStatusPanelProps {
  proposalId: string
  token?: string           // for homeowner token-based access
  variant: 'full' | 'compact'
  isAgent: boolean         // determines which view to render
}
```

### Reusability

Designed to work in multiple contexts:
- **Proposal page** (`variant: 'full'`) — replaces both `agreement-link` and `send-proposal-link`
- **Pipeline kanban card** (`variant: 'compact'`) — future
- **Customer profile modal** (`variant: 'compact'`) — future
- **Proposal entity actions** — future

Only the proposal page integration is built in this spec. The component API supports future contexts without changes.

---

## Zoho Sign Types

New file: `src/shared/services/zoho-sign/types.ts`

```ts
export const zohoRequestStatuses = [
  'draft', 'inprogress', 'completed', 'declined', 'recalled', 'expired',
] as const
export type ZohoRequestStatus = typeof zohoRequestStatuses[number]

export const zohoActionStatuses = [
  'NOACTION', 'UNOPENED', 'VIEWED', 'SIGNED',
] as const
export type ZohoActionStatus = typeof zohoActionStatuses[number]

export interface ZohoSignerStatus {
  role: string
  status: ZohoActionStatus
  recipientEmail: string
}

export interface ZohoContractStatus {
  requestId: string
  requestStatus: ZohoRequestStatus
  signerStatuses: ZohoSignerStatus[]
}
```

---

## Data Flow

### New tRPC Procedures (contracts.router.ts)

**`getContractStatus`** — `baseProcedure` (token-based access, same dual-gate as `getProposal`)
- Input: `{ proposalId: string, token?: string }`
- Returns `ZohoContractStatus | null` (null if no `signingRequestId` on proposal)
- Calls `contractService.getSigningStatus()` which now returns the full typed response

**`recallContract`** — `agentProcedure`
- Input: `{ proposalId: string }`
- Calls `contractService.recallSigningRequest()`

**`resendContract`** — `agentProcedure`
- Input: `{ proposalId: string }`
- Calls `contractService.resendSigningRequest()`
- Shows confirmation dialog on the client before calling: "This will invalidate the existing agreement. The homeowner will need to request a new agreement link. Continue?"

### Updated contractService.getSigningStatus

Returns `ZohoContractStatus` instead of `{ status: string }`. Parses the full `actions` array from Zoho's response to extract per-signer statuses.

### Polling

`use-contract-status.ts` hook:
- Polls every 30 seconds when `requestStatus === 'inprogress'`
- Stops polling when `completed`, `declined`, `recalled`, or `expired`
- No polling when `draft` or `null`

### Credit Cooldown

`use-credit-cooldown.ts` hook:
- After any credit-consuming action (Send for Signing, Resend), disables the button for 30 seconds
- Shows a countdown indicator on the disabled button
- Applies to: `sendContractForSigning`, `resendContract`
- Does NOT apply to: `recallContract` (free operation)

---

## Agent View States

### State 1: No contract exists (signingRequestId is null, proposal not yet sent)

```
+--------------------------------------------------+
| Contract                                     O   |
|                                                  |
| No agreement has been created for this proposal  |
|                                                  |
| [Send Proposal] <- existing send flow            |
+--------------------------------------------------+
```

The agent's State 1 embeds the existing send-proposal functionality directly: personal note textarea + "Send Proposal Link" button + "Resend?" link (when already sent). This is not a separate component — it's rendered inline within the agent contract view. Once the proposal is sent, a draft is automatically created in the background and the panel transitions to State 2.

### State 2: Draft created (requestStatus: 'draft')

```
+--------------------------------------------------+
| Contract: Draft                              O   |
|                                                  |
| Contractor    -- No action                       |
| Homeowner     -- No action                       |
|                                                  |
| [Send for Signing (i)]  [Recall (i)]             |
+--------------------------------------------------+
```

### State 3: In progress (requestStatus: 'inprogress')

Per-signer statuses progress naturally through the sequential signing flow:

| Contractor | Homeowner | Meaning |
|---|---|---|
| Unopened | Waiting | Just submitted, contractor email sent |
| Viewed | Waiting | Contractor opened, hasn't signed |
| Signed | Unopened | Contractor signed, homeowner email sent |
| Signed | Viewed | Homeowner opened, hasn't signed |
| Signed | Signed | Complete -> transitions to State 4 |

```
+--------------------------------------------------+
| Contract: Awaiting Signatures                Y   |
|                                                  |
| Contractor    (check) Signed                     |
| Homeowner     (eye) Viewed                       |
|                                                  |
| Sent Apr 8, 2026                                 |
|                                                  |
| [Resend (i)]  [Recall (i)]                       |
+--------------------------------------------------+
```

### State 4: Completed (requestStatus: 'completed')

```
+--------------------------------------------------+
| Contract: Signed                             G   |
|                                                  |
| Contractor    (check) Signed                     |
| Homeowner     (check) Signed                     |
|                                                  |
| Sent Apr 8, 2026                                 |
+--------------------------------------------------+
```

No action buttons — the contract is final.

### State 5: Declined / Recalled / Expired

```
+--------------------------------------------------+
| Contract: Declined                           R   |
|                                                  |
| [Resend (i)]                                     |
+--------------------------------------------------+
```

### Action Button Tooltips

Each action button has an `InfoCircleIcon` that triggers the app's existing clickable tooltip component:

- **Send for Signing** (i) — "Submits the draft agreement to both parties for signing. This will consume 5 Zoho Sign credits."
- **Resend** (i) — "Cancels the current agreement and creates a new one with the latest proposal data. Costs 5 credits."
- **Recall** (i) — "Cancels the current agreement. Recipients will no longer be able to view or sign it."

### Resend Confirmation Dialog

Uses the existing `BaseModal` component. Triggered before `resendContract` mutation:

- Title: "Resend Agreement?"
- Body: "This will invalidate the existing agreement. The homeowner will need to request a new agreement link. Continue?"
- Actions: [Cancel] [Confirm]

### 30-Second Cooldown

After Send for Signing or Resend:
- Button becomes disabled
- Shows countdown text: "Wait 28s..."
- Re-enables after 30 seconds

---

## Homeowner View States

### State 1: No contract / Draft exists (homeowner doesn't see drafts)

```
+-----------------------------------------------------+
| No agreement has been generated for this proposal    |
| yet. Once you are ready to move forward, click       |
| below to alert our office you'd like to proceed      |
| with scheduling.                                     |
|                                                      |
| [Request Agreement]                                  |
+-----------------------------------------------------+
```

Clicking "Request Agreement" calls `sendContractForSigning`. If a draft exists, it submits it. If not, it creates + submits.

### State 2: In progress — waiting on contractor

```
+-----------------------------------------------------+
| Your agreement has been generated and is being       |
| reviewed by our team. You will receive a signing     |
| email shortly.                                       |
+-----------------------------------------------------+
```

### State 3: In progress — waiting on homeowner

```
+-----------------------------------------------------+
| Your agreement is ready for signature! Please        |
| check your email for the signing link from           |
| Zoho Sign.                                           |
+-----------------------------------------------------+
```

### State 4: Completed

```
+-----------------------------------------------------+
| Agreement signed! Thank you. Our team will be        |
| in touch to schedule your project.                   |
+-----------------------------------------------------+
```

### State 5: Declined / Recalled / Expired

```
+-----------------------------------------------------+
| This agreement is no longer active. Please contact   |
| your representative for assistance.                  |
|                                                      |
| [Request New Agreement]                              |
+-----------------------------------------------------+
```

---

## Integration

### Proposal Page

The `ContractStatusPanel` replaces both `agreement-link` and `send-proposal-link` step sections in the proposal steps array. The existing `proposalSteps` constant maps step accessors to components — a new `contract` accessor replaces both.

The `isAgent` flag is derived from the existing CASL ability check (`ability.can('update', 'Proposal')`).

### Send Proposal Email

The "Send Proposal" email functionality (personal note textarea + send button) is preserved within the agent's State 1 (no contract). Once the proposal is sent, the panel transitions to show contract status. The "Resend?" link for re-sending the proposal email can remain as a secondary action within the agent view.

### Files Modified

- `src/features/proposal-flow/constants/proposal-steps.ts` — replace `agreement-link` and `send-proposal-link` with single `contract` step
- `src/features/proposal-flow/ui/components/proposal/index.tsx` — render `ContractStatusPanel` for the `contract` step
- `src/trpc/routers/proposals.router/contracts.router.ts` — add `getContractStatus`, `recallContract`, `resendContract`
- `src/shared/services/contract.service.ts` — update `getSigningStatus` return type
- `src/shared/services/zoho-sign/types.ts` — new file with typed Zoho Sign statuses

### Files Deleted

- `src/features/proposal-flow/ui/components/proposal/agreement-link.tsx`

### Files Kept (but no longer used in proposal page)

- `src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx` — kept for potential reuse, but replaced by the integrated send flow in `ContractStatusPanel`
