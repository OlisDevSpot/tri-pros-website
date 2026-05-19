# Service & Provider Architecture — Design Spec

> Standardize the backend into four tiers: internal services (business orchestrators), sync services (ACL facades), providers (external API clients + translators in `services/providers/`), and shared libs (local utilities in `shared/lib/`). First application: decompose `contracts.service.ts` by extracting Zoho Sign HTTP plumbing into `providers/zoho-sign/` and creating `zoho-sync.service.ts` as the ACL facade. Also move `pdf/` helpers to `shared/lib/pdf/` and `ai/` to `providers/ai/`.

## Problem

`src/shared/services/` mixes two fundamentally different things:

1. **Internal services** — business orchestrators that coordinate domain logic (`contracts.service.ts`, `scheduling.service.ts`, `email.service.ts`). They call DAL, other services, and external providers.
2. **External providers** — third-party API wrappers that talk to other systems (`google-calendar/`, `zoho-sign/`, `quickbooks/`, `r2/`). They handle auth, HTTP, and response parsing.

There is no physical boundary between them. The dependency direction (internal → external, never reverse) is enforced only by convention, not structure. This leads to:

- `contracts.service.ts` inlining Zoho HTTP calls alongside business logic
- `assemble-envelope.ts` duplicating HTTP helpers from `contracts.service.ts`
- No clear pattern for where translation logic (domain ↔ provider) lives
- Each new integration (QuickBooks, Bina, etc.) invents its own structure

## Architecture: The Two-Tier Pattern

### Conceptual Model

