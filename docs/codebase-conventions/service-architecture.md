# Service & Provider Architecture

Operational rules for the four-tier backend split. Full rationale in [ADR-0003](../adr/0003-service-provider-architecture.md).

## Modules

A **module** (`src/shared/modules/<module>/`) is a bounded slice of the domain that owns its **units** — each unit is one entity, with its own DAL, schemas, and (usually) `service.ts`. A module's root `service.ts` is the module-level API; a unit's own `service.ts` is the entity-level API for just that unit. Three kinds exist today:

| Kind | Owns tables? | Example | Notes |
|---|---|---|---|
| **Entity module** | Yes — one or more units, each with its own table | `modules/proposals/` (units: `core`, `incentives`, `media`, `views`), `modules/projects/` (units: `core`, `media`) | The common case: an entity that grows a child that needs its own table/service (media, views, incentives) is promoted from `entities/<x>/` to a module so the children have a home next to it. |
| **Provider-backed module** | No table of its own — reads through a provider instead | `modules/construction/` — **planned, not yet built** (`docs/plans/2026-09-15-construction-data-standardization-epic.md`) | Backs onto Notion (or another external source) instead of Postgres. |
| **Capability module** | No table at all — generic over OTHER modules' tables | `modules/media/` | Its DAL takes the owner's table as a parameter (`listMediaByOwner(table, ownerColumn, ctx, ownerId)`) instead of importing one — see `modules/media/DOCS.md`. |

### root-vs-unit-service

A module's root `service.ts` spreads its primary unit's CRUD, adds verbs, and exposes every OTHER unit's service as a **getter** — never a top-level property value:

```ts
export const projectsService = {
  ...projectCrud,
  get media() { return projectMediaService },   // getter, not `media: projectMediaService`
} satisfies SpecCrudHandlers<typeof projectServerSpec>
```

**Why a getter, not a plain property**: a child unit's service reaches back into the root or a sibling from inside its own method bodies, which makes the import graph cyclic (root → child → root/sibling). ES module bindings are live, so a reference resolved at CALL time is always initialised — but a plain `media: projectMediaService` here would read that binding while THIS object literal is being evaluated, and on whichever import order loads the child module first, the binding is still in its temporal dead zone (`ReferenceError: Cannot access '...' before initialization`). `modules/proposals/service.ts:1-36`'s header comment walks this failure mode in detail — read it before adding a new child service. A unit's own `service.ts` follows the identical rule for anything it re-exposes: **reference an imported service only inside a method body or a getter, never as a top-level property value.**

Top-level references are fine for a DAL module (the `...<entity>Crud` spread included) — a DAL never imports a service, so that side of the graph is acyclic.

### server-spec-lives-at-the-unit-root

`server-spec.ts` for a module unit lives at the **unit root** (`modules/<module>/<unit>/server-spec.ts`) — e.g. `modules/proposals/core/server-spec.ts`, `modules/projects/media/server-spec.ts` — not in a `lib/` subdirectory. This differs from a top-level `src/shared/entities/<entity>/`, which still keeps its spec at `entities/<entity>/lib/server-spec.ts` (ADR-0002 amendment, 2026-09-14). A unit's `constants.ts`, and its own `visibility.ts` where it has one, stay in the unit's `lib/`.

### modules-on-the-db-allowlist

`db` is imported only from inside a `dal/` directory (`dal-conventions.md#only-dal-imports-db`). For a module that means `modules/<module>/dal/server/**` (a module with its own root-level table — none exist yet) **and** `modules/<module>/<unit>/dal/server/**` (the per-unit case: `modules/proposals/core/dal/server/`, `modules/projects/media/dal/server/`, `modules/media/core/dal/server/`, …). A module's `service.ts` — root or unit — never imports `db` directly, same as any other service tier.

