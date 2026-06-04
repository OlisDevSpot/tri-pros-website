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

**Enforced by**: convention + PR review. Slug E of voip-in-house adds an
ESLint `no-restricted-imports` rule preventing direct `import twilio from 'twilio'`
outside the provider directory; the rule pattern generalizes to other SDKs.

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
                            and are NOT actions on the client (e.g., `sanitize-filename.ts`,
                            `access-token-cache.ts`, `config.ts` when env vars are optional —
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
- A `lib/` file is appropriate ONLY for pure-local helpers that are too large to inline in `client.ts` AND are not invoked as client methods (e.g., a token-refresh cache used internally by the client itself, a filename sanitizer used by call sites that produce multipart bodies, a `config.ts` that hosts the provider's env var fragment + runtime-config builder — see `provider-env-config-when-optional` below).
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

**Enforced by**: convention + PR review. ESLint `no-restricted-imports` (per `client-is-the-superset-entry-point`) already prevents consumers from importing raw `serverEnv.X_FOO` inside provider directories; this rule extends the discipline to require lazy reads only.

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

### background-side-effects-via-qstash-jobs

Side effects fired from a tRPC mutation, a Route Handler, or an Entity hook (`spec.hooks.{op}.{before,after}`) MUST go through a QStash job declared with `createJob` from `@/shared/services/providers/upstash/lib/create-job`. **Never** raw `void promise.catch(...)`. **Never** `after()` from `next/server` for anything you actually care about landing.

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
- **Nesting `schemas/` inside `lib/`.** `schemas/` is always a sibling of `lib/`, matching the entity/feature/domain pattern. See `provider-directory-shape`.
- **`void something.catch(console.error)` to fire-and-forget a critical side effect from a tRPC mutation, route handler, or entity hook.** Use a QStash job — see `background-side-effects-via-qstash-jobs`. Raw fire-and-forget gets killed mid-flight on Vercel and silently drops the work. (Cosmetic work — image optimization, analytics — is still a valid `void job.dispatch(...)`.)
- **`import { after } from 'next/server'` for background work.** Best-effort with no retries; if you care whether the work landed, it's a QStash job. If you don't care, it's an inline `await` (cheap) or a `void job.dispatch(...)` (so the dispatch itself survives function shutdown).

## See also

- ADR-0003 — full decision rationale
- `docs/codebase-conventions/dal-conventions.md` — DAL is below services
- `docs/codebase-conventions/trpc-procedures.md` — tRPC is above services