```
┌─────────────────────────────────────────────────────┐
│  services/                                          │
│                                                     │
│  ┌───────────────────┐   ┌────────────────────┐     │
│  │ Internal Services  │   │  Sync Services     │     │
│  │ (pure business     │   │  (ACL facades —    │     │
│  │  orchestration)    │──▶│   domain → provider│     │
│  │                    │   │   boundary)         │     │
│  └───────────────────┘   └─────────┬──────────┘     │
│                                    │                 │
│  ┌─────────────────────────────────▼───────────────┐ │
│  │  providers/                                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │ │
│  │  │ zoho-sign│ │ google-  │ │quickbooks│  ...    │ │
│  │  │ client.ts│ │ calendar │ │ client.ts│        │ │
│  │  │ lib/     │ │ client.ts│ │ lib/     │        │ │
│  │  └──────────┘ └──────────┘ └──────────┘        │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/shared/services/
  # ── Flat service files: ALL *.service.ts live here ──

  # Internal orchestrators (business logic — call DAL + services + providers):
  contracts.service.ts        # contract lifecycle (create, send, recall, resend, sync, events)
  scheduling.service.ts       # meeting scheduling (calls google-calendar client + mappers)
  email.service.ts            # email orchestration (calls resend client)
  notification.service.ts     # push notification dispatch
  accounting.service.ts       # invoicing orchestration (calls quickbooks client)
  pdf.service.ts              # PDF generation (orchestrates shared/lib/pdf/ + DAL)
  media.service.ts            # media processing (calls r2 provider + sharp)
  ai.service.ts               # AI orchestration (calls providers/ai/)
  analytics.service.ts        # analytics (stub)
  construction-data.service.ts # construction data (calls notion provider)
  webhook.service.ts          # webhook processing (stub)

  # Sync services / ACL facades (bridge domain → exactly one provider):
  zoho-sync.service.ts        # sync contracts to Zoho Sign

  # ── Provider directories: raw clients + translation helpers ──
  providers/
    zoho-sign/
      client.ts               # raw Zoho Sign HTTP client
      types.ts                # Zoho-native response/request types
      constants/
        index.ts              # ZOHO_SIGN_BASE_URL, template IDs, field caps
      lib/
        get-access-token.ts   # OAuth token refresh + cache
        access-token-cache.ts # in-memory TTL cache
        map-to-zoho.ts        # ProposalContext → Zoho merge body, field data
        map-from-zoho.ts      # Zoho responses → domain types
        build-signing-request.ts  # legacy single-template translation
        dedupe-signer-statuses.ts # multi-template signer deduplication
        is-long-sow.ts        # SOW length threshold check
        verify-webhook-signature.ts
        documents/             # envelope assembly — registry, evaluation, context
          registry.ts          # ENVELOPE_DOCUMENTS — single source of truth
          evaluate.ts          # partition docs into required/optional/forbidden
          assemble-envelope.ts # multi-template merge + attach + reorder
          proposal-context.ts  # pure snapshot builder for predicates/fields
          types.ts             # ProposalContext, DocumentRule, EnvelopeDocument
          labels.ts            # doc label constants (client-safe)

    google-calendar/
      client.ts               # raw GCal HTTP client
      types.ts                # GCal-native types + LocalEventUpsert
      lib/
        map-to-gcal.ts        # MeetingForGCal → GCalEventInput
        map-from-gcal.ts      # GCalEvent → LocalEventUpsert
        conflict.ts

    quickbooks/
      client.ts               # raw QB HTTP client
      types.ts                # QB-native types
      constants/
        index.ts
      lib/
        get-access-token.ts
        access-token-cache.ts

    r2/                        # Cloudflare R2 (S3-compatible)
      client.ts
      buckets.ts
      put-object.ts
      delete-object.ts
      get-presigned-upload-url.ts
      get-presigned-download-url.ts
      lib/
        get-object.ts
        delete-media-with-variants.ts
        process-image-variants.ts

    resend/                    # transactional email
      client.ts
      constants.ts
      lib/
        build-sender-from.ts

    notion/                    # Notion API (trades, scopes, contacts)
      client.ts
      types.ts
      constants/
        databases.ts
      dal/                     # Notion-specific queries (not our DB DAL)
        query-contacts.ts
        query-notion-database.ts
        update-page-property.ts
        scopes/
        trades/
      lib/
        contacts/
        meetings/
        scopes/
        sows/
        trades/
        pain-points/
        projects/
        extractors.ts
        blocks-to-html.ts
        blocks-to-tiptap-json.ts
        page-to-blocks.ts
        page-to-html.ts
        page-to-tiptap-json.ts
        property-filter.ts

    push/                      # Web Push (VAPID)
      send.ts
      lib/
        build-payload.ts
        constants.ts
        web-push-client.ts

    upstash/                   # QStash + Upstash Redis
      qstash-client.ts
      realtime-client.ts
      realtime.ts
      types.ts
      lib/
        create-job.ts
      jobs/                    # QStash job handlers
        sync-zoho-sign-status.ts
        sync-contract-draft.ts
        sync-customers.ts
        sync-calendars.ts
        initial-calendar-sync.ts
        create-qb-records.ts
        sync-qb-invoice.ts
        sync-qb-payment.ts
        generate-ai-summary.ts
        optimize-image.ts
        send-view-notification.ts

    google-drive/
      types.ts
      gapi.d.ts
      google-picker.d.ts
      hooks/
        use-google-picker.ts
      lib/
        download-drive-file.ts
        refresh-access-token.ts

    google-maps/
      geocode.ts
      static-urls.ts

    gohighlevel/
      constants.ts
      schemas.ts
      types.ts

    ai/                        # AI provider (OpenAI via Vercel AI SDK)
      lib/
        generate-project-summary.ts

    pipedrive/                 # LEGACY — do not use
      client.ts
      api/
        put-lead.ts

# ── Local utilities (NOT providers — no external HTTP) ──
src/shared/lib/
  pdf/                         # PDF generation (pdfmake + pdf-lib, purely local)
    render-pdf.ts
    sow-doc-definition.ts
    tiptap-to-pdfmake.ts
    count-pdf-pages.ts
```

## Naming Conventions

| Pattern | Meaning | Location |
|---------|---------|----------|
| `*.service.ts` | Domain-language facade (internal orchestrator or ACL sync) | `services/` root (flat) |
| `client.ts` | Raw HTTP adapter — provider-native types in/out, auth, base URL | `services/providers/<name>/` |
| `types.ts` | Type definitions — provider-native + shared contract types | `services/providers/<name>/` |
| `constants/` | Provider configuration — URLs, IDs, thresholds | `services/providers/<name>/constants/` |
| `map-to-*.ts` | Domain → provider translator | `services/providers/<name>/lib/` |
| `map-from-*.ts` | Provider → domain translator | `services/providers/<name>/lib/` |
| `lib/` | Provider-internal helpers — auth, mapping, utilities | `services/providers/<name>/lib/` |

## Dependency Rules

