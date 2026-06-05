# Proposals — Business Rules

A **Proposal** is a quoted scope-of-work delivered to a customer for review and optional e-signature. Customer (1) → Meeting (many) → Proposal (many). Approval is the only legal trigger for Project creation.

This directory holds: schemas (`schemas/`), types (`types.ts`), enum constants and action configs (`constants/`), computed-value helpers + server spec (`lib/`), CRUD + business DAL (`dal/server/`), action-config hooks (`hooks/`), and reusable components (`components/`). The server spec at `lib/server-spec.ts` is consumed by `src/trpc/routers/proposals.router/`.

## Lifecycle

```
   draft  ──►  sent  ──►  approved  ──►  (project created automatically)
                │
                ├── contractSentAt        (Zoho envelope out)
                ├── contractViewedAt      (Zoho webhook: viewed)
                ├── contractSignedAt      (Zoho webhook: completed → auto-approves)
                └── contractDeclinedAt    (Zoho webhook: declined — status unchanged)

   declined                (terminal; agent recovers manually if relevant)
```

`status` has four values: `draft | sent | approved | declined`. Contract events are separate timestamp columns (not status values) — set by Zoho Sign webhooks independent of status.

Status transitions are convention-enforced in handlers; no DB CHECK constraint guards illegal transitions. The DB enforces one critical invariant: **at most one approved `initial-sale` proposal per meeting** (unique index — see `#one-approved-initial-sale-per-meeting`).

## Rules

### kind-derived-from-meeting-project

`proposal.kind` is `'initial-sale'` if the meeting has no project at insert time, `'additional-work'` if it does. Server-derived from `meeting.projectId` — never accepted as client input.

**Why**: kind is an aggregate of project linkage; agents can't pick it independently of the meeting's project state without drift.
**Reference impl**: `lib/derive-proposal-kind.ts`, applied in `lib/server-spec.ts:hooks.create.before`
**Enforced by**: `insertProposalSchema.omit({ kind: true })` + server derivation

### kind-frozen-after-insert

Once set at insert, `kind` is never re-derived. If the meeting later acquires a `projectId` (because an initial-sale on the same meeting was approved and minted a project), existing proposals keep their original `kind`.

**Why**: every project is anchored by the proposal that minted it (one `initial-sale`) plus N `additional-work` proposals; re-deriving would silently reclassify history.
**Reference impl**: `lib/derive-proposal-kind.ts`; the spec excludes `kind` from update path
**Enforced by**: convention (no update handler touches `kind`)

### share-token-generated-at-insert

Every proposal gets a unique share token at insert: `tpr-{16 random hex}`. Stored on `proposals.token`. Tokens are permanent — never rotated, never expired.

**Why**: a customer needs to view their proposal without logging in; the token IS the authorization for that read. Permanence means the URL emailed once stays valid.
**Reference impl**: `lib/server-spec.ts:hooks.create.before` (generation); `lib/server-spec.ts` (`shareable.tokenColumn`)
**Enforced by**: server-derived; `token` omitted from `insertProposalSchema`

### sow-snapshot-from-meeting-on-create

When creating a proposal, if the meeting has `flowStateJSON.tradeSelections` and the input has no existing SOW, the create handler snapshots trade selections into `projectJSON.data.sow`. After creation, the SOW is independent of the meeting's trade selections.

**Why**: the agent's meeting-time scope picks should flow into the proposal as a starting point — but the proposal is the contract; once authored, it can't be retroactively re-driven by the meeting state.
**Reference impl**: `lib/server-spec.ts:hooks.create.before` (reads meeting via `meetingCrud.getById`, snapshots tradeSelections)
**Enforced by**: convention

### shareable-via-token

A proposal can be read AND updated by an unauthenticated client via `?token=<shareToken>`. The `shareableMiddleware` resolves token-or-session and sets `ctx.scope = eq(proposals.token, token)` on the token path. CASL is `null` on token path — token IS authorization.

