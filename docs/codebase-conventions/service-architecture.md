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