```
services/*.service.ts  →  services/providers/*/client.ts     ✅
services/*.service.ts  →  services/providers/*/lib/*          ✅ (translators, helpers)
services/*.service.ts  →  services/*.service.ts               ✅ (services compose)
services/*.service.ts  →  shared/dal/**                       ✅ (internal services only — sync services do NOT use DAL)
services/providers/*   →  services/*.service.ts               ❌ NEVER
services/providers/a/  →  services/providers/b/               ❌ NEVER
services/providers/*   →  shared/dal/**                       ❌ NEVER (no DB access)
```

**Internal services** may import from DAL (they have `ScopedContext`).
**Sync services** do NOT import from DAL. They receive pre-built domain types (e.g., `ProposalContext`) from the internal service that calls them. No `ScopedContext`, no DB access — they are pure domain-to-provider bridges.
**Provider clients** never import from DAL or services — they are pure HTTP adapters.

## When to Create Each Type

### Internal Service (`*.service.ts`)

Create when business logic needs orchestrating across DAL + other services. The service coordinates **what** to do.

Examples: `contracts.service.ts` (decides when to create/send/recall signing requests), `scheduling.service.ts` (decides when to sync meetings to calendar).

### Sync Service (`*-sync.service.ts`)

Create when a provider integration requires **2+ data sync operations** with translation logic between them. The sync service is the ACL facade — it accepts domain types, translates to provider types, orchestrates provider calls, and returns domain types.

Examples:
- `zoho-sync.service.ts` — 6+ operations: create envelope (mergesend + attach + reorder), submit, recall, delete, get status, attach files
- Future: `qb-sync.service.ts` if QuickBooks needs customer sync + invoice sync + payment sync

**Do NOT create** when the internal service only needs 1 provider call with simple mapping — just call `client.ts` + mappers directly from the internal service (e.g., `scheduling.service.ts` calls `google-calendar/client.ts`).

### Provider Client (`client.ts`)

Always create for any external API. Even if there's only one endpoint today, the client centralizes auth + base URL + error handling.

### Translators (`map-to-*.ts` / `map-from-*.ts`)

Create when provider types ≠ domain types. Not every provider needs them — R2 (S3-compatible) uses S3 types directly. But Zoho, GCal, QuickBooks all have their own type languages that need mapping.

## Shared Contract Types — Who Owns What

The **consumed service** (provider) owns the contract types that define what it accepts and returns. Consumers import these types; they never construct provider-native types directly.

```
# Contract type ownership
ProposalContext          → providers/zoho-sign/lib/documents/types.ts  (zoho-sign defines it)
CreateEnvelopeResult     → providers/zoho-sign/types.ts               (zoho-sign defines it)
ZohoContractStatus       → providers/zoho-sign/types.ts               (zoho-sign defines it)
MeetingForGCal           → providers/google-calendar/lib/map-to-gcal.ts (gcal defines it)
GCalEventInput           → providers/google-calendar/types.ts          (gcal defines it)
LocalEventUpsert         → providers/google-calendar/types.ts          (gcal defines it)
```

**Why the provider owns the contract:** If we switch from Zoho Sign to DocuSign, the new provider defines its own input contract. The sync service adapts. The internal service (`contracts.service.ts`) doesn't change because it talks to the sync service, which speaks the domain language.

## Data Flow Pattern

### Full ACL flow (sync service present):

```
Consumer (tRPC router / job / script)
  → contracts.service.sendSigningRequest(ctx, proposalId)    [INTERNAL SERVICE]
    → reads proposal from DAL
    → decides business logic (should we send? is draft stale?)
    → zohoSyncService.createEnvelope(proposalContext)         [SYNC SERVICE]
      → mapToZoho(proposalContext)                            [TRANSLATOR in provider lib/]
      → zohoClient.mergesend(body)                            [CLIENT]
      → zohoClient.attachFiles(requestId, files)              [CLIENT]
      → zohoClient.reorderDocuments(requestId, order)         [CLIENT]
      → mapFromZoho(response)                                 [TRANSLATOR in provider lib/]
    ← CreateEnvelopeResult
    → writes signingRequestId to DAL
  ← { requestId }
```

### Direct flow (no sync service needed):

```
Consumer
  → scheduling.service.syncMeetingToCalendar(ctx, meetingId)  [INTERNAL SERVICE]
    → reads meeting from DAL
    → meetingToGCalEvent(meeting)                             [TRANSLATOR in provider lib/]
    → googleCalendarClient.createEvent(token, calId, event)   [CLIENT]
    → writes gcalEventId to DAL
  ← success
```

