# Proposal/Contract Independence + Synchronous Draft Creation

Proposal lifecycle and Zoho-Sign contract lifecycle are independent concerns that happen to share a row on `proposals`; the "Send Proposal" action is a one-shot trigger that prepares a draft envelope as its first step, never an ongoing coupling. We removed the QStash `syncContractDraftJob` indirection because Zoho's `mergesend` / `createFromTemplate` returns the `request_id` synchronously — there was nothing genuinely async to defer, and the indirection introduced an inferred "draft syncing" state that the UI tracked through fragile heuristics (`proposal.status === 'sent' && !contractStatus → assume QStash is creating a draft, poll forever`). That inference broke the moment an agent manually discarded a draft or recalled an in-progress envelope, leaving the envelope card stuck in an infinite spinner.

## Context

The agreement section is already split into two independent cards — `ProposalCard` (the customer's in-app review document) and `EnvelopeCard` (the Zoho Sign signing package). Each card's source comment states `"Acting on one card never affects the other"`. The architecture's stated intent was independence.

The actual implementation violated that intent through `delivery.router.ts:sendProposalEmail`, which dispatched a QStash job (`syncContractDraftJob`) as a side-effect. The job called `contractService.ensureDraftSynced`, which deleted any existing Zoho draft and created a fresh one — coupling proposal send to contract creation through an async fire-and-forget pipe with no UI feedback channel.

This created two related problems:

1. **An invisible coupling.** `sendProposalEmail` returned in ~2s, but the proposal's draft envelope state was being mutated for the next 3-8s in the background. The agent had no visibility into success or failure.
2. **A fragile UI state signal.** `useContractStatus` inferred "draft is being created" from `proposalStatus === 'sent' && !contractStatus`. That heuristic held on the QStash-dispatch path but broke after any code that legitimately cleared `signingRequestId` (discard, recall) — the polling code would see `isSent && !data`, conclude "must be syncing", and loop forever until the polling cap (MAX_DRAFT_POLL_ATTEMPTS = 10) gave up several minutes later. During the window, the "Create Draft" CTA was suppressed and the agent could not recover the envelope without a page refresh.

The premise that motivated QStash — "draft creation is slow on our side, push it off the request path" — was incorrect. Zoho's API returns the `request_id` synchronously on the first HTTP response (verified live in `assemble-envelope.ts:97`); the actual envelope materialization runs on Zoho's servers, not ours. From our side, draft creation is a single ~1-3s POST plus optional attach/reorder calls (a further 1-3s combined). Total inline cost: 3-9s — slow enough to warrant feedback but well within "explicit user action waits for confirmation" territory.

## Decision

1. **Delete `syncContractDraftJob` and `ensureDraftSynced`.** Remove the QStash dispatch from `sendProposalEmail`. The proposal-email mutation is narrowed to its real responsibility: send the email, mark `status='sent'`, derive meeting outcome.
2. **Client-orchestrate the "Send Proposal" action.** A new hook `useSendProposalWithDraft` calls two existing mutations sequentially: first `createContractDraft` (idempotent on `signingRequestId` presence), then `sendProposalEmail`. The UI shows honest two-stage progress because each stage maps 1:1 to a real network call.
3. **Treat each card's mutations as belonging to one domain.** `ProposalCard` owns proposal-side mutations; `EnvelopeCard` owns envelope-side mutations. The send-flow's draft-prep step is the *only* cross-card linkage and it's an explicit, one-time trigger from the client, not a server-side side-effect.
4. **Strip the inferred sync state.** `useContractStatus` no longer takes `isSent`, no longer carries a `draftPollCountRef`, no longer polls in the "no contract data" branch. It polls only when an envelope is in `inprogress` — i.e., for signing-lifecycle transitions. The `isDraftSyncing` prop and `EnvelopeStateDraftSyncing` component are deleted entirely.

## Consequences

**Positive:**

- The proposal/contract independence stated in the card comments is now real. Mutations on one card never silently affect the other.
- The UI cannot get stuck in a phantom "syncing" state after discard or recall — the state machine has fewer branches and every observable state is one the UI knows how to render.
- "Send Proposal" gives honest progress feedback. The agent sees two checkmarks land in 3-9s instead of a fast misleading 2s success with hidden background work.
- Failures surface immediately. If Zoho rejects the draft creation, the agent sees the error inline and retries — there's no silent QStash retry chain that the agent can't observe.
- Significantly less code: one job file, one service method, one UI component, one ref-counter polling branch, one prop chain — all deleted. The system is smaller and easier to reason about.

**Negative:**

- "Send Proposal" mutation latency increases from ~2s to ~3-9s. Mitigated by the staged progress panel, which keeps the agent oriented during the wait.
- No automatic retry on transient Zoho failures. We accept this — silent QStash retries were the source of the very bug this ADR fixes. Manual retry on visible failure is better UX for a low-volume, high-intent action.
- If the email send fails *after* draft creation succeeds, the proposal isn't marked sent but a Zoho draft exists. This is a perfectly recoverable UI state (envelope is visible on Card 2, "Send Proposal Email" remains available) — clicking again is idempotent thanks to `createSigningRequest`'s existing `if (proposal.signingRequestId) return existing` guard.

## Anti-patterns to avoid

- **Do not** re-introduce server-side side-effects on `sendProposalEmail` that mutate envelope state. Any future "auto-prepare envelope on send" feature must orchestrate client-side or expose a separate explicit mutation.
- **Do not** infer envelope state from proposal-lifecycle signals (`proposal.status`, `proposal.sentAt`). The two lifecycles are independent. If you find yourself writing `if (isSent && !contractStatus)`, stop — that's the exact pattern this ADR retires.
- **Do not** add a new QStash job for draft-creation retry. If you need retry, do it explicitly inside the synchronous mutation with bounded attempts and surface failures to the UI.

## See also

- `src/shared/entities/proposals/DOCS.md#proposal-contract-independence`
- `src/shared/entities/proposals/DOCS.md#agreement-context-as-coherent-unit`
- `src/features/proposal-flow/dal/client/mutations/use-send-proposal-with-draft.ts` (the orchestrator)
- `src/shared/components/contract-status-panel/ui/send-proposal-progress.tsx` (the honest staged UI)

## Amendment 2026-05-27 — Cross-entity orchestration: client vs. tRPC procedure

This ADR's original framing was: "cross-entity coupling that exists for a specific UX flow lives in the client orchestrator." A subsequent refactor (agreement-context editing — see `applyEnvelopeContext`) clarified that this rule has a real exception worth naming.

**The principle (refined):**

- **Default — client orchestration.** When a UX flow ties together two independent server operations that each carry their own auth boundary, the client orchestrates two narrow mutations. Example: `useSendProposalWithDraft` calls `createContractDraft` (proposal-side, agent-authed) then `sendProposalEmail` (proposal-side, agent-authed). Each procedure stays single-purpose; the client owns the choreography.

- **Exception — tRPC procedure orchestrates** when **a single tokenized auth gate is the right unit**. The customers entity does not carry its own share-token; access to a customer is granted *through* the proposal's token. So a homeowner-facing mutation that needs to write a customer field (age) and reconcile a proposal field (envelope docs) cannot decompose into two procedures without doubling the auth surface and the network calls. `applyEnvelopeContext` lives on the proposals router (where the token belongs) and writes to both entities atomically, in one tokenized call.

- **Anti-pattern (retired).** The old `customersRouter.submitCustomerAge` was a hand-rolled `publicProcedure` that manually validated a *proposal* token to allow writing a *customer* field. It belonged on neither router clearly and grew a cross-entity side-effect (envelope-doc reconciliation). The retirement is: cross-entity writes that share a single tokenized auth gate live on the entity that *carries* the token, named to make the cross-entity scope obvious (e.g., `applyEnvelopeContext`, not `setCustomerAge`).

**Lock invariant** *(amended 2026-07-18, #264 — see below)*: `applyEnvelopeContext` refuses to mutate once the contract has been sent (`isProposalFrozen` — `contractSentAt != null`). Originally the lock keyed on `signingRequestId != null` (any envelope, including draft); that froze every sent proposal, because "Send Proposal" pre-creates a draft envelope as its first step. The draft window is now editable, with staleness prevented at the send boundary instead: `sendSigningRequest` deletes the stale draft and reassembles the envelope from live proposal state before submitting. To edit after sending, the agent must explicitly recall — the same explicit unlocking gesture as everywhere else on the contracts router.

## Amendment 2026-05-28 — Retire the legacy single-template path

`contractService.createDraft` previously branched on `formMetaJSON.envelopeDocumentIds.length`:

```
selection.length > 0  → registry path (mergesend, kind-aware)
selection.length === 0 → legacy path (createdocument, age-only)
```

The legacy path used `buildSigningRequest`, which picked a tpr-HI template purely from `customer.customerAge >= 65` and **never inspected `proposal.kind`**. Any additional-work proposal whose `envelopeDocumentIds` happened to be empty (pre-Phase-5 proposals AND any new proposal where the agent clicked "Create Draft" before engaging the configuration UI) silently shipped a tpr-HI envelope instead of the AWD envelope the registry would have built.

The fix: delete the legacy branch entirely. The registry path's `assembleEnvelope` already self-heals — it computes the effective document set via `evaluateDocuments(ctx)` at assembly time, so empty / stale / forbidden selections produce the correct envelope for any (kind, age, isLongSow) combination. There is nothing the legacy path did that the registry didn't do better and kind-aware.

Deleted in this amendment:
- `services/providers/zoho-sign/lib/build-signing-request.ts`
- `zohoSyncService.createLegacyDraft`
- The `if (selection.length > 0)` branch in `contractService.createDraft`
- Three orphan diagnostic scripts that exercised the legacy path

**Anti-pattern (formalized):** template selection that branches on a *single* dimension (age) when the business rule depends on *multiple* dimensions (kind, age, SOW length). The registry's per-doc `applicableKinds` + `perKindRules` is the only allowed shape for envelope-content decisions.

## Amendment 2026-07-18 — Freeze at contract-send, rebuild at send (#264)

Wave-2 smoke drives surfaced that both freeze gates (`replaceProposalIncentives`'s
`proposal_frozen` and `applyEnvelopeContext`'s lock) keyed on
`signingRequestId != null` — but the "Send Proposal" orchestration (this ADR's own
`useSendProposalWithDraft` pattern) creates a Zoho **draft** envelope as stage 1, so every
sent proposal was frozen before any contract went out. The ratified business rule:
financials and agreement context freeze **iff the contract has been sent** — envelope
exists AND beyond Zoho draft status.

- **Canonical predicate**: `isProposalFrozen` (`entities/proposals/lib/is-proposal-frozen.ts`)
  — `contractSentAt != null`, the persisted proxy for "beyond draft" (stamped only by
  `sendSigningRequest`/`resendSigningRequest`, cleared on recall/discard). Zoho envelope
  status is deliberately NOT persisted; a live status check inside a DAL gate would add an
  external call and violate the ACL boundary.
- **Staleness inversion**: the old draft-stage lock existed to keep the pre-assembled
  envelope's documents from drifting against edits. That protection moved to the send
  boundary: `sendSigningRequest` deletes the stale draft, reassembles from live proposal
  state (`createDraft` self-heals), and submits — the sent contract always matches current
  data, and the draft window is freely editable. Zoho drafts cost 0 credits.
- **Decline semantics** (ratified): declined contracts keep `contractSentAt` and stay
  frozen. There is deliberately no thaw path for a declined contract — renegotiation
  happens on a new proposal.
