# Proposal Finance Application Quick-Send — Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-click, agent-only "Send Finance Application" that fires the pre-filled Zoho Sign template `563034000000106203` (`tpr-fin-doc-single`) to the homeowner — **independent of the contract envelope and its lock ladder** — with **sent-only** status tracking and a UI card (Send / "Sent {date}" / Resend).

**Architecture:** New `entity.authedProcedure` `sendFinanceApplication({ proposalId })` → a `contractsService` method that resolves the proposal via `getFullView`, builds the single-template createdocument body from the customer, calls the already-present-but-unused `zohoSignClient.createFromTemplate(templateId, body, quickSend=true)`, and persists `financeRequestId` + `financeSentAt` via `proposalCrud.update`. A `FinanceApplicationCard` sits beside `ProposalCard`/`EnvelopeCard` in `AgentContractView`. No webhook/lifecycle in v1.

**Tech Stack:** Next.js 15, tRPC (entity procedures), Drizzle (Postgres/Neon), Zod, TanStack Query, Zoho Sign REST, shadcn/ui.

**Design spec:** `docs/superpowers/specs/2026-08-05-proposal-capabilities-media-portfolio-finance-design.md` (Feature 3). Independent of Plans 1/1b/2.

## Global Constraints

- **Verification model (NO unit-test runner):** each task closes with `pnpm tsc` (no errors) + `pnpm lint` (clean) + the stated manual/DB check. Never `pnpm build`.
- **Agent-only:** the send procedure is `entity.authedProcedure` (never `shareableProcedure`/token). Homeowners never trigger it.
- **Independence:** finance columns are **lifecycle/tracking**, deliberately **NOT** in `frozenProposalLockedFields` — send/resend works on a locked/frozen proposal. Do not gate on the contract lock ladder or contract state.
- **Timestamps:** `mode: 'string'` timestamptz columns; write with `new Date().toISOString()` — never raw `sql` NOW() (per `feedback-no-raw-sql-for-event-timestamps`).
- **DB pushes:** `pnpm db:push:dev` only; additive columns verified with `--dry-run` first. Never prod.
- **Secrets/Zoho:** template + action ids live in `zoho-sign/constants`; verify the homeowner signer sits at template `signing_order=2` before shipping.
- **Git:** work on `main`, stage by explicit path. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Conventions:** tRPC → service → DAL; services orchestrate, DAL implements; one component per file; named exports; `memory/coding-conventions.md`.

---

## File Structure

**Modify:**
- `src/shared/db/schema/proposals.ts` — add `financeRequestId` + `financeSentAt` columns.
- `src/shared/services/providers/zoho-sign/constants/index.ts` — add `ZOHO_SIGN_TEMPLATES.financeDoc`.
- `src/shared/services/providers/zoho-sign/lib/documents/registry.ts` — add granular `customerCity/State/Zip` field sources.
- `src/shared/services/contracts.service.ts` — add `sendFinanceApplication`.
- `src/trpc/routers/proposals.router/contracts.router.ts` — add the `sendFinanceApplication` procedure.
- `src/shared/components/contract-status-panel/ui/agent-contract-view.tsx` — add the `FinanceApplicationCard` sibling + thread props.
- `src/shared/components/contract-status-panel/types.ts` — extend `ContractStatusPanelProps`.
- `src/features/proposal-flow/ui/components/proposal/index.tsx` — pass `financeRequestId`/`financeSentAt` from `proposalData`.
- DOCS: `proposals/DOCS.md` finance-quick-send independence; spec Feature 3 checklist.

**Create:**
- `src/shared/services/providers/zoho-sign/lib/documents/build-finance-doc-body.ts` — the single-template createdocument body builder.
- `src/shared/components/contract-status-panel/ui/finance-application-card.tsx` — the UI card.

---

## Task 1: Proposal finance-tracking columns

**Files:** Modify `src/shared/db/schema/proposals.ts`

**Interfaces:**
- Produces: `proposals.financeRequestId` (text, nullable), `proposals.financeSentAt` (timestamptz string, nullable). Confirmed NOT added to `frozenProposalLockedFields`.

- [ ] **Step 1:** Add alongside the existing contract lifecycle columns (near `contractSentAt`):

```ts
  financeRequestId: text('finance_request_id'),
  financeSentAt: timestamp('finance_sent_at', { mode: 'string', withTimezone: true }),
```

