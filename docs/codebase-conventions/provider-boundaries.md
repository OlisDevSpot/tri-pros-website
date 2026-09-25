# Provider Boundaries

What may cross the edge of a `services/providers/<name>/` directory, and where vendor→domain translation lives.

Companion to [service-architecture.md](./service-architecture.md) (the four-tier split) and ADR-0003 (the why). Epic #248. Ratified 2026-08-20 — `docs/superpowers/specs/2026-08-20-provider-boundary-translator-home-design.md` §2.

## Rules

### external-consumers-import-client-and-types-only

From outside a provider directory you may import exactly two things:

- **`client.ts`** — the provider's actions (the `<provider>Client`).
- **`types.ts`** — provider-native types, **type-only** (`import type`).

Never `lib/`, `dal/`, `schemas/`, `constants/`, or `webhooks/`.

```ts
// ✅
import { notionClient } from '@/shared/services/providers/notion/client'
import type { NotionPage } from '@/shared/services/providers/notion/types'

// ❌ — provider internals
import { normalizeBinaLead } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'
```

**Why**: the provider is swappable only while nothing above it depends on its insides. One entrypoint means one thing to rewrite.
**Enforced by**: convention + PR review. The `no-restricted-imports` lint rule is a later task in #248 and is **not** in `eslint.config.js` today.

### provider-lib-is-provider-internal

A provider's `lib/` holds pure-local helpers that are **not** actions and are used internally by that provider's own `client.ts` — config readers, token caches, request builders, signature verification.

`lib/config.ts` reading `shared/config/server-env` is the one sanctioned outward dependency (see `service-architecture.md` on import order).

**Why**: `lib/` is the provider's private workspace. The moment something in it returns a domain type or encodes app policy, it stops being provider code.
**Enforced by**: convention + PR review

### translators-live-in-domain-land

**Domain translation and domain policy never live in a provider's `lib/`.**

Anything that (a) returns or consumes app-domain types, or (b) encodes app or business policy, belongs in domain-land: the owning **entity** (`entities/<x>/lib`, `entities/<x>/schemas`), a **module** (`modules/<m>/...`), or a **service** (`services/<x>.service.ts` or `services/<x>/`).

A **translator/adapter** — vendor payload → domain shape — is domain-land code that:
- imports the provider's `types.ts` **type-only**, for its input signature;
- imports the domain shapes it produces from the owning entity or module;
- never imports the provider's `client.ts` (it transforms; it does not fetch).

```
providers/<vendor>/client.ts   →  vendor-native payload
                                        ↓
entities|modules|services/…/<adapter>.ts   →  domain type
```

**Why**: a translator's output type says where it belongs. `service-architecture.md#the-deciding-question` puts domain-returning code above the provider tier.
**Ratified**: 2026-08-20, spec §2 — supersedes the older "translation lives in the provider's `lib/` translators" allowance, which is now removed from `service-architecture.md`.
**As built** (construction epic P1, 2026-09-22): `modules/construction/sources/notion/` holds the data-source ids, property maps, page→domain translators and extractors; `providers/notion` is `client.ts` + `types.ts` + `lib/config.ts` (the config fragment stays, per `#provider-lib-is-provider-internal`). The module's rules live in `src/shared/modules/construction/DOCS.md`.
**Enforced by**: convention + PR review

### providers-are-leaves

```
provider  →  internal service      NEVER
provider  →  another provider      NEVER
provider  →  shared/dal/**         NEVER
provider  →  a tRPC router/hook    NEVER
```

A provider directory also holds no React hooks. A client-side hook that wraps a provider belongs with its consumer, behind tRPC.

**Why**: coordination between two vendors is business logic, so it belongs in a service. A provider that reaches upward cannot be swapped or tested alone.
**Enforced by**: convention + PR review

## Known non-compliance (tracked, not yet migrated)

| Where | What | Redirect specced in |
|---|---|---|
| `providers/gohighlevel/lib/normalize-bina-lead.ts` | Defines the domain type `IntakeCore` and the Bina→intake translator; imported by `app/api/webhooks/bina/route.ts` and `customer-intake.service.ts` | Spec §3 → `entities/customers/{schemas,lib/lead-adapters/bina.ts}` |
| `providers/google-calendar/lib/{map-to-gcal,map-from-gcal,conflict}.ts` | Domain types + sync policy (last-write-wins, TPR-branded descriptions); imported by `scheduling.service.ts` | Spec §4 → `services/scheduling/` |
| `providers/google-drive/token.service.ts` | A `*.service.ts` inside a provider directory — services live in `services/` | Spec §8 (logged, unscheduled) |
| `providers/twilio` | `validatePhoneLine` orchestrates Upstash + Twilio + a domain policy gate — a cross-provider service, not a client method | Spec §6 (deferred to its own pass) |

## Referencing from code

`// see docs/codebase-conventions/provider-boundaries.md#translators-live-in-domain-land`