**Exception — a `lib/visibility.ts` correlated-subquery builder.** A unit's `visibility.ts` may import `db` when it uses it purely as a query-builder handle to construct a correlated subquery that some OTHER query (`resolveEffectiveScope`, a caller's `WHERE`) embeds and executes — never to run or await a query itself. `modules/projects/core/lib/visibility.ts:4,12-21` is the example: `projectParticipationScope` builds `exists(db.select(...).from(meetings)...)` and returns the unexecuted `SQL` fragment; nothing in the file calls `.then`/`await` on it. This stays outside the allowlist without becoming a DAL because it never touches Postgres itself — the embedding query does.

### entities-vs-modules

An entity that no other entity has grown children under stays a plain `src/shared/entities/<entity>/` — `meetings/`, `customers/`, `users/` today. **Moving an entity into a module is a deliberate decision**, made when it grows a child that needs its own table/service (proposals grew `incentives`/`media`/`views`; projects grew `media`) — never a routine rename. The move itself is a **path-only commit** (`git mv` + import rewrites, zero behavior change) so it can be verified mechanically (a path-normalized diff against its parent) and replayed across branches — see the proposals module move and this repo's projects/media modules restructure (tracker `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md`, C20).

### row-lifecycle-vs-orchestration

A side effect that must fire for **every** origin that touches a row — a tRPC mutation, a background job, a script's bare `crud.create` — is a `createCrudDal` **hook** (the `hooks.{create,update,delete}.{before,after}` config-factory slots), never a service wrapper. A service method only runs the side effect for callers that happen to go through that service; a hook runs for every caller, including the ones that bypass the service entirely.