**Why**: customer e-signature flow + finance-option selection both require unauthenticated read/update. Treating token as scope means the DAL is unchanged from the authed path.
**Reference impl**: `lib/server-spec.ts:shareable`
**Enforced by**: `shareableMiddleware` (entity toolkit); see ADR-0002 §4 and [`../../trpc/DOCS.md`](../../trpc/DOCS.md) (when written)

### visibility-via-meeting-participation

Non-omni agents see a proposal only if they participate in the proposal's meeting (any role). Super-admins (`ability.can('manage', 'all')`) bypass scoping — caller passes `ctx.scope = null`.

**Why**: the meeting is where the customer relationship is owned; proposals inherit visibility from there. `ownerId` is the author, not the gate.
**Reference impl**: `lib/visibility.ts` → `userParticipatesInMeeting`
**Enforced by**: `scopeMiddleware(proposalServerSpec)` on every entity procedure

### one-approved-initial-sale-per-meeting

DB unique index `proposals_one_approved_initial_sale_per_meeting_idx` enforces: at most one row per `meetingId` where `kind = 'initial-sale' AND status = 'approved'`. Many draft/sent initial-sales coexist freely.

**Why**: by induction from `#kind-derived-from-meeting-project`, all initial-sales for a project live on the project's birthing meeting (the earliest meeting linked to it). Per-meeting uniqueness transitively enforces "at most one approved initial-sale per project" — the real business invariant.
**Reference impl**: `src/shared/db/schema/proposals.ts` (index)
**Enforced by**: Postgres (duplicate insert fails)

### conversion-trigger

When `status` transitions to `approved`, a Project is created automatically and the meeting's outcome is set to `converted_to_project`. The `converted_to_project` outcome is **derived, never selectable** in the meeting outcome dropdown — it appears but is disabled.

**Why**: a project represents a signed contract. Without an approved proposal there's no contract. Manual selection would create projects without contractual basis.
**Reference impl**: approve handler in `src/trpc/routers/proposals.router/business.router.ts`; see also `../projects/DOCS.md` and `../meetings/DOCS.md`
**Enforced by**: convention + disabled UI option

### jsonb-merge-on-update

`formMetaJSON`, `projectJSON`, `fundingJSON` deep-merge on update — never replaced. The spec declares which columns merge.

**Why**: forms submit partial state across multi-step flows; replacement would wipe prior steps.
**Reference impl**: `lib/server-spec.ts:update.jsonbMergeColumns`
**Enforced by**: `createCrudDal.updateImpl` reads `spec.update.jsonbMergeColumns` and applies a `COALESCE(col, '{}'::jsonb) || $value::jsonb` deep-merge

### final-tcp-derived

The final contract price is computed from `fundingJSON.data`:

```
finalTcp = max(0, startingTcp − Σ discount-typed incentives)
```

Only `discount`-typed incentives reduce TCP; `exclusive-offer` incentives are informational and don't affect price. In `breakdown` pricing mode the form syncs `startingTcp = Σ sectionPrices + miscPrice` before saving, so the helper is pricing-mode-agnostic.

**Never persisted.** Always re-derive at read time. SQL filter/sort on price uses a Drizzle `sql<number>` expression that mirrors the helper exactly.

**Why**: line-item edits would silently invalidate a stored TCP. Single source of truth; SQL mirror keeps server-side filtering correct.
**Reference impl**: `lib/compute-final-tcp.ts` (JS); `dal/server/queries.ts:listProposals` `finalTcpExpr` (SQL mirror)
**Enforced by**: convention (no `final_tcp` column exists; field was removed from `fundingDataSchema` in commit `a6c431e`)

### cslb-start-date

Project start date must respect the California Civil Code §1689.6/§1689.7 rescission window:

- 3 business days for standard contracts; 5 for senior contracts (buyer ≥65)
- "Business day" excludes Sundays only (Saturdays count; named federal holidays are *not* currently excluded — intentional simplification; see helper docstring for the trade-off)
- Window starts the day **after** signing (signing day is Day 0)
- Earliest legal start = next calendar day after the Nth business day

