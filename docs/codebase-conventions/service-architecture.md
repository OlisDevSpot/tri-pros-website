# Service & Provider Architecture

Operational rules for the four-tier backend split. Full rationale in [ADR-0003](../adr/0003-service-provider-architecture.md).

## The four tiers

| Tier | What it is | Lives at | Receives |
|---|---|---|---|
| **Internal service** | Business orchestrator. Calls DAL + other services + providers. | `src/shared/services/<x>.service.ts` | `ScopedContext` |
| **Sync service** | ACL facade. Wraps one provider in domain operations. | `src/shared/services/<x>-sync.service.ts` | provider client + native types |
| **Provider** | External API client. Auth + HTTP + translation. | `src/shared/services/providers/<x>/` | nothing app-aware |
| **Shared lib** | Local utility, no external HTTP. | `src/shared/lib/<x>/` | varies |

## Rules

### the-deciding-question

Before creating any new backend file: *Does this code make HTTP calls to an external system?*

- **Yes** → it goes in a **provider** (`services/providers/<name>/`)
- **No, but it orchestrates business logic** → **internal service** (`services/<x>.service.ts`)
- **No, it's pure local computation** (PDF gen, formatting, math) → **shared lib** (`shared/lib/<x>/`)
- **It does BOTH business logic AND raw HTTP** → split it. Extract HTTP into a provider; the orchestrator stays in `services/`.

**Why**: physical location predicts what code does. Mixed responsibilities create the `contracts.service.ts` problem (see ADR-0003).
**Enforced by**: convention + PR review

### dependency-direction-is-one-way

```
internal service  →  provider client       OK
internal service  →  provider lib/         OK (translators)
internal service  →  internal service      OK (composition)
internal service  →  shared/dal/**         OK
internal service  →  shared/lib/**         OK
provider          →  internal service      NEVER
provider          →  another provider      NEVER
provider          →  shared/dal/**         NEVER
```

Providers are leaves. They don't know about the app's domain. If two providers need to coordinate, an internal service orchestrates them.

**Why**: keeps providers swappable. Switch Zoho Sign → DocuSign by rewriting one provider directory; no business logic touches.
**Reference impl**: `src/shared/services/contracts.service.ts` → `zoho-sync.service.ts` → `providers/zoho-sign/`
**Enforced by**: convention (lint rules are a future possibility)

### provider-directory-shape

Every provider directory has the same shape:

```
services/providers/<name>/
  client.ts               raw HTTP adapter (auth, fetch, response parsing)
  types.ts                provider-native + shared contract types
  constants/              URLs, IDs, thresholds
  lib/
    map-to-<provider>.ts  domain → provider translator
    map-from-<provider>.ts provider → domain translator
    (other helpers, validators, etc.)
```

A provider always has `client.ts`, even for a one-endpoint integration. Auth lives there.

**Why**: uniform shape; new providers are pattern-matched against existing ones.
**Reference impl**: `src/shared/services/providers/zoho-sign/`
**Enforced by**: convention

### sync-service-when-2-plus-ops

A `*-sync.service.ts` exists when a provider needs 2+ domain operations with translation between them. Below that threshold, the internal service calls the provider client directly.

**Why**: a sync service for a single-op integration is over-engineering.
**Reference impl**: `src/shared/services/zoho-sync.service.ts` (compose create-draft, send, recall, query-status)
**Enforced by**: convention

### services-never-import-db

Internal services accept `ScopedContext` (or `SYSTEM_CONTEXT`) and forward it to DAL calls. They never import `db` from `@/shared/db`.

**Why**: enforces the three-layer convention (tRPC → service → DAL → db). Services that touch db can't be reused across entry points.
**Reference impl**: `src/shared/services/contracts.service.ts`
**Enforced by**: convention

### providers-have-no-domain-types-in-signatures

Provider functions accept and return provider-native types (`ZohoEnvelope`, `QbInvoice`). Translation to/from domain types lives in the provider's `lib/` translators OR in the calling sync service.

**Why**: the provider is the only place that knows the third-party shape; everything above the provider speaks domain.
**Reference impl**: `src/shared/services/providers/zoho-sign/client.ts`
**Enforced by**: convention

## Current classification

**Internal services:** `contracts`, `scheduling`, `email`, `notification`, `media`, `accounting`, `construction-data`, `pdf`, `ai`, `analytics`, `webhook`.

**Sync services:** `zoho-sync`. Future: `qb-sync` when accounting is decomposed.

**Providers:** `zoho-sign`, `google-calendar`, `quickbooks`, `r2`, `resend`, `notion`, `web-push`, `upstash`, `ai`, `google-drive`, `google-maps`, `gohighlevel`, `pipedrive`.

**Shared libs (NOT providers):** `shared/lib/pdf/` (pure local generation via pdfmake/pdf-lib).

## Anti-patterns

- **Adding raw `fetch()` inside `*.service.ts`.** Extract into the provider's `client.ts`.
- **Provider importing from `shared/dal/`.** Providers don't know about the database.
- **Provider A importing from Provider B.** Use a service to orchestrate.
- **Pure-local utility (no HTTP) in `services/providers/`.** Move to `shared/lib/`.
- **Domain types (`Proposal`, `Customer`) in a provider's `client.ts` signatures.** Translate in `lib/` instead.

## See also

- ADR-0003 — full decision rationale
- `docs/codebase-conventions/dal-conventions.md` — DAL is below services
- `docs/codebase-conventions/trpc-procedures.md` — tRPC is above services
