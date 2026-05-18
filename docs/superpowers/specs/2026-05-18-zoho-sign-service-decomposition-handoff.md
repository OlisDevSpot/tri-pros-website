# Zoho Sign Service Decomposition — Handoff

> This document captures the current state and design direction for decomposing `zoho-sign.service.ts` into composable building blocks. Read fully before writing any code.

## Current State

`src/shared/services/zoho-sign.service.ts` is a 400-line monolith created via `createZohoSignService()`. It contains:

1. **Zoho Sign API client** — `getAuthHeader()`, `jsonRequest()`, `createFromTemplate()`, `deleteRequest()`, `addFilesToRequest()`, `parseDraftResponse()`
2. **Draft lifecycle orchestration** — `createDraft()`, `createSigningRequest()`, `sendSigningRequest()`, `recallSigningRequest()`, `resendSigningRequest()`, `ensureDraftSynced()`
3. **Webhook event processing** — `applyContractEvent()`
4. **Status query** — `getSigningStatus()`
5. **Utility** — `sanitizeFilename()`

All of these are closures inside the factory, sharing the private `getAuthHeader`/`jsonRequest` helpers. The service receives `ScopedContext` and calls DAL (`proposalCrud`, `getFullView`, `getBySigningRequestId`) for all DB access.

### What's already extracted (in `src/shared/services/zoho-sign/`)

```
zoho-sign/
  constants.ts              — ZOHO_SIGN_BASE_URL, template IDs
  types.ts                  — ZohoContractStatus, ZohoRequestStatus, signer types
  lib/
    get-access-token.ts     — getZohoAccessToken() (OAuth token refresh)
    build-signing-request.ts — buildSigningRequest(proposal, opts) → { templateId, body }
    dedupe-signer-statuses.ts — dedupeSignerStatuses(actions)
    is-long-sow.ts          — isLongSow(proposal)
  documents/
    registry.ts             — ENVELOPE_DOCUMENTS array + rules
    evaluate.ts             — evaluateDocuments(ctx) + validateEnvelopeSelection(ctx, ids)
    assemble-envelope.ts    — assembleEnvelope(ctx) — multi-template merge+send
    proposal-context.ts     — buildProposalContext(proposal, opts) → ProposalContext
    types.ts                — ProposalContext, EnvelopeDocument interfaces
  pdf/                      — (actually under services/pdf/, not zoho-sign/)
```

### Consumers

| Caller | Methods used |
|--------|-------------|
| `contracts.router.ts` | `createSigningRequest`, `sendSigningRequest`, `recallSigningRequest`, `resendSigningRequest`, `getSigningStatus` |
| `sync-zoho-sign-status.ts` (job) | `applyContractEvent` |
| `sync-contract-draft.ts` (job) | `ensureDraftSynced` |
| `scripts/verify-long-path.ts` | `createSigningRequest` |
| `scripts/verify-short-path.ts` | `createSigningRequest` |

## Service Layer Conventions

Services are **grouped business logic with a pre-defined API surface**:

1. **Named for what they do** — `zoho-sign.service.ts` (Zoho Sign orchestration), `pdf.service.ts` (PDF generation), `email.service.ts` (email sending)
2. **Composable** — services call other services (`zoho-sign.service` calls `pdf.service`)
3. **Provider-specific when appropriate** — switching providers means creating a new service
4. **Receive `ScopedContext`** — forwarded from tRPC or constructed via `SYSTEM_CONTEXT`/`buildUserContext()`
5. **Call DAL for all DB access** — never import `db` directly
6. **Never resolve scope** — that's DAL's job via `ctx.scope`

## Decomposition Direction

The monolith has natural seams:

### Seam 1: Zoho Sign API Client → `zoho-sign/lib/api-client.ts`

Extract the HTTP layer — auth headers, base URL, request helpers. This is already partially done (`get-access-token.ts` exists), but the actual request methods (`jsonRequest`, `createFromTemplate`, `addFilesToRequest`, `deleteRequest`, `parseDraftResponse`) are still inlined.

**Target:**
```ts
// zoho-sign/lib/api-client.ts
export function createZohoSignClient() {
  return {
    jsonRequest(path, options),
    createFromTemplate(templateId, body, quickSend),
    addFilesToRequest(requestId, files),
    deleteRequest(requestId),
    getRequestStatus(requestId),
  }
}
export const zohoSignClient = createZohoSignClient()
```

This is a pure HTTP client — no `ScopedContext`, no DAL, no business logic. Other services or utilities could use it directly.

### Seam 2: Draft Lifecycle → stays in `zoho-sign.service.ts`

The orchestration logic (`createDraft`, `createSigningRequest`, `sendSigningRequest`, etc.) is the actual business logic of this service. It coordinates API client + DAL + PDF service. This is the right granularity for the service layer.

After extracting the API client, the service becomes thin:
- Reads proposal via DAL
- Decides what to do (business logic)
- Calls API client for Zoho operations
- Writes results via DAL

### Seam 3: Webhook Event Processing → stays in `zoho-sign.service.ts`

`applyContractEvent` is contract lifecycle orchestration — event mapping, idempotency, auto-approve. It reads via DAL, applies business rules, writes via DAL. Correct home is the service.

### What NOT to extract

- `sanitizeFilename()` — tiny utility, not worth its own file
- `parseDraftResponse()` — tightly coupled to `createFromTemplate`, moves with the API client

## Migration Checklist (for next session)

1. **Extract API client** — move HTTP methods to `zoho-sign/lib/api-client.ts`, export singleton
2. **Update `zoho-sign.service.ts`** — import `zohoSignClient`, replace inline HTTP calls
3. **Update `assembleEnvelope`** — it has its own `addFilesToRequest` copy (line 387 comment). Consider whether it should also use the shared client
4. **Verify** — `pnpm tsc` + `pnpm lint` clean, contract flows still work
5. **Update `CLAUDE.md`** service layer description if the file structure changes

## Three-Layer Convention Reference

| Layer | Role | Imports `db`? | Receives |
|-------|------|:---:|----------|
| **tRPC** | Client boundary — auth + thin body | No | `ScopedContext` (resolved by middleware) |
| **Service** | Business logic orchestration | No | `ScopedContext` (forwarded from caller) |
| **DAL** | Only layer touching DB — self-defending | **Yes** | `ScopedContext` (applies `ctx.scope`) |

## Key Files

| File | Role |
|------|------|
| `src/shared/services/zoho-sign.service.ts` | The monolith to decompose |
| `src/shared/services/zoho-sign/` | Already-extracted utilities and document logic |
| `src/shared/entities/proposals/dal/server/crud.ts` | `proposalCrud` singleton used by the service |
| `src/shared/entities/proposals/dal/server/queries.ts` | `getFullView`, `getBySigningRequestId` |
| `src/trpc/routers/proposals.router/contracts.router.ts` | Primary consumer (6 methods) |
| `src/shared/services/upstash/jobs/sync-zoho-sign-status.ts` | `applyContractEvent` consumer |
| `src/shared/services/upstash/jobs/sync-contract-draft.ts` | `ensureDraftSynced` consumer |