- [ ] **Step 2:** Confirm `src/shared/entities/proposals/lib/proposal-lock.ts` `frozenProposalLockedFields` is **unchanged** (must remain `['label','formMetaJSON','projectJSON','fundingJSON','financeOptionId','meetingId']`). These tracking columns stay OUT — that is what lets the send work on a frozen proposal.
- [ ] **Step 3:** Confirm `getFullView` (`src/shared/entities/proposals/dal/server/queries.ts`) selects the full proposal row (no explicit column projection that would omit the new columns) so `financeRequestId`/`financeSentAt` flow to `ProposalWithCustomer` automatically. If there IS an explicit projection, add the two fields.
- [ ] **Step 4:** `pnpm db:push:dev --dry-run` → expect **only** add `finance_request_id` + `finance_sent_at` (both nullable) on `proposals`; no other changes. Then `pnpm db:push:dev`.
- [ ] **Step 5:** `pnpm tsc && pnpm lint`; commit (`feat(proposals): finance-tracking columns (financeRequestId, financeSentAt)`).

---

## Task 2: Zoho template constants + granular field sources + body builder

**Files:** Modify `.../zoho-sign/constants/index.ts`, `.../zoho-sign/lib/documents/registry.ts`; Create `.../zoho-sign/lib/documents/build-finance-doc-body.ts`

**Interfaces:**
- Consumes: `FieldSource = (ctx: ProposalContext) => string`, `ProposalWithCustomer` (via `ctx.proposal.customer`), `formatPhone`.
- Produces: `ZOHO_SIGN_TEMPLATES.financeDoc = { templateId, actions: { homeowner } }`; `customerCitySrc`/`customerStateSrc`/`customerZipSrc`; `buildFinanceDocBody(proposal): object` (Zoho createdocument body).

- [ ] **Step 1:** Add the template to `ZOHO_SIGN_TEMPLATES`:

```ts
  financeDoc: {
    templateId: '563034000000106203', // tpr-fin-doc-single
    actions: { homeowner: '563034000000106215' },
  },
```