## Zoho Sign Decomposition — Specific Changes

### New: `zoho-sync.service.ts` (ACL facade at services root)

```ts
function createZohoSyncService() {
  return {
    /** Create a multi-template envelope from a proposal context. Handles merge, attach, reorder. */
    createEnvelope(ctx: ProposalContext): Promise<CreateEnvelopeResult>

    /** Create a single-template draft (legacy path for pre-Phase-5 proposals). */
    createLegacyDraft(templateId: string, body: object, files: AttachFile[]): Promise<DraftResult>

    /** Submit an existing draft for signing (costs credits). */
    submitForSigning(requestId: string): Promise<void>

    /** Recall (cancel) an in-progress signing request. */
    recallRequest(requestId: string): Promise<void>

    /** Delete a draft or recall+delete an in-progress request. */
    deleteRequest(requestId: string): Promise<boolean>

    /** Get current signing status + signer details. */
    getRequestStatus(requestId: string): Promise<ZohoContractStatus>
  }
}
```

### New: `providers/zoho-sign/client.ts` (raw HTTP adapter)

```ts
function createZohoSignClient() {
  return {
    /** POST /templates/mergesend — multi-template envelope creation */
    mergesend(body: string): Promise<ZohoMergeSendResponse>

    /** POST /templates/{id}/createdocument — single-template creation */
    createFromTemplate(templateId: string, body: object, quickSend: boolean): Promise<ZohoCreateDocResponse>

    /** PUT /requests/{id} — multipart file attachment */
    attachFiles(requestId: string, files: AttachFile[]): Promise<void>

    /** PUT /requests/{id} — reorder documents */
    reorderDocuments(requestId: string, documentIds: DocumentOrder[]): Promise<void>

    /** GET /requests/{id} — get request details */
    getRequest(requestId: string): Promise<ZohoGetResponse>

    /** POST /requests/{id}/submit — send for signing */
    submit(requestId: string): Promise<void>

    /** POST /requests/{id}/recall — cancel signing */
    recall(requestId: string): Promise<void>

    /** PUT /requests/{id}/delete — delete draft or recall+delete */
    deleteRequest(requestId: string): Promise<boolean>
  }
}
```

### Refactored: `contracts.service.ts` (internal orchestrator — slimmed)

The public API stays identical. Internal changes:

- Remove: `getAuthHeader`, `jsonRequest`, `createFromTemplate`, `addFilesToRequest`, `sanitizeFilename`, `parseDraftResponse` — all move to client or sync service
- `createDraft()` calls `zohoSyncService.createEnvelope()` (registry path) or `zohoSyncService.createLegacyDraft()` (legacy path)
- `sendSigningRequest` calls `zohoSyncService.submitForSigning()`
- `recallSigningRequest` calls `zohoSyncService.recallRequest()`
- `getSigningStatus` calls `zohoSyncService.getRequestStatus()`
- Business logic (proposal reads, status writes, idempotency, auto-approve) stays

### Refactored: `assemble-envelope.ts` stays as translator, wired through client

`assemble-envelope.ts` moves to `providers/zoho-sign/lib/documents/` and is refactored to:
- Accept a `ZohoSignClient` instance instead of making raw `fetch()` calls
- Call `client.mergesend()`, `client.attachFiles()`, `client.reorderDocuments()` instead of inlining HTTP
- Remove its duplicate `attachFiles`, `deleteRequest`, `sanitizeFilename` functions
- Keep its pure translation helpers: `buildMergeSendBody`, `buildEnvelopeName`, `computeDrift`, `logMergeSendDiagnostics`

`zohoSyncService.createEnvelope()` calls `assembleEnvelope(client, ctx)` — the sync service owns the orchestration decision, `assemble-envelope.ts` owns the Zoho-specific translation.

The pure evaluator functions (`evaluateDocuments`, `validateEnvelopeSelection`, `buildProposalContext`) stay in `providers/zoho-sign/lib/documents/` as translators.

### Eliminated duplicates

- `addFilesToRequest` — one copy in `client.ts` only
- `sanitizeFilename` — one copy in `providers/zoho-sign/lib/` (or inlined in client)
- `deleteRequest` — one copy in `client.ts` only

## Migration Scope

### Phase 1: Provider directory restructure (separate PR — move-only, no logic changes)

