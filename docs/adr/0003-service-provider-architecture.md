# Service & Provider Architecture

Backend code that talks to external systems splits into four physical tiers: **internal services** (business orchestrators that call DAL + other services), **sync services** (anti-corruption-layer facades wrapping one external integration), **providers** (raw external API clients with auth/HTTP/translation), and **shared libs** (local utilities like PDF generation with no external HTTP). We chose this over the prior pattern of one flat `services/` directory mixing business orchestration with vendor HTTP because `contracts.service.ts` had inlined Zoho HTTP alongside contract lifecycle logic, `assemble-envelope.ts` had duplicated those same HTTP helpers, and no structural mechanism distinguished "business orchestrator" from "API wrapper" — switching providers or testing logic without mocks both required reading every file individually.

## Context

`src/shared/services/` mixed two fundamentally different concerns:

1. **Internal services** — business orchestrators (`contracts.service.ts`, `scheduling.service.ts`, `email.service.ts`) that coordinate DAL, other services, and external providers.
2. **External providers** — third-party API wrappers (`google-calendar/`, `zoho-sign/`, `quickbooks/`, `r2/`) handling auth, HTTP, and response parsing.

There was no physical boundary between them. The dependency direction (internal → external, never reverse) was enforced only by convention. This led to:

- `contracts.service.ts` inlining Zoho HTTP calls alongside business logic
- `assemble-envelope.ts` duplicating HTTP helpers from `contracts.service.ts`
- No clear pattern for where translation logic (domain ↔ provider) lived
- Each new integration (QuickBooks, GoHighLevel) invented its own structure

## Decision

A **four-tier architecture** with physical directory boundaries:

### 1. Internal services — `src/shared/services/*.service.ts`

Business orchestrators. Coordinate DAL + other services + providers. Receive `AuthedContext` and forward it to DAL calls. Never make raw HTTP calls — always delegate to a provider client.

Examples: `contracts.service.ts`, `scheduling.service.ts`, `email.service.ts`, `notification.service.ts`, `media.service.ts`, `accounting.service.ts`, `pdf.service.ts`, `ai.service.ts`.

### 2. Sync services — `src/shared/services/*-sync.service.ts`

ACL facades. Bridge one internal service to one provider when the bridge involves 2+ operations with domain↔provider translation. No `AuthedContext`, no DAL — pure provider orchestration.

Example: `zoho-sync.service.ts` (composes Zoho Sign API calls into "create draft", "send envelope", "recall", etc.). Future: `qb-sync.service.ts` if `accounting.service.ts` is decomposed.

### 3. Providers — `src/shared/services/providers/<name>/`

External API clients. Each provider directory contains:

```
services/providers/<name>/
  client.ts               raw HTTP adapter (auth, fetch, response parsing)
  types.ts                provider-native + shared contract types
  constants/              URLs, IDs, thresholds
  lib/
    map-to-<provider>.ts  domain → provider translator
    map-from-<provider>.ts provider → domain translator
    (helpers)
```

Providers always have a `client.ts` — even for single-endpoint integrations — to centralize auth.

### 4. Shared libs — `src/shared/lib/<name>/`

Pure local utilities with **no external HTTP**. PDF generation, formatters, computation. **NOT** in `services/`.

The deciding question: *Does this make HTTP calls to an external system?* If yes → provider. If no → shared lib.

### Dependency rules

```
services/*.service.ts  →  services/providers/*/client.ts     OK
services/*.service.ts  →  services/providers/*/lib/*          OK (translators)
services/*.service.ts  →  services/*.service.ts               OK (services compose)
services/*.service.ts  →  shared/dal/**                       OK
services/*.service.ts  →  shared/lib/**                       OK
services/providers/*   →  services/*.service.ts               NEVER
services/providers/a/  →  services/providers/b/               NEVER
services/providers/*   →  shared/dal/**                       NEVER
```

Providers never know about business logic. Services never make raw HTTP. The dependency graph is a DAG with services at the top and providers at the leaves.

## Considered alternatives

- **Keep flat `services/` and rely on naming convention.** Rejected: convention had already failed (Zoho HTTP inlined in contracts.service, duplicated in assemble-envelope).

- **One provider directory containing all third-party code (`services/external/`).** Rejected: doesn't distinguish "centralized HTTP client" from "translators" from "constants" within one provider.

- **Sync services as a separate top-level tier (`services/sync/`).** Rejected: sync services compose with internal services more often than they cluster with each other; flat `services/` keeps them adjacent to consumers.

- **Translators as a separate `services/translators/` tier.** Rejected: translators are provider-specific (a Zoho translator can't be reused for QuickBooks), so they live inside the provider's `lib/`.

- **Allow providers to import each other (e.g., a "google" provider package).** Rejected: providers are leaves by design. If two need to coordinate, an internal service orchestrates them.

## Consequences

- Switching a provider (e.g., DocuSign → Zoho Sign → in-house) only touches the provider directory + the sync service that wraps it. Internal services are insulated.
- Business logic in services is testable without HTTP mocks — providers are the only HTTP boundary.
- File location tells you what code does at a glance: `services/<x>.service.ts` is business, `services/providers/<y>/` is integration, `shared/lib/<z>/` is pure utility.
- Adding a new external integration is a single provider directory + (if 2+ ops with translation) a sync service. No invented structure.
- The dependency rules are enforceable by lint (future work) — today they're convention, but the directory boundary makes violations visually obvious in PRs.

## Current classification (as of PR #207)

**Internal services:** `contracts.service`, `scheduling.service`, `email.service`, `notification.service`, `media.service`, `accounting.service`, `construction-data.service`, `pdf.service`, `ai.service`, `analytics.service`, `webhook.service`.

**Sync services:** `zoho-sync.service`. Future: `qb-sync.service`.

**Providers:** `zoho-sign/`, `google-calendar/`, `quickbooks/`, `r2/`, `resend/`, `notion/`, `web-push/`, `upstash/`, `ai/`, `google-drive/`, `google-maps/`, `gohighlevel/`.

**Shared libs (NOT providers):** `shared/lib/pdf/` (pdfmake/pdf-lib — pure local generation), and assorted utilities.

## See also

- `docs/codebase-conventions/service-architecture.md` — operational rules (where to put what)
- ADR-0002 — Entity Server System (the tRPC/DAL counterpart)