Authorization probes (parent-visibility checks, own-row ownership checks) and cross-entity orchestration (composing two units' DALs, calling a peer service) stay service verbs — a DAL must never import a service.

**Reference impl**: `modules/projects/media/dal/server/crud.ts` (optimize-on-create, purge-on-delete as `create.after`/`delete.before` hooks) and `entities/meetings/dal/server/crud.ts` (five job dispatches across `create.after`/`update.after` — the precedent this pattern follows). Both hooks run inline (pre-commit, no `afterCommit` phase yet); see either file's header comment for the caveat.

**Why**: two scripts that used to insert project media rows with raw `db.insert` (`add-during-media.ts`, `portfolio-scraper/import-project.ts`) never went through the media service, so their rows were silently never optimized — a service-level side effect only reaches callers that call the service. Moving the dispatch onto the DAL hook means every origin gets it, the same argument that already kept the project-delete R2 purge in a DAL hook rather than a service method (a DAL may not import a service, so that hook reads media rows through the media module's table-generic DAL and purges through a provider-level helper instead).
**Enforced by**: convention + PR review

## The four tiers

| Tier | What it is | Lives at | Receives |
|---|---|---|---|
| **Internal service** | Business orchestrator. Calls DAL + other services + providers. | `src/shared/services/<x>.service.ts`, or a module's root `src/shared/modules/<module>/service.ts` + its units' `<unit>/service.ts` (e.g. `modules/proposals/service.ts`, `modules/proposals/{incentives,media,views}/service.ts`) | `ScopedContext` |
| **Sync service** | ACL facade. Wraps one provider in domain operations. | `src/shared/services/<x>-sync.service.ts` | provider client + native types |
| **Provider** | External API client. Auth + HTTP + translation. | `src/shared/services/providers/<x>/` | nothing app-aware |
| **Shared lib** | Local utility, no external HTTP. | `src/shared/lib/<x>/` | varies |

## Rules

### the-deciding-question

Before creating any new backend file: *Does this code make HTTP calls to an external system?*

- **Yes** → it goes in a **provider** (`services/providers/<name>/`)
- **No, but it orchestrates business logic** → **internal service** (`services/<x>.service.ts`) **when it coordinates a provider/external system or cross-cutting infra**. Pure entity-CRUD flows (compose entity CRUD + notes/participants, no external coordination) orchestrate in the **tRPC router** instead — e.g. `meetings.business.setOutcomeWithReason` / `rescheduleMeeting`.
- **No, it's pure local computation** (PDF gen, formatting, math) → **shared lib** (`shared/lib/<x>/`)
- **It does BOTH business logic AND raw HTTP** → split it. Extract HTTP into a provider; the orchestrator stays in `services/`.

**Amendment (C17, 2026-09-14):** once an entity or module has its own `service.ts` (root or unit — see `#root-vs-unit-service` above), that service IS the one server API for it: CRUD slots spread + verbs + child services. Routers, RSC, jobs and webhooks call it — they are thin adapters, not a second place business logic lives. The "pure entity-CRUD flows orchestrate in the tRPC router" bullet above is the pattern for an entity that has **not yet** grown a `service.ts` (meetings today); the moment a module/entity service exists, verbs move there and the router stops composing them itself. Reads stay in DAL `queries.ts` either way — a service composes them, it doesn't reimplement them.

**Why**: physical location predicts what code does. Mixed responsibilities create the `contracts.service.ts` problem (see ADR-0003).
**Enforced by**: convention + PR review

### dependency-direction-is-one-way

```
internal service  →  provider client       OK
internal service  →  provider types.ts     OK (type-only)
internal service  →  provider lib/         NEVER (provider-internal)
internal service  →  internal service      OK (composition)
internal service  →  shared/dal/**         OK
internal service  →  shared/lib/**         OK
provider          →  internal service      NEVER
provider          →  another provider      NEVER
provider          →  shared/dal/**         NEVER
```

Providers are leaves. They don't know about the app's domain. If two providers need to coordinate, an internal service orchestrates them.

A provider's `lib/` is **provider-internal** — only that provider's own `client.ts` imports it (config, token caches, internal helpers). External consumers import a provider's `client.ts` (actions) and `types.ts` (type-only). Never `lib/`, `dal/`, `schemas/`, `constants/`, `webhooks/`. **Translators live in domain-land**, not in the provider — see `#providers-have-no-domain-types-in-signatures`.

**Why**: keeps providers swappable. Switch Zoho Sign → DocuSign by rewriting one provider directory; no business logic touches.
**Reference impl**: `src/shared/services/contracts.service.ts` → `zoho-sync.service.ts` → `providers/zoho-sign/`
**Enforced by**: convention (lint rules are a future possibility). ⚠️ Known non-compliant, not yet migrated: `providers/gohighlevel/lib/normalize-bina-lead.ts` (imported by the bina webhook route and `customer-intake.service`) and `providers/google-calendar/lib/{map-to-gcal,map-from-gcal,conflict}.ts` (imported by `scheduling.service`). Their redirects are specced in `docs/superpowers/specs/2026-08-20-provider-boundary-translator-home-design.md` §3–§4.

### client-is-the-superset-entry-point

`client.ts` exports a **single factory + singleton** named `<provider>Client`
that exposes **every interaction** with the provider as a method. The client
is a *superset of the raw provider SDK* — it bundles the REST surface AND
local provider-ecosystem helpers (JWT mint, request signing, payload builders,
signature verification) onto one handle:

```ts
import { twilioClient } from '@/shared/services/providers/twilio/client'

await twilioClient.placeOutboundCall({ ... })
const jwt = twilioClient.mintVoiceAccessToken({ identity })
const ok  = twilioClient.verifyWebhookSignature({ url, signature, params })
```

```ts
import { zohoSignClient } from '@/shared/services/providers/zoho-sign/client'

await zohoSignClient.mergesend(body)
await zohoSignClient.attachFiles(requestId, files)
```

There is **one import path** for actions per provider. No `lib/voice.ts`, no
`lib/jwt.ts`, no `webhooks/verify.ts` — every action method hangs off the
singleton.

**Why uniform**: callers have one mental model + one tab-complete surface
per provider. Adding a new capability = adding a method to the client, never
spawning a new import path. Pattern-matching across providers becomes trivial.

**What stays as sibling exports** (NOT methods on the client):
- **Type re-exports** (`types.ts`) — `CallInstance`, `MessageInstance`, etc. — these are compile-time shapes for callers' signatures, not actions.
- **Data-shape Zod** (`schemas/`, `webhooks/`) — used at the boundary (`.parse()` in route handlers, request input validation) — values, not actions you "do".
- **Error class** (`RestException` re-export from `client.ts`) — needed for `instanceof` in catch blocks alongside the client.

**Reference impl**: `src/shared/services/providers/twilio/` (canonical post-2026-06-02), `src/shared/services/providers/zoho-sign/` (older example, same pattern but pre-dating the formal codification).

**Enforced by**: convention + PR review. Not currently lint-enforced: no
`no-restricted-imports` rule for provider SDKs (e.g. direct `import twilio from 'twilio'`
outside the provider directory) exists in `eslint.config.js` (verified 2026-09-14).

### provider-directory-shape

Every provider directory has the same shape. `schemas/` is a **sibling** of `lib/` (where `lib/` exists), never nested inside — this matches how entities (`src/shared/entities/<x>/schemas/`) and features (`src/features/<x>/schemas/`) organize. Same mental model everywhere: schemas describe wire/data shapes; the client does the work.

```
services/providers/<name>/
  DOCS.md                   per-provider usage rules + invariants (link from CLAUDE.md if load-bearing)
  client.ts                 THE entry point — singleton + RestException + per-provider error re-exports
  types.ts                  SDK type re-exports for caller signatures (CallInstance, MessageInstance, ...)
  constants/                URLs, IDs, TTLs, thresholds, per-provider env var groupings
  schemas/                  outbound-API Zod (request shapes — what we send)
    primitives.ts           shared primitives (E.164, timestamps, IDs)
    <resource>.ts           per-resource request + response zod schemas
  webhooks/                 inbound-payload Zod (what the provider sends us)
    <resource>.ts           per-event-class payload Zod (often discriminated union)
  lib/                      OPTIONAL — only for pure-local helpers that are large enough to warrant a file
                            and are NOT actions on the client (e.g., `access-token-cache.ts`, `config.ts` when env vars are optional —
                            see `provider-env-config-when-optional` below). Most providers won't
                            need this directory. Webhook signature verification is NOT here — it's
                            a method on the client.
```

A provider always has `client.ts`, even for a one-endpoint integration. Auth + every action lives there.

**`schemas/` vs `webhooks/`:**
- `schemas/` — Zod for what WE send to the provider (request shapes, JWT-mint input shapes, etc.)
- `webhooks/` — Zod for what THE PROVIDER sends to us (inbound webhook form payloads)
- Both contain zero internal dependencies (other than `schemas/primitives.ts`). They're parsed `.parse()` at the boundary.

**`lib/` is the exception, not the rule:**
- Most providers don't need a `lib/` directory at all — the client absorbs the action surface; schemas + types live in `schemas/` / `webhooks/` / `types.ts`.
- A `lib/` file is appropriate ONLY for pure-local helpers that are too large to inline in `client.ts` AND are not invoked as client methods (e.g., a token-refresh cache used internally by the client itself, a `config.ts` that hosts the provider's env var fragment + runtime-config builder — see `provider-env-config-when-optional` below).
- Webhook signature verification, JWT minting, TwiML/payload building are **client methods**, NOT `lib/` files. They are interactions with the provider's ecosystem, even when no HTTP round-trip happens.

**Anti-patterns:**
- Putting `schemas/` inside `lib/` (e.g. `lib/schemas/`) — nests data definitions inside the directory that consumes them and breaks the cross-codebase parallel.
- Per-capability action files in `lib/` (e.g. `lib/voice.ts`, `lib/jwt.ts`, `lib/messaging.ts`) — splits the action surface across multiple imports. Use one `client.ts` with all methods.
- Standalone `webhooks/verify.ts` — should be `<provider>Client.verifyWebhookSignature(...)` on the client.

**Why uniform**: new providers are pattern-matched against existing ones; the same shape exists across providers, entities, features, and domains, so a developer reading the repo never has to relearn it.

**Reference impl**: `src/shared/services/providers/twilio/` (canonical post-2026-06-02), `src/shared/services/providers/zoho-sign/` (basic shape, pre-codification but compliant).

**Enforced by**: convention

### provider-env-config-when-optional

For any provider whose env vars are **NOT app-core-required** — meaning the app should boot and function for paths that don't touch this provider, even if its keys are missing — env-var handling lives in the provider's own `lib/config.ts`, NOT inline in `server-env.ts`. The boundary: app-core env (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, `NODE_ENV`) stays inline in `server-env` as required. Everything else — every provider, every cross-provider domain like voip — uses this pattern.

**The contract — five exports per provider `lib/config.ts`, produced by the [`createProviderConfig`](../../src/shared/config/create-provider-config.ts) factory:**

```ts
// src/shared/services/providers/<name>/lib/config.ts
import { z } from 'zod'
import { createProviderConfig } from '@/shared/config/create-provider-config'

// 1. Schema fragment — every field .optional()
export const xEnvFragment = z.object({
  X_API_KEY: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
})

// 2. Runtime config type — required types, what callers receive
export type ParsedXEnv = z.infer<typeof xEnvFragment>
export interface XRuntimeConfig {
  apiKey: string
  clientId: string
}

// 3. Factory call — produces build / get / isConfigured / configMeta in one go.
//    `provider` is the canonical identifier (twilio, cloudtalk, resend, ...).
const helpers = createProviderConfig({
  provider: 'x',
  fragment: xEnvFragment,
  requiredKeys: ['X_API_KEY', 'X_CLIENT_ID'],
  toConfig: (parsed): XRuntimeConfig => ({
    apiKey: parsed.X_API_KEY!,
    clientId: parsed.X_CLIENT_ID!,
  }),
})

export const buildXConfig = helpers.build           // pure builder, throws NotConfiguredError
export const getXConfig = helpers.get                // cached lazy accessor
export const isXConfigured = helpers.isConfigured    // boolean peek (never throws)
export const xConfigMeta = helpers.configMeta        // boot-banner registry entry
```

The pre-factory shape (hand-rolled `let _cache`, `listMissingX`, explicit `buildXConfig`) is the same contract — the factory just removes the boilerplate. See `createProviderConfig` source for what it generates.

**Three invariants that make this work as a unit:**

1. **Schema layer is permissive** — every field on the fragment is `.optional()`. `pnpm dev` / `pnpm build` / Vercel boot succeed regardless of which providers are configured. The only required env stays in `server-env`'s app-core section.

2. **Builder enforces required** — `buildXConfig` asserts non-null per field the runtime actually needs and throws a single [`NotConfiguredError`](../../src/shared/config/not-configured-error.ts) listing every absent key. Optional-for-this-runtime fields (e.g., `TWILIO_TRUST_PROFILE_SID` — a vetting clock the SDK doesn't need to operate) live on the fragment for visibility but are excluded from the runtime config type.

3. **Accessor is the provider's surface, not server-env's** — consumers `import { getXConfig } from '@/shared/services/providers/<x>/lib/config'`, never from `server-env`. `server-env`'s role is bootstrap orchestration only: spread fragments into the schema, validate at boot, print the dev-only boot banner via registered `<x>ConfigMeta` entries.

**Server-env stays thin**:

```ts
// src/shared/config/server-env.ts
import { twilioEnvFragment, twilioConfigMeta } from '@/shared/services/providers/twilio/lib/config'
// ...one import line per provider as it migrates...

const envSchema = z.object({
  // app-core required (DATABASE_URL, NODE_ENV, NEXT_PUBLIC_BASE_URL, BETTER_AUTH_SECRET, ...)
  ...twilioEnvFragment.shape,
  // ...other provider fragments spread in...
})

const env = envSchema.parse(process.env)
export default env

// Boot banner (dev only)
if (env.NODE_ENV !== 'production') {
  const metas = [twilioConfigMeta /* , cloudtalkConfigMeta, ... */]
  for (const meta of metas) {
    const missing = meta.listMissing()
    if (missing.length === 0) console.log(`  ✅ ${meta.provider}`)
    else console.log(`  ❌ ${meta.provider}  missing: ${missing.join(', ')}`)
  }
}

// Production safety gates stay here too.
```

**Import order is safe**: provider's `lib/config.ts` may `import env from '@/shared/config/server-env'` at the top, but must only READ `env` inside function bodies (getter / listMissing). ESM bootstrap order resolves cleanly — by the time `getXConfig()` is called, server-env has finished parsing.

**Service-domain mirror**: when env vars are consumed by a domain-shared service (e.g., `services/voip/*.service.ts` reading `VOIP_*` vars that span Twilio + CloudTalk), the same pattern applies at `services/<domain>/lib/config.ts` — but note that "provider" in the `configMeta.provider` field becomes a slight terminology stretch. Acceptable for now: voip-shared registers as a peer in the banner. If/when the mismatch becomes load-bearing, introduce a parallel `createServiceConfig` factory or generalize the field name. The `services/` namespace itself is reserved for actual service code — the `lib/` subdirectory hosts the config (same rule as the `lib/` exception in [provider-directory-shape](#provider-directory-shape)).

**When NOT to use this pattern:**
- App-core env (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, `NODE_ENV`). These are required at boot; a missing value SHOULD crash the import — that's the correct failure mode for "the app can't start at all." Keep them inline as `z.string()`.
- Env vars read in exactly one place that naturally tolerate `string | undefined` (a feature flag with a default). No fragment needed.

**Anti-patterns:**
- Hosting `getXConfig()` in `server-env.ts` and re-exporting — defeats "one import path per provider" from [client-is-the-superset-entry-point](#client-is-the-superset-entry-point) and re-couples server-env to every provider.
- Reading `env.X_FOO` at **module scope** inside any provider file (`client.ts`, `constants/*.ts`, etc.). The schema makes it `string | undefined`; the read captures the value once, downstream surprise. All env reads in providers must be lazy — inside function bodies.
- Throwing plain `Error` from the builder — callers can't `instanceof NotConfiguredError` to map configured-vs-misconfigured into distinct error responses.
- Required fields on the fragment (`z.string()` not `z.string().optional()`) — defeats boot resilience.
- Adding a provider's env vars inline in server-env while the provider's `client.ts` reads them with `!` assertions — drift between schema and call site; new fields hit two files.

**Reference impl**: [`src/shared/services/providers/twilio/lib/config.ts`](../../src/shared/services/providers/twilio/lib/config.ts) (canonical post-2026-06-05). [Migration matrix](../plans/voip-in-house/EPIC.md) tracks remaining providers to retrofit.

**Enforced by**: convention + PR review. Not lint-enforced — `eslint.config.js` has no `no-restricted-imports` rule for raw `serverEnv.X_FOO` reads inside provider directories (verified 2026-09-14); this rule extends the `client-is-the-superset-entry-point` discipline to require lazy reads only.

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

Provider functions accept and return provider-native types (`ZohoEnvelope`, `QbInvoice`). **Translation to/from domain types lives in domain-land** — the owning entity (`entities/<x>/lib`, `entities/<x>/schemas`), a module (`modules/<m>/...`), or the calling service (`services/<x>.service.ts` or `services/<x>/`). Never in the provider's `lib/`.

A **translator/adapter** (vendor payload → domain shape) is domain-land code. It may import the provider's `types.ts` **type-only** for its input signature, and imports the domain shapes it produces from the owning entity or module.

**Why**: the provider is the only place that knows the third-party shape; everything above the provider speaks domain. A translator returns domain types, so by `#the-deciding-question` it is not provider code.
**Ratified**: 2026-08-20, `docs/superpowers/specs/2026-08-20-provider-boundary-translator-home-design.md` §2 (epic #248). Supersedes the earlier "…OR in the provider's `lib/` translators" allowance.
**Reference impl**: `src/shared/services/providers/zoho-sign/client.ts` (provider side). Target shape for translators: `modules/construction/sources/notion/` (`docs/plans/2026-09-15-construction-data-standardization-epic.md` D3).
**Enforced by**: convention. See the non-compliance note under `#dependency-direction-is-one-way`.

### background-side-effects-via-qstash-jobs

Side effects fired from a tRPC mutation, a Route Handler, or an entity CRUD hook (the `hooks.{op}.{before,after}` config-factory slots in `dal/server/crud.ts` — never on the spec) MUST go through a QStash job declared with `createJob` from `@/shared/services/providers/upstash/lib/create-job`. **Never** raw `void promise.catch(...)`. **Never** `after()` from `next/server` for anything you actually care about landing.

```ts
// 1. Declare the job in src/shared/services/providers/upstash/jobs/
import { schedulingService } from '@/shared/services/scheduling.service'
import { createJob } from '../lib/create-job'

export const syncMeetingToGcalJob = createJob(
  'sync-meeting-to-gcal',
  async (payload: { meetingId: string }) => {
    await schedulingService.syncMeeting(payload.meetingId)
  },
)

// 2. Register it in src/app/api/qstash-jobs/route.ts (jobs array)

// 3. Dispatch from the call site
// CRITICAL work (silent loss = bug):
await syncMeetingToGcalJob.dispatchOrThrow({ meetingId: row.id })

// COSMETIC work (silent loss = OK):
void optimizeImageJob.dispatch({ mediaFileId: created.id })
```

**Why**: on Vercel, a function instance terminates once the response is sent. Raw fire-and-forget (`void promise.catch()`) gets killed mid-flight. `after()` from `next/server` extends the instance lifetime but is still **best-effort** — no retries, cancelled on route timeout, lost on function crash. This was the latent bug behind sean@'s missing GCal events for intake-created meetings. QStash provides durability: the dispatch persists in Upstash before the function returns, automatic retries with exponential backoff on downstream failure, dead-letter on exhaustion. The cost is one round-trip (~50-200ms) to enqueue.

**`dispatch` vs `dispatchOrThrow` — pick by criticality**:

| Variant | Behavior on QStash transport failure | When to use |
|---|---|---|
| `dispatchOrThrow` | Throws — caller's mutation fails with 500 | Data integrity, calendar sync, time-changed pushes, anything where silent loss is a bug |
| `dispatch` | Logs + swallows — caller's mutation still returns 200 | Cosmetic / non-critical: image optimization, view-tracking pings, "you were added" courtesy notifications, analytics events |

Use `dispatchOrThrow` and `await` it for critical work. Use `dispatch` and `void` it for cosmetic work — the explicit `void` documents the fire-and-forget intent at the call site.

**Required**:
- Handler MUST be idempotent. QStash retries automatically on non-2xx — running the handler twice must be safe. Most natural patterns are already idempotent (GCal etag-conditional pushes, DELETE-with-404-tolerance, customer-projection re-walks).
- Payload MUST be a small JSON-serializable object — typically just ids. Reconstruct heavy state inside the handler from a fresh DB read.
- Critical-path callers (`dispatchOrThrow`) MUST `await` the dispatch in series — never wrap in `void`. The whole point is to surface enqueue failures to the user.
- Multiple parallel dispatches in the same hook: collect promises and `Promise.all` them so the dispatch round-trips share latency. See `meetingServerSpec.hooks.update.after` for the canonical pattern.

**When NOT to enqueue a job**:
- The user must see the outcome of the side effect in the same response — `await` the operation inline.
- Pure realtime fan-out (e.g. `ably.channels.get(...).publish(...)`). The whole point of Ably is sub-100ms broadcast; routing through QStash adds 100-300ms of dispatch latency and defeats the use case. Use inline `await ably.publish(...)`. Same goes for any other ephemeral pub/sub.
- The work is so cheap it's not worth the round-trip (a synchronous `db.update` for one row, a single cache invalidation).

**Anti-pattern: `after()` from `next/server`**. Do not use. It looks like background work but is best-effort with no durability. Either the work is critical (use `dispatchOrThrow`) or it's so ephemeral that inline `await` is acceptable. There is no middle ground we trust.

**Reference impl**: `src/shared/services/providers/upstash/jobs/sync-meeting-to-gcal.ts` + `delete-meeting-event.ts` + `propagate-customer-change.ts` + `notify-meeting-time-changed.ts`, dispatched from `meetingServerSpec.hooks.{create,update,delete}` and `customerServerSpec.hooks.update.after`.

**Enforced by**: convention (PR review). Audit greps:
- `rg "import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*['\"]next/server['\"]" src` — should return zero matches.
- `rg "void [a-zA-Z]+.*\.catch" src/shared/entities src/trpc src/shared/services` — every match should either be a `void *.dispatch(...).catch(...)` (cosmetic job) or a candidate for migration to `dispatchOrThrow`.

## Current classification

**Internal services:** `contracts`, `scheduling`, `email`, `notification`, `accounting`, `construction-data`, `pdf`, `ai`, `analytics`, `webhook`. **Module services:** `proposals` (`modules/proposals/service.ts`, children `incentives` / `media` / `views`), `projects` (`modules/projects/service.ts`, child `media`), `media` (`modules/media/service.ts` — a capability module, not a `<x>.service.ts` file; its old top-level services-tier directory is gone).

**Sync services:** `zoho-sync`. Future: `qb-sync` when accounting is decomposed.

**Providers:** `zoho-sign`, `google-calendar`, `quickbooks`, `r2`, `resend`, `notion`, `web-push`, `upstash`, `ai`, `google-drive`, `google-maps`, `gohighlevel`.

**Shared libs (NOT providers):** `shared/lib/pdf/` (pure local generation via pdfmake/pdf-lib).

## Anti-patterns

- **Adding raw `fetch()` inside `*.service.ts`.** Extract into the provider's `client.ts`.
- **Provider importing from `shared/dal/`.** Providers don't know about the database.
- **Provider A importing from Provider B.** Use a service to orchestrate.
- **Pure-local utility (no HTTP) in `services/providers/`.** Move to `shared/lib/`.
- **Domain types (`Proposal`, `Customer`) in a provider's `client.ts` signatures.** Translate in `lib/` instead.
- **Nesting `schemas/` inside `lib/`.** `schemas/` is always a sibling of `lib/`, matching the entity/feature/domain pattern. See `provider-directory-shape`.
- **`void something.catch(console.error)` to fire-and-forget a critical side effect from a tRPC mutation, route handler, or entity hook.** Use a QStash job — see `background-side-effects-via-qstash-jobs`. Raw fire-and-forget gets killed mid-flight on Vercel and silently drops the work. (Cosmetic work — image optimization, analytics — is still a valid `void job.dispatch(...)`.)
- **`import { after } from 'next/server'` for background work.** Best-effort with no retries; if you care whether the work landed, it's a QStash job. If you don't care, it's an inline `await` (cheap) or a `void job.dispatch(...)` (so the dispatch itself survives function shutdown).

## See also

- ADR-0003 — full decision rationale
- `docs/codebase-conventions/dal-conventions.md` — DAL is below services
- `docs/codebase-conventions/trpc-procedures.md` — tRPC is above services