Move existing `zoho-sign/`, `google-calendar/`, `quickbooks/`, `r2/`, `resend/`, `notion/`, `push/`, `upstash/`, `google-drive/`, `google-maps/`, `gohighlevel/`, `pipedrive/`, `ai/` into `services/providers/`. Move `pdf/` from `services/pdf/` to `shared/lib/pdf/` (it's a local utility, not a provider).

Update all imports project-wide. No logic changes. This is a large mechanical rename — its own PR to keep the Zoho decomposition diff reviewable.

Verify: `pnpm tsc` + `pnpm lint` clean. App loads. No behavior change.

### Phase 2: Zoho Sign decomposition (separate PR — logic extraction)

1. Create `providers/zoho-sign/client.ts` — extract HTTP methods from `contracts.service.ts` (`getAuthHeader`, `jsonRequest`, `createFromTemplate`, `addFilesToRequest`, `sanitizeFilename`, `parseDraftResponse`)
2. Move `documents/` under `lib/` in the zoho-sign provider
3. Refactor `assemble-envelope.ts` — replace raw `fetch()` calls with `client.*` calls, remove duplicate helpers
4. Create `zoho-sync.service.ts` at services root — ACL facade that orchestrates `client.ts` + translator helpers, exposes `createEnvelope`, `createLegacyDraft`, `submitForSigning`, `recallRequest`, `deleteRequest`, `getRequestStatus`
5. Refactor `contracts.service.ts` — replace inline HTTP calls with `zohoSyncService.*` calls. Business logic stays.
6. Eliminate all duplicates (`addFilesToRequest`, `sanitizeFilename`, `deleteRequest`)

Verify: `pnpm tsc` + `pnpm lint` clean. No API surface change for consumers of `contracts.service.ts`. All existing callers (contracts.router, sync jobs, scripts) unchanged.

## Design Decisions

**D1: All `*.service.ts` flat at services root, not inside provider dirs.**
Services speak the domain language. Even sync services like `zoho-sync.service.ts` are domain-level — they're the bridge. Putting them inside `providers/` would bury the domain API inside an implementation detail.

**D2: `providers/` lives inside `services/`, not as a sibling.**
Providers are an implementation detail of the services layer. External code (`trpc/`, `features/`, `entities/`) imports services, never providers directly. Nesting makes this clear.

**D3: Sync service threshold is 2+ data sync operations.**
One operation = internal service calls client directly. Two or more = extract a sync service to own the multi-step choreography.

**D4: Provider owns its contract types.**
The consumed side (provider) defines the input/output types. If we swap providers, the new provider defines new contracts and the sync service adapts. The internal service doesn't change.

**D5: `documents/` moves under `lib/` in zoho-sign provider.**
Documents (registry, evaluation, assembly helpers) are translation logic — they map our proposal domain to Zoho's envelope domain. They're `lib/` material, not a top-level concern of the provider.

**D6: `assemble-envelope.ts` stays as translator, wired through `client.ts`.**
`assemble-envelope.ts` is refactored to use `client.*` instead of raw `fetch()`, and called by `zoho-sync.service.ts`. The sync service owns the orchestration decision (when to create an envelope); `assemble-envelope.ts` owns the Zoho-specific translation (how to build the merge body, attach PDFs, reorder). Pure functions (evaluate, build body, compute drift) stay as translator helpers in `lib/documents/`.

## References

- [Anti-Corruption Layer pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)
- [ACL Implementation — OneUptime](https://oneuptime.com/blog/post/2026-01-30-anti-corruption-layer-pattern/view)
- [ACL Boundary Mapping — CodeOpinion](https://codeopinion.com/anti-corruption-layer-for-mapping-between-boundaries/)
- [ACL Pattern Structure — DEV Community](https://dev.to/asarnaout/the-anti-corruption-layer-pattern-pcd)
- [TypeScript API Contracts — Jon Mellman](https://www.jonmellman.com/posts/typescript-for-api-contracts/)
- [NestJS Folder Structure Guide — Nairi Abgaryan](https://medium.com/@nairi.abgaryan/stop-the-chaos-clean-folder-file-naming-guide-for-backend-nest-js-and-node-331fdc6400cb)
- [Node.js Best Practices — goldbergyoni](https://github.com/goldbergyoni/nodebestpractices)
- Internal: `memory/feedback-service-layer-naming.md`, `memory/feedback-backend-three-layer-convention.md`
