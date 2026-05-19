# Contract Service Decomposition — Handoff

> Decompose the monolithic `contracts.service.ts` into two composable services: an internal business orchestrator and an external Zoho Sign sync service.

## The Insight

`contracts.service.ts` conflates two responsibilities:

1. **Contract business orchestration** — draft lifecycle (create, send, recall, resend, sync), webhook event processing (idempotency, auto-approve), status queries. Domain-level logic that would exist regardless of signing provider.

2. **Zoho Sign API integration** — auth headers, HTTP calls, template creation, file attachment, request submission. Provider-specific plumbing that changes if we switch to DocuSign, in-house generation, etc.

## Target Architecture

```
contracts.service.ts (internal, business logic)
    │
    ├── calls zoho-sync.service.ts (external, Zoho Sign API)
    ├── calls pdf.service.ts (PDF generation)
    └── calls DAL (proposal reads/writes via proposalCrud, getFullView, etc.)
```

### `contracts.service.ts` — Internal Business Orchestrator

Keeps: `createSigningRequest`, `sendSigningRequest`, `recallSigningRequest`, `resendSigningRequest`, `ensureDraftSynced`, `applyContractEvent`, `getSigningStatus`

These methods contain the business logic: read proposal state → decide what to do → call external service → write result. The Zoho-specific HTTP calls move out; the decision-making stays.

### `zoho-sync.service.ts` — External Zoho Sign Integration

Receives: auth/HTTP layer + Zoho-specific operations

```ts
export function createZohoSyncService() {
  return {
    /** Create a draft signing request from a template (0 credits) */
    createDraftFromTemplate(templateId, body): Promise<{ requestId, status }>

    /** Submit an existing draft for signing (costs credits) */
    submitForSigning(requestId): Promise<void>

    /** Recall (cancel) an in-progress signing request */
    recallRequest(requestId): Promise<void>

    /** Delete a draft or recall+delete an in-progress request */
    deleteRequest(requestId): Promise<boolean>

    /** Attach files to an existing draft */
    addFilesToRequest(requestId, files): Promise<void>

    /** Get current signing status + signer details */
    getRequestStatus(requestId): Promise<ZohoContractStatus>
  }
}
```

Pure HTTP — no `ScopedContext`, no DAL, no business logic. This service talks to Zoho and returns typed results. `contracts.service.ts` is the only consumer.

## What Already Exists in `services/zoho-sign/`

```
zoho-sign/
  constants.ts              — ZOHO_SIGN_BASE_URL, template IDs
  types.ts                  — ZohoContractStatus, ZohoRequestStatus
  lib/
    get-access-token.ts     — getZohoAccessToken() (OAuth refresh)
    build-signing-request.ts — buildSigningRequest(proposal, opts)
    dedupe-signer-statuses.ts
    is-long-sow.ts
  documents/
    registry.ts             — ENVELOPE_DOCUMENTS rules
    evaluate.ts             — evaluateDocuments + validateEnvelopeSelection
    assemble-envelope.ts    — multi-template merge+send (has its own HTTP calls)
    proposal-context.ts     — buildProposalContext
    types.ts                — ProposalContext interfaces
```

`get-access-token.ts` and the constants are already extracted. The `zoho-sync.service.ts` would live alongside these, consolidating the HTTP layer. `assemble-envelope.ts` also has direct Zoho HTTP calls (its own `addFilesToRequest` copy at line 387) — it should be updated to use `zohoSyncService` too.

## Current Consumers of `contracts.service.ts`

| Caller | Methods used |
|--------|-------------|
| `contracts.router.ts` | `createSigningRequest`, `sendSigningRequest`, `recallSigningRequest`, `resendSigningRequest`, `getSigningStatus` |
| `sync-zoho-sign-status.ts` (job) | `applyContractEvent` |
| `sync-contract-draft.ts` (job) | `ensureDraftSynced` |
| `scripts/verify-long-path.ts` | `createSigningRequest` |
| `scripts/verify-short-path.ts` | `createSigningRequest` |

**None of these change.** The `contracts.service.ts` API surface stays identical. The decomposition is internal — `contracts.service` calls `zohoSyncService` instead of inlining HTTP calls.

## Migration Checklist

1. **Create `src/shared/services/zoho-sync.service.ts`** — extract HTTP methods from `contracts.service.ts`: `getAuthHeader`, `jsonRequest`, `createFromTemplate`, `deleteRequest`, `addFilesToRequest`, `parseDraftResponse`. Export as `zohoSyncService` singleton.

2. **Update `contracts.service.ts`** — import `zohoSyncService`, replace inline HTTP calls with service calls. The business logic (read proposal → decide → call zoho → write result) stays.

3. **Update `assemble-envelope.ts`** — its `addFilesToRequest` duplicate (line 387) should call `zohoSyncService.addFilesToRequest` instead.

4. **Verify** — `pnpm tsc` + `pnpm lint` clean. No API surface change for consumers.

## Service Layer Conventions

Services are **composable grouped business logic**:

- **Named for what they do** — `contracts.service` (contract orchestration), `zoho-sync.service` (Zoho Sign API sync), `pdf.service` (PDF generation)
- **Composable** — services call other services. `contracts.service` → `zoho-sync.service` + `pdf.service`
- **Internal vs external** — internal services orchestrate business logic; external services wrap third-party APIs
- **Receive `ScopedContext`** when they need DB access (internal services). External services that only call APIs don't need context.
- **Pre-defined API surface** — consumers know what the service does from its name and exports