**Why**: starting work before the rescission window expires creates legal liability under Cal. B&P Code §7159.
**Reference impl**: `lib/cslb-start-date.ts:cslbEarliestStartDate`
**Enforced by**: convention (helper must be called wherever start date is computed)

### contract-events-from-zoho

Zoho Sign webhooks deliver `operation_type` strings mapped to three internal events: `viewed`, `completed`, `declined`. The mapper handles Zoho's docs-vs-actual divergence (docs say `RequestCompleted`; actual payload says `RequestSigningSuccess` — both accepted). Unrecognized operations are no-oped.

**`completed` is derived, never assumed.** `RequestSigningSuccess` fires once **per signer**, not once per envelope. On a two-party envelope (Contractor + Homeowner) Zoho emits it when the contractor signs while the homeowner is still pending — so the op alone only means "a signing happened." The sync job therefore fetches the live envelope and requires **every** signer role to be `SIGNED` (`isEnvelopeFullySigned`) before stamping `contractSignedAt` / auto-approving / notifying. A non-terminal signing is a no-op: `contractSignedAt` stays null, and the read path keeps surfacing live per-signer progress until all parties sign. The envelope's own `actions` define the required set, so single-signer (Homeowner-only) envelopes complete on the first signing as expected.

> Historical note: the 2026-05-04 single-signer live test couldn't observe the per-signer behavior (one signer ⇒ `RequestSigningSuccess` and envelope-completion coincide). The premature-completion bug surfaced only on Contractor + Homeowner envelopes.

**Reference impl**: `lib/contract-events.ts:mapZohoOperationToContractEvent`, `lib/contract-events.ts:isEnvelopeFullySigned`, `services/providers/upstash/jobs/sync-zoho-sign-status.ts`
**Enforced by**: convention (contracts service routes all webhook ops through this mapper; the sync job gates `completed` on `isEnvelopeFullySigned`)

### contract-event-idempotency

Each contract event has a fixed idempotency policy:

| Event | Policy | Rationale |
|---|---|---|
| `viewed` | earliest-wins | first view is meaningful; later views are noise |
| `completed` | write-once | terminal; duplicate delivery = Zoho retry, not real second action |
| `declined` | write-once | terminal; same reasoning |

**Reference impl**: `lib/contract-events.ts:contractEventIdempotencyPolicy`
**Enforced by**: contracts service applies the policy before write

### completed-auto-approves

A `completed` contract event auto-promotes proposal status to `approved` and stamps `approvedAt` (matching the manual approval flow). `declined` does **not** flip status — agent intervention is expected.

**Why**: customer-initiated declines are rare and usually recoverable in conversation; auto-flipping creates stale "declined" rows the agent can't easily resurrect. Approval is the trigger for project creation (see `#conversion-trigger`), so auto-approve closes the loop on signing.
**Reference impl**: `lib/contract-events.ts:shouldAutoApproveOnContractEvent`
**Enforced by**: contracts service consumes this flag

### margin-multiplier-tiers

Per-section and proposal-level margin (`price − cost − incentives`) and multiplier (`price ÷ cost`) drive a 4-tier color classification used across cost-related UI:

| Tier | Threshold | Meaning |
|---|---|---|
| `danger` | multiplier `< 2×` | below break-even safety margin |
| `healthy` | `2×` to `3×` | standard residential remodeling range |
| `excellent` | `≥ 3×` | strong margin |
| `unknown` | no cost data | no signal |

Cost helpers return `null` (not 0) when cost data is incomplete — distinguishes "not tracked" from "actually zero."

**Why**: the tier system is used in multiple UI surfaces; a single classification keeps colors aligned with reality.
**Reference impl**: `lib/compute-sow-financials.ts` (`classifyMultiplierTier`), `lib/compute-proposal-cost-totals.ts`
**Enforced by**: convention

### cost-data-asymmetric-incomplete