- [ ] **Step 2:** Verify the Homeowner action ordering: `pnpm tsx scripts/zoho-template-actions.ts 563034000000106203` → Homeowner must report `order=2` (matches the codebase's signing-order convention). If not, correct the action id / note the divergence.
- [ ] **Step 3:** Add granular field sources in `registry.ts` (mirror the existing `customerCityStateZipSrc`, same nullable fallbacks):

```ts
const customerCitySrc: FieldSource = ctx => ctx.proposal.customer?.city ?? ''
const customerStateSrc: FieldSource = ctx => ctx.proposal.customer?.state ?? 'CA'
const customerZipSrc: FieldSource = ctx => ctx.proposal.customer?.zip ?? ''
```

Export them (or the finance field-map) so the body builder can reuse them.
- [ ] **Step 4:** Body builder — construct the single-template createdocument body (mirror `assemble-envelope.ts` `buildMergeSendBody`'s `field_data`/`actions` shape, but as a plain object for `createFromTemplate`, one template, one signer):

```ts
// src/shared/services/providers/zoho-sign/lib/documents/build-finance-doc-body.ts
import type { ProposalWithCustomer } from '@/shared/entities/proposals/types'
import { formatPhone } from '@/shared/lib/phone'
import { ZOHO_SIGN_TEMPLATES } from '../../constants'

/** Zoho `templates/{id}/createdocument` body for the single-signer finance application. */
export function buildFinanceDocBody(proposal: ProposalWithCustomer): object {
  const c = proposal.customer
  const fieldTextData: Record<string, string> = {
    'ho-name': c?.name ?? '',
    'ho-email': c?.email ?? '',
    'ho-phone': formatPhone(c?.phone),
    'ho-address': c?.address ?? '',
    'ho-city': c?.city ?? '',
    'CA': c?.state ?? 'CA',
    'ho-zip': c?.zip ?? '',
  }
  return {
    templates: {
      field_data: { field_text_data: fieldTextData, field_boolean_data: {}, field_date_data: {} },
      actions: [
        {
          action_id: ZOHO_SIGN_TEMPLATES.financeDoc.actions.homeowner,
          action_type: 'SIGN',
          recipient_name: c?.name ?? '',
          recipient_email: c?.email ?? '',
          signing_order: 2,
        },
      ],
    },
  }
}
```

> Confirm the exact `field_data`/`actions` sub-shape against `assemble-envelope.ts` (lines ~213–225) and the `'CA'`/state field label against the actual template (`zoho-template-actions.ts` output). Zoho requires `recipient_email` non-empty for a quick-send — guard in the service (Task 3) so a customer with no email fails loudly, not silently at Zoho.

- [ ] **Step 5:** `pnpm tsc && pnpm lint`; commit (`feat(zoho): finance template constants + granular customer field sources + body builder`).

---

## Task 3: Service method + tRPC procedure

**Files:** Modify `src/shared/services/contracts.service.ts`, `src/trpc/routers/proposals.router/contracts.router.ts`

**Interfaces:**
- Consumes: `getFullView`, `proposalCrud.update`, `zohoSignClient.createFromTemplate`, `buildFinanceDocBody`, `ZOHO_SIGN_TEMPLATES`.
- Produces: `contractsService.sendFinanceApplication(ctx, proposalId): Promise<{ requestId: string }>`; `proposalsRouter.contracts.sendFinanceApplication` mutation.

- [ ] **Step 1:** Service method (mirror `sendContractEnvelope`'s resolve→act→persist shape; **no** contract-state guards — finance is independent):

```ts
async sendFinanceApplication(ctx: Ctx, proposalId: string): Promise<{ requestId: string }> {
  const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
  if (!proposal)
    throw new Error(`Proposal ${proposalId} not found`)
  if (!proposal.customer?.email)
    throw new Error('Customer has no email — cannot send finance application')

  const body = buildFinanceDocBody(proposal)
  const { requestId } = await zohoSignClient.createFromTemplate(
    ZOHO_SIGN_TEMPLATES.financeDoc.templateId,
    body,
    true, // quickSend — create-and-send in one call
  )

  dalVerifySuccess(await proposalCrud.update(ctx, {
    id: proposalId,
    data: { financeRequestId: requestId, financeSentAt: new Date().toISOString() },
  }))
  return { requestId }
}
```

(Match the actual `Ctx` type + imports used by the sibling methods in this file.)
- [ ] **Step 2:** tRPC procedure in `createContractsRouter(entity)`:

```ts
sendFinanceApplication: entity.authedProcedure
  .input(z.object({ proposalId: z.string() }))
  .mutation(async ({ ctx, input }) => contractService.sendFinanceApplication(ctx, input.proposalId)),
```

(Resend uses the SAME procedure — it always creates a fresh request and overwrites `financeRequestId`/`financeSentAt`.)
- [ ] **Step 3:** `pnpm tsc && pnpm lint`.
- [ ] **Step 4: Manual verification** (`pnpm dev`, a test proposal with a real customer email — use a Zoho sandbox/test recipient): trigger the mutation → Zoho returns a `request_id`; the proposal row gets `finance_request_id` + `finance_sent_at`; the recipient receives the finance application email. Trigger again → new request id overwrites (resend). Trigger on a **frozen** proposal → still works.
- [ ] **Step 5:** Commit (`feat(proposals): sendFinanceApplication quick-send procedure (agent-only, lock-independent)`).

---

## Task 4: `FinanceApplicationCard` + prop threading

**Files:** Create `src/shared/components/contract-status-panel/ui/finance-application-card.tsx`; Modify `agent-contract-view.tsx`, `contract-status-panel/types.ts`, `src/features/proposal-flow/ui/components/proposal/index.tsx`

**Interfaces:**
- Consumes: `financeRequestId`/`financeSentAt` (from the proposal full view), `trpc.proposalsRouter.contracts.sendFinanceApplication`, `useInvalidation().invalidateProposal`, `ActionButtonWithImpact`, `formatDate`.

- [ ] **Step 1:** The card — Send / "Sent {date}" + Resend (mirror `envelope-card.tsx`'s mutation+invalidate+toast + `ActionButtonWithImpact` usage):

```tsx
'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner' // match the toast lib used in envelope-card.tsx
import { Card } from '@/shared/components/ui/card'
import { formatDate } from '@/shared/lib/formatters'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'
import { ActionButtonWithImpact } from './action-button-with-impact'

interface FinanceApplicationCardProps {
  proposalId: string
  financeRequestId: string | null
  financeSentAt: string | null
}

export function FinanceApplicationCard({ proposalId, financeRequestId, financeSentAt }: FinanceApplicationCardProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const send = useMutation(trpc.proposalsRouter.contracts.sendFinanceApplication.mutationOptions({
    onSuccess: () => { invalidateProposal(); toast.success('Finance application sent') },
    onError: e => toast.error(e.message),
  }))

  const sent = Boolean(financeRequestId && financeSentAt)

  return (
    <Card className="p-5">
      <h3 className="font-semibold">Finance Application</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        {sent ? `Sent ${formatDate(financeSentAt!)}` : 'Send the homeowner a financing application to e-sign.'}
      </p>
      <div className="mt-4">
        <ActionButtonWithImpact
          variant={sent ? 'outline' : 'default'}
          impact="notifies"
          impactCopy="The customer will receive a Zoho Sign finance application email."
          label={sent ? 'Resend' : 'Send Finance Application'}
          loadingLabel="Sending…"
          isPending={send.isPending}
          onClick={() => send.mutate({ proposalId })}
        />
      </div>
    </Card>
  )
}
```

> Confirm `ActionButtonWithImpact`'s exact `impact` enum value + prop names against its definition (Task map: `variant`, `impact`, `impactCopy`, `label`, `loadingLabel`, `onClick`, `isPending`). Match the toast import + `Card`/`formatDate` paths to `envelope-card.tsx`.

- [ ] **Step 2:** Render it as a sibling in `agent-contract-view.tsx` (the `ProposalCard`/`EnvelopeCard` flex row — allow wrapping for a third card):

```tsx
<div className="lg:flex-1">
  <FinanceApplicationCard proposalId={proposalId} financeRequestId={financeRequestId} financeSentAt={financeSentAt} />
</div>
```

Add `financeRequestId`/`financeSentAt` to `AgentContractViewProps`.
- [ ] **Step 3:** Thread the props up the chain: `ContractStatusPanelProps` (`types.ts`) gains `financeRequestId?: string | null` + `financeSentAt?: string | null`; `ContractStatusPanel` passes them to `AgentContractView`; `proposal-flow/ui/components/proposal/index.tsx` passes `financeRequestId={proposalData.financeRequestId}` + `financeSentAt={proposalData.financeSentAt}` (alongside the existing `proposalStatus`/`proposalSentAt`/`customerName` props).
- [ ] **Step 4:** `pnpm tsc && pnpm lint`.
- [ ] **Step 5: Manual verification:** on a proposal's agreement/contract panel (agent view): the Finance Application card shows **Send**; after sending, it flips to "Sent {date}" + **Resend**; `invalidateProposal` refreshes the full view so the state updates without a manual reload. Homeowner/token view does NOT show the card (agent-only panel).
- [ ] **Step 6:** Commit (`feat(proposals): Finance Application card (send / sent / resend) in agent contract view`).

---

## Task 5: Docs + checklist

**Files:** Modify `src/shared/entities/proposals/DOCS.md`; the spec Feature 3 checklist

- [ ] **Step 1:** Add a `#finance-quick-send` rule to `proposals/DOCS.md`: agent-only single-template Zoho quick-send (`563034000000106203`), independent of the contract envelope + lock ladder; `financeRequestId`/`financeSentAt` are sent-only tracking (no viewed/signed lifecycle in v1); Resend overwrites. Note upgrade path: a Zoho webhook could later populate viewed/signed timestamps.
- [ ] **Step 2:** Tick Feature 3 items in `docs/superpowers/specs/2026-08-05-proposal-capabilities-media-portfolio-finance-design.md`.
- [ ] **Step 3:** `pnpm lint`; commit (`docs(proposals): finance quick-send rule + checklist`).

---

## Self-Review

**Spec coverage (Feature 3):** agent-only `sendFinanceApplication` via `createFromTemplate(..., quickSend=true)` → Task 3 ✅; all 7 fields pre-filled from customer columns + granular city/state/zip sources → Task 2 ✅; single Homeowner signer (`action_id 563034000000106215`) → Task 2/2.4 ✅; `financeRequestId` + `financeSentAt` (lifecycle, NOT lock-gated) → Task 1 ✅; Finance card with Send/Sent/Resend → Task 4 ✅; independence from the contract envelope → no contract-state guards in Task 3 ✅.

**Placeholder scan:** none. Flagged confirmations are "match the sibling file/definition" checks (toast lib, `Ctx` type, `ActionButtonWithImpact` props, Zoho body sub-shape, state field label), each with the concrete reference to check against — not deferred work.

**Type consistency:** `sendFinanceApplication` (service + procedure), `buildFinanceDocBody`, `ZOHO_SIGN_TEMPLATES.financeDoc.{templateId,actions.homeowner}`, `financeRequestId`/`financeSentAt` (schema → `ProposalWithCustomer` → `ContractStatusPanelProps` → `AgentContractViewProps` → `FinanceApplicationCardProps`), `createFromTemplate(templateId, body, quickSend)` → `{ requestId }` — consistent end to end.

**Risk controls:** additive columns only (`--dry-run` gated); `frozenProposalLockedFields` explicitly left unchanged (Task 1 Step 2) so lock independence holds; empty-email guard prevents a silent Zoho failure; Resend reuses the same idempotent-ish send (always a fresh request id); agent-only procedure keeps homeowners out.