`hasMissingCostData` flags **asymmetric** incompleteness: true only when some sections have cost lines and some don't (agent started tracking but didn't finish). False when no sections have cost lines (haven't started) or all do (finished).

**Why**: prevents alert fatigue in total-mode proposals where cost lines are optional. We only nag when the data is in a partial state.
**Reference impl**: `lib/compute-proposal-cost-totals.ts`
**Enforced by**: convention

### agreement-context-as-coherent-unit

Customer age (`customer.customerProfileJSON.age`) and the envelope-document selection (`proposal.formMetaJSON.envelopeDocumentIds`) together form *the agreement context* — the set of inputs that determine what the Zoho Sign envelope will contain. Age is the source of truth; the document registry classifies every doc as required, optional, or forbidden for a given age + proposal kind. The selection is reconciled against age automatically on every change.

- **Single procedure**: `proposalsRouter.contracts.applyEnvelopeContext({ id, token?, age?, envelopeDocumentIds? })` is the only writer for these two fields. Either input is optional; at least one must be present. Server reconciles the saved selection against the (possibly just-applied) age before persisting.
- **Reconciliation is silent**: on age change, required docs are auto-added and forbidden docs are auto-dropped from the saved selection without surfacing notifications. The reconciled result is returned to the caller so the UI can render it immediately.
- **Lock**: refuses to apply while `proposal.signingRequestId != null`. Any envelope (draft, in-progress, terminal) freezes the agreement context. To edit, the agent must discard/recall/recreate.
- **Auth**: shareable procedure — agent (session) and homeowner (proposal token) drive the same writes. The customers entity does not carry its own token; the proposal's token gates writes to the customer-age field through this procedure.

**Why this lives on the proposals router and not the customers router**: the share-token belongs to the proposal. A homeowner can only authenticate against the proposal entity. Routing the customer-age write through the proposal's shareable procedure (with `customerCrud.update` doing the actual single-row write inside) keeps each entity's CRUD pure while exposing a single coherent tokenized surface for the cross-entity update. The retired `customersRouter.submitCustomerAge` violated this by manually re-implementing token validation on the customers router and growing into a cross-entity orchestrator.

**Reference impl**: `src/trpc/routers/proposals.router/contracts.router.ts:applyEnvelopeContext` + `src/shared/services/providers/zoho-sign/lib/documents/evaluate.ts:reconcileEnvelopeSelection` (pure helper).
**Enforced by**: server-side lock check + `validateEnvelopeSelection` safety net after reconciliation. ADR-0004 (with 2026-05-27 amendment) documents the rationale.

### proposal-contract-independence

The proposal lifecycle (`status`, `sentAt`, `approvedAt`) and the contract lifecycle (`signingRequestId`, `contractSentAt`, `contractViewedAt`, `contractSignedAt`, `contractDeclinedAt`) are independent. They share a database row for storage convenience, not for coupling. Mutations on one set never derive state for the other.

- **Sending the proposal email** updates only proposal-side columns. It does NOT create, refresh, or touch the Zoho Sign envelope.
- **Creating / discarding / recalling an envelope** updates only contract-side columns. It does NOT change `proposal.status` or `sentAt`.
- The agent UI exposes this as two cards (`ProposalCard`, `EnvelopeCard`) with their own actions; the "Send Proposal" action client-orchestrates a one-shot draft preparation before sending the email, but the orchestration lives on the client (see `features/proposal-flow/dal/client/mutations/use-send-proposal-with-draft.ts`), not as a server-side side-effect.
- Draft creation is **synchronous** — Zoho returns the `request_id` on the create call, so there is no async gap to bridge with QStash or a polling-based "in-flight" signal. The previous `syncContractDraftJob` was removed for this reason.

**Why**: prior implementation dispatched a QStash job from `sendProposalEmail` to auto-create a draft. The async coupling forced the UI to infer "a draft is being created" from `proposal.status === 'sent' && contractStatus == null` — a heuristic that broke immediately after any code path legitimately cleared `signingRequestId` (discard, recall), leaving the UI stuck in an unrecoverable spinner state.

**Reference impl**: `delivery.router.ts:sendProposalEmail` (proposal-only), `contracts.router.ts:createContractDraft` / `discardDraftContract` / `recallContract` (contract-only), `use-send-proposal-with-draft.ts` (client orchestrator), `use-contract-status.ts` (polls only for `inprogress` signing-lifecycle events).
**Enforced by**: architectural discipline — no shared service writes both column sets in one call. ADR-0004 documents the rationale.

### duplicate-resets-and-redrives

Duplicating a proposal: status resets to `draft`, ownership reassigns to the current user, token + kind are freshly server-derived via `hooks.create.before` (which fires automatically because duplicate routes through `createImpl`). Only the JSONB content (`formMetaJSON`, `projectJSON`, `fundingJSON`) and `financeOptionId` / `meetingId` are copied via `spec.duplicate.exclude` + `spec.duplicate.overrides`.

**Why**: a duplicate is "start a new proposal from this template," not "clone." Server-derivation prevents the duplicate from inheriting stale state (wrong kind if the meeting has changed projects, an existing-but-disclosed share token, etc.).
**Reference impl**: `lib/server-spec.ts:duplicate` (exclude + overrides config); `lib/server-spec.ts:hooks.create.before` (kind + token derivation fires on every create, including duplicates)
**Enforced by**: declarative duplicate config on the spec

## Anti-patterns

- **Inferring contract state from proposal-lifecycle signals.** `proposal.status === 'sent'` says nothing about envelope state. If your code reads like `if (isSent && !contractStatus) → assume sync in flight`, stop — that's exactly the bug ADR-0004 retires. Treat proposal and contract lifecycles as independent (`#proposal-contract-independence`).
- **Re-introducing server-side side-effects on `sendProposalEmail` that touch envelope state.** The QStash auto-dispatch was deleted for cause. Any future "auto-prepare envelope" feature must be client-orchestrated or a separate explicit mutation.
- **Branching envelope content on a single dimension (age alone).** The retired `buildSigningRequest` picked tpr-HI base/senior purely from `customer.customerAge >= 65`, which silently shipped tpr-HI envelopes for additional-work proposals (which should ship AWD). All envelope-content decisions must flow through the registry's `applicableKinds` + `perKindRules` (multi-dimensional: kind × age × isLongSow). See ADR-0004 amendment 2026-05-28.
- **Storing `finalTcp`.** Always derive via `computeFinalTcp` — see `#final-tcp-derived`.
- **Setting `kind` from client input.** Server-derived; omitted from insert/update schemas.
- **Replacing `formMetaJSON` / `projectJSON` / `fundingJSON` on update.** They deep-merge — see `#jsonb-merge-on-update`.
- **Adding a CASL check on the share-token path.** Token IS authorization; CASL is `null`.
- **Setting `converted_to_project` meeting outcome manually.** Derived from proposal approval.
- **Computing project start date by adding 3 calendar days to signing.** Use `cslbEarliestStartDate(signingDate, isSenior)` — Sundays don't count.
- **Re-deriving `kind` when `meeting.projectId` changes.** Frozen at insert.
- **Trusting `proposal.token` as a secret.** It's a URL-safe ID, not a password — anyone with the URL has access. Don't append authority beyond proposal read/update.

## See also

- ADR-0002 — Entity Server System (server spec, scope/shareable middleware)
- ADR-0004 — Proposal/Contract Independence + Synchronous Draft Creation
- [`../../trpc/DOCS.md`](../../trpc/DOCS.md) — tRPC procedures, `shareableMiddleware`, `createCrudRouter` (when written)
- [`../customers/DOCS.md`](../customers/DOCS.md) — phone-visibility threshold gates on the `sent`-or-later proposal lifecycle (when written)
- [`../meetings/DOCS.md`](../meetings/DOCS.md) — meeting outcome `converted_to_project` is set by proposal approval (when written)
- [`../projects/DOCS.md`](../projects/DOCS.md) — project creation triggered by approval; one project per birthing meeting (when written)
- `docs/proposal/creation-guide.md` — sales-side proposal authoring playbook
- `docs/proposal/scope-presentation.md` — SOW UX
- `docs/proposal/financing-presentation.md` — financing UX
- `docs/codebase-conventions/dal-conventions.md` — `DalReturn<T>` + `ScopedContext` pattern used in this entity's DAL
