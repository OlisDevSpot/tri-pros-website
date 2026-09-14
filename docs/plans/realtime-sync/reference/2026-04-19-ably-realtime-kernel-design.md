# Ably Realtime Kernel — Design Spec

**Status:** Design approved. Implementation deferred. Pick up in a future session.
**Date:** 2026-04-19
**Owner:** Oliver
**Tracking issue:** _[to be filled in once GitHub issues are created]_

---

## TL;DR for future Claude sessions

You are picking up a deferred design for a **realtime kernel** built on Ably that replaces the current ad-hoc, meeting-only sync setup with a unified service that handles every realtime use case in the app: multi-device sync, multi-user collaboration, dashboard liveness, customer-facing live views, presence indicators, and notification fanout.

The design is approved. **Do not re-debate the macro decisions.** This document is the contract:

| Decision | Choice | Section |
|---|---|---|
| Use cases in scope | All 6 (multi-device, multi-user collab, dashboard liveness, customer-facing, presence, notifications) | [§1](#1-scope--use-cases) |
| Developer API shape | Entity-oriented convention with central registry | [§3](#3-entity--list--user-registry) |
| Auth model | JWT token with capability map, issued by `/api/ably/token` | [§4](#4-room-security--token-issuance) |
| Authorization vocabulary | CASL (class-level) + DAL row-checks (record-level) + share tokens (parallel customer path) | [§4](#4-room-security--token-issuance) |
| Event payload | Hybrid: `ping` (default) or `patch` (opt-in for hot paths), declared per event in registry | [§5](#5-event-payload-philosophy) |
| Reliability | Ably `rewind:2m` on subscribe + React Query `refetchOnWindowFocus` | [§7](#7-reliability--missed-events) |
| Webhooks (Reactor) | Scaffolded from day 1 with HMAC signature verification, ngrok-tunneled in dev | [§8](#8-reactor-webhooks) |
| Migration | Phased — meetings first (parity), then customers/proposals/projects, then lists, then presence, then notifications | [§11](#11-migration-plan) |

If you are about to invent a parallel realtime path, channel-naming convention, or permission system — stop. Use the registry and the helpers below.

---

## 0. What exists today (the starting point)

- **Ably package** is installed (`ably ^2.21.0`) and configured.
- **Server publish**: `src/shared/services/upstash/realtime.ts` exports `ably = new Ably.Rest({ key })`. Used inline in `src/trpc/routers/meetings.router.ts:211-212` and `:240-242` only — fires `'meeting.updated'` to channel `meeting:{id}`.
- **Client subscribe**: `src/shared/services/upstash/realtime-client.ts` exports `ablyClient = new Ably.Realtime({ key })`. Wrapped by `<AblyProvider>` in `src/shared/components/providers/realtime-provider.tsx`.
- **Single hook**: `src/features/meeting-flow/hooks/use-meeting-sync.ts` calls `useChannel('meeting:{id}', invalidate)` where `invalidate` calls `invalidateMeeting()`.
- **Invalidation hub**: `src/shared/dal/client/use-invalidation.ts` already has `invalidateCustomer`, `invalidateMeeting`, `invalidateProposal`, `invalidateProject`, `invalidateActivities`, `invalidateAgentSettings`. **This is the contract the new kernel binds to** — no need to redesign it.
- **CASL**: `src/shared/domains/permissions/abilities.ts` is the canonical authorization source. Subjects: `Activity | Calendar | Customer | CustomerPipeline | Dashboard | Meeting | Project | Proposal | User | all`. Actions: `access | assign | create | delete | manage | read | update`.
- **Share tokens**: `src/shared/domains/permissions/lib/validate-share-token.ts` is the parallel customer-auth path. It is intentionally siblings-with-CASL, not a replacement.
- **DAL row-checks**: e.g. `isParticipant`, `userParticipatesInMeeting` in `src/shared/dal/server/meetings/participants.ts`.
- **Misnamed directory**: `src/shared/services/upstash/` contains Ably code, not Upstash. The new kernel renames this to `src/shared/services/ably/`.
- **Env**: server has `ABLY_API_KEY`. Client currently has `NEXT_PUBLIC_ABLY_API_KEY` (subscribe-only) — **this gets deleted** in the new design (token auth only).

---

## 1. Scope & use cases

All six realtime scenarios are first-class:

- **A. Multi-device sync (one user)** — agent has the same record open on laptop + phone; edits propagate.
- **B. Multi-user collaboration** — two agents on the same meeting/customer/proposal see each other's edits.
- **C. Dashboard / pipeline liveness** — cards move, counts update, items appear without manual refresh.
- **D. Customer-facing realtime** — the customer in proposal-flow sees agent edits live.
- **E. Presence indicators** — "Oliver is viewing this meeting" / "2 agents on this customer right now".
- **F. System / notification fanout** — push notifications, activity feeds, deep links to records.

Out of scope (explicit non-goals):
- Realtime collaborative text editing (CRDTs / OT). The kernel ships invalidations and patches, not character-level merges.
- Persisting every realtime event to long-term storage. Only the ones we explicitly opt in (e.g., presence audit log via Reactor).
- A full notification center with read/unread persistence. The notification *bus* is in scope. The persistence layer is a follow-up.

---

## 2. Directory & module layout

The new structure replaces `src/shared/services/upstash/`:

```
src/shared/services/ably/
  client.ts                         # Ably.Realtime factory with authCallback (replaces realtime-client.ts)
  server.ts                         # Ably.Rest singleton (replaces realtime.ts)
  registry/
    entities.ts                     # Entity registry — meeting, customer, proposal, project, ...
    lists.ts                        # List registry — customer-pipeline, dashboard, ...
    users.ts                        # User-scope channel definitions (notifications, device-sync)
    index.ts                        # Merged exports + types
  lib/
    channel-names.ts                # Single source of truth for channel-name formatters
    capabilities.ts                 # Build capability map from registry + AuthContext
    publish.ts                      # realtime.entity() / .list() / .user() / .presence() factories
    verify-webhook.ts               # HMAC signature verification for Reactor
  hooks/
    use-entity-sync.ts              # useEntitySync(type, id) — invalidate or patch
    use-list-sync.ts                # useListSync(name) — invalidate or patch
    use-presence.ts                 # usePresence(type, id) — members, self, enter/leave
    use-notifications.ts            # useNotifications() — current user's notification bus
    use-realtime-debug.ts           # Dev-only event log
  components/
    realtime-debugger.tsx           # Dev overlay (gated on NEXT_PUBLIC_REALTIME_DEBUG=1)

src/app/api/
  ably/
    token/route.ts                  # POST — issues short-lived token with capability map
    dev-publish/route.ts            # POST — DEV ONLY, lets the debugger fire test events
  ably-webhooks/
    channel-lifecycle/route.ts      # POST — Ably Reactor: first/last subscriber
    presence/route.ts               # POST — Ably Reactor: enter/leave
    message/route.ts                # POST — Ably Reactor: arbitrary message events (opt-in)
```

**Provider stays** at `src/shared/components/providers/realtime-provider.tsx` but imports from `@/shared/services/ably/client` (renamed).

**Channel-name formatters** are the **only** code that builds a channel name. Anywhere else, callers go through helpers (`ch.entity(type, id)`, `ch.list(name)`, etc.). This is enforced by lint convention + code review — no string concatenation of channel names.

---

## 3. Entity / list / user registry

The registry is the heart of the kernel. Adding a new entity to realtime is **one registry entry plus the publish call(s)**.

### Entity registry shape

```ts
// services/ably/registry/entities.ts
import { z } from 'zod'
import type { AppSubjects } from '@/shared/domains/permissions/types'
import type { invalidationMethods } from '@/shared/dal/client/use-invalidation'

export type RealtimeMode = 'ping' | 'patch'

export type EventDef<TPayload extends z.ZodTypeAny = z.ZodTypeAny> =
  | { mode: 'ping' }
  | { mode: 'patch'; payload: TPayload }

export interface EntityDef {
  name: string                                              // 'meeting'
  caslSubject: AppSubjects                                  // 'Meeting' — class-level CASL gate
  events: Record<string, EventDef>                          // 'updated' | 'status-changed' | ...
  presenceEnabled: boolean

  /**
   * Row-level resolution — which IDs is this user allowed to subscribe to?
   * Called ONLY after CASL class-level gate passes. Receives ability so
   * super-admin (manage/all) can short-circuit DAL filter.
   */
  resolveAllowedIds: (
    ctx: AblySessionContext,
    ability: AppAbility,
  ) => Promise<string[]>

  /**
   * Maps to a method on useInvalidation(). Used by useEntitySync to fire
   * the right invalidation function on 'ping' events.
   */
  invalidationHook: keyof ReturnType<typeof useInvalidation>

  /**
   * tRPC query key builder for this entity, used by 'patch' events to
   * apply payload directly to the React Query cache.
   */
  queryKey: (id: string) => readonly unknown[]
}

export const entityRegistry = {
  meeting: defineEntity({
    name: 'meeting',
    caslSubject: 'Meeting',
    events: {
      'updated':              { mode: 'ping' },
      'status-changed':       { mode: 'patch', payload: z.object({ status: meetingStatusSchema }) },
      'participants-changed': { mode: 'ping' },
      'deleted':              { mode: 'ping' },
    },
    presenceEnabled: true,
    resolveAllowedIds: async (ctx, ability) => {
      if (ability.can('manage', 'all')) return getAllMeetingIds()
      return getMeetingIdsForParticipant(ctx.user.id)
    },
    invalidationHook: 'invalidateMeeting',
    queryKey: (id) => trpc.meetingsRouter.getById.queryKey({ id }),
  }),

  customer: defineEntity({
    name: 'customer',
    caslSubject: 'Customer',
    events: {
      'updated': { mode: 'ping' },
      'profile-updated': { mode: 'ping' },
      'pipeline-moved': { mode: 'patch', payload: z.object({ from: z.string(), to: z.string() }) },
    },
    presenceEnabled: true,
    resolveAllowedIds: async (ctx, ability) => {
      if (ability.can('manage', 'all')) return getAllCustomerIds()
      return getCustomerIdsForAgent(ctx.user.id) // customers tied to meetings the agent participates in
    },
    invalidationHook: 'invalidateCustomer',
    queryKey: (id) => trpc.customerPipelinesRouter.getCustomerProfile.queryKey({ customerId: id }),
  }),

  proposal: defineEntity({
    name: 'proposal',
    caslSubject: 'Proposal',
    events: {
      'updated':       { mode: 'ping' },
      'status-changed':{ mode: 'patch', payload: z.object({ status: proposalStatusSchema }) },
      'viewed':        { mode: 'patch', payload: z.object({ viewerId: z.string(), at: z.string() }) },
      'deleted':       { mode: 'ping' },
    },
    presenceEnabled: true,
    resolveAllowedIds: async (ctx, ability) => {
      if (ability.can('manage', 'all')) return getAllProposalIds()
      return getProposalIdsForAgent(ctx.user.id)
    },
    invalidationHook: 'invalidateProposal',
    queryKey: (id) => trpc.proposalsRouter.getById.queryKey({ id }),
  }),

  project: defineEntity({
    name: 'project',
    caslSubject: 'Project',
    events: {
      'updated': { mode: 'ping' },
      'stage-changed': { mode: 'patch', payload: z.object({ stage: projectStageSchema }) },
      'deleted': { mode: 'ping' },
    },
    presenceEnabled: true,
    resolveAllowedIds: async (ctx, ability) => {
      if (ability.can('manage', 'all')) return getAllProjectIds()
      return getProjectIdsForAgent(ctx.user.id)
    },
    invalidationHook: 'invalidateProject',
    queryKey: (id) => trpc.projectsRouter.crud.getById.queryKey({ id }),
  }),
} as const

export type EntityName = keyof typeof entityRegistry
```

### List registry shape

```ts
// services/ably/registry/lists.ts

export interface ListDef {
  name: string                                   // 'customer-pipeline'
  caslGate: [AppActions, AppSubjects]            // ability.can(...caslGate) gates subscribe
  events: Record<string, EventDef>
  invalidationHook?: keyof ReturnType<typeof useInvalidation>
}

export const listRegistry = {
  'customer-pipeline': defineList({
    name: 'customer-pipeline',
    caslGate: ['read', 'CustomerPipeline'],
    events: {
      'item-created': { mode: 'ping' },
      'item-moved':   { mode: 'patch', payload: z.object({ itemId: z.string(), from: z.string(), to: z.string() }) },
      'item-updated': { mode: 'ping' },
      'item-deleted': { mode: 'ping' },
    },
    invalidationHook: 'invalidateCustomer',
  }),

  'dashboard': defineList({
    name: 'dashboard',
    caslGate: ['access', 'Dashboard'],
    events: {
      'action-queue-changed': { mode: 'ping' },
      'pipeline-stats-changed': { mode: 'ping' },
    },
    // No invalidationHook — uses qc.invalidateQueries(trpc.dashboardRouter.pathFilter()) directly
  }),

  // Future: 'portfolio', 'agent-schedule', etc.
} as const

export type ListName = keyof typeof listRegistry
```

### User-scope channels

```ts
// services/ably/registry/users.ts

// Two channel patterns per user, no per-user registry needed:
//   user:{userId}:notifications  — server fans out notifications here
//   user:{userId}:sync           — devices publish/subscribe to coordinate (e.g., "go to URL X")
//
// Capabilities: every authenticated user always gets ['subscribe'] on their notifications
// channel and ['subscribe', 'publish'] on their sync channel. No customer-facing equivalent
// (customers go through share-token narrow caps).

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),                             // 'proposal-approved' | 'meeting-scheduled' | ...
  title: z.string(),
  body: z.string().optional(),
  href: z.string().optional(),
  createdAt: z.string(),
})
export type Notification = z.infer<typeof notificationSchema>

export const deviceSyncSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('navigate'), href: z.string() }),
  // future kinds...
])
export type DeviceSyncMessage = z.infer<typeof deviceSyncSchema>
```

### Channel-name formatters (single source of truth)

```ts
// services/ably/lib/channel-names.ts

export const ch = {
  entity: (type: EntityName, id: string) => `entity:${type}:${id}` as const,
  list: (name: ListName) => `list:${name}` as const,
  listScoped: (name: ListName, scope: string) => `list:${name}:${scope}` as const,
  userNotifications: (userId: string) => `user:${userId}:notifications` as const,
  userSync: (userId: string) => `user:${userId}:sync` as const,
}
```

**Rule:** No code outside this file builds a channel name. If you need a new channel pattern, add a formatter here.

---

## 4. Room Security — Token Issuance

**This is THE global concept for room security in the app.** Every realtime channel access decision flows through the pipeline below. Document this prominently in `docs/architecture/realtime-room-security.md` once implementation starts.

### The flow (canonical)

```
┌─────────┐                                     ┌──────────┐                 ┌──────┐
│ Client  │ 1. new Ably.Realtime({ authCallback })          │                 │      │
│         │ ──────────────────────────────────► │          │                 │      │
│         │                                     │ /api/    │                 │      │
│         │ 2. authCallback fires on connect    │ ably/    │                 │      │
│         │ ──────────────────────────────────► │ token    │                 │ Ably │
│         │                                     │          │                 │      │
│         │                                     │ 3. resolve session         │      │
│         │                                     │    (agent | customer)      │      │
│         │                                     │                            │      │
│         │                                     │ 4. buildCapabilities(ctx)  │      │
│         │                                     │    — walks registry,       │      │
│         │                                     │      runs CASL + DAL       │      │
│         │                                     │                            │      │
│         │                                     │ 5. ably.auth.createTokenRequest │ │
│         │                                     │    ──────────────────────► │      │
│         │                                     │    ◄────────────────────── │      │
│         │ 6. TokenRequest returned            │                            │      │
│         │ ◄────────────────────────────────── │                            │      │
│         │                                                                  │      │
│         │ 7. Client exchanges TokenRequest for Token directly with Ably    │      │
│         │ ──────────────────────────────────────────────────────────────► │      │
│         │ ◄────────────────────────────────────────────────────────────── │      │
│         │                                                                  │      │
│         │ 8. Connected. On expiry, Ably auto-calls authCallback again.    │      │
└─────────┘                                                                  └──────┘
```

### Key invariants

- **Client never holds the Ably API key.** It holds short-lived (1hr default), capability-scoped tokens.
- **Token expiry → seamless refresh** via Ably's `authCallback`, no app-level retry logic needed.
- **`NEXT_PUBLIC_ABLY_API_KEY` is deleted.** Only `ABLY_API_KEY` (server-only) remains.

### Authorization layers (DO NOT INVENT NEW ONES)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — CASL (class-level)                                                 │
│ "Can this authenticated user perform ACTION on SUBJECT-type?"                │
│ e.g. ability.can('read', 'Meeting'), ability.can('access', 'Dashboard')      │
│ Source: src/shared/domains/permissions/abilities.ts                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — DAL row-level checks                                               │
│ "Does THIS specific record belong to them?"                                  │
│ e.g. isParticipant(meetingId, userId), getMeetingIdsForParticipant(userId)   │
│ Source: src/shared/dal/server/<domain>/*                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ PARALLEL PATH — Share tokens (for unauthenticated customers)                 │
│ "Does this URL token grant access to a specific resource?"                   │
│ Source: src/shared/domains/permissions/lib/validate-share-token.ts           │
└──────────────────────────────────────────────────────────────────────────────┘
```

The Ably capability builder defers to all three. It does not invent its own permission vocabulary.

### Capability builder

```ts
// services/ably/lib/capabilities.ts
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

type AblyAuthContext =
  | { kind: 'session'; user: { id: string; role: UserRole } }
  | { kind: 'share-token'; resourceType: 'proposal' | 'project'; resourceId: string }

export async function buildCapabilities(ctx: AblyAuthContext): Promise<Capability> {
  if (ctx.kind === 'share-token') {
    return buildShareTokenCapabilities(ctx)
  }

  const caps: Capability = {}
  const ability = defineAbilitiesFor({ id: ctx.user.id, role: ctx.user.role })

  // ── User's own channels — always allowed for authenticated users ──
  caps[ch.userNotifications(ctx.user.id)] = ['subscribe']
  caps[ch.userSync(ctx.user.id)] = ['subscribe', 'publish']

  // ── Entity channels ──
  for (const entity of Object.values(entityRegistry)) {
    if (ability.cannot('read', entity.caslSubject)) continue
    const ids = await entity.resolveAllowedIds(ctx, ability)
    for (const id of ids) {
      caps[ch.entity(entity.name, id)] = entity.presenceEnabled
        ? ['subscribe', 'presence']
        : ['subscribe']
    }
  }

  // ── List channels ──
  for (const list of Object.values(listRegistry)) {
    const [action, subject] = list.caslGate
    if (ability.can(action, subject)) {
      caps[ch.list(list.name)] = ['subscribe']
    }
  }

  return caps
}

async function buildShareTokenCapabilities(ctx: ShareTokenContext): Promise<Capability> {
  // No CASL walk; the share token IS the authorization. Narrow caps to one resource.
  return {
    [ch.entity(ctx.resourceType, ctx.resourceId)]: ['subscribe'],
  }
}
```

### Performance considerations

Walking the registry per-request can issue N DB queries (one per entity's `resolveAllowedIds`). Mitigations:

1. **Batch where possible** — one query returns all allowed IDs across all entities (a single SQL `WITH` CTE could do this).
2. **In-memory cache per-userId** with ~30s TTL. Capabilities rarely change mid-session. On significant role/permission changes, the user signs out / signs back in.
3. **Customer (share-token) path skips the registry walk entirely** — just one channel.

### Token endpoint

```ts
// src/app/api/ably/token/route.ts
export async function POST(req: Request) {
  // Try authenticated session first.
  const session = await auth.api.getSession({ headers: req.headers })
  let authCtx: AblyAuthContext

  if (session) {
    authCtx = { kind: 'session', user: { id: session.user.id, role: session.user.role } }
  } else {
    // Fall back to share-token (e.g., customer hitting /proposal-flow/<id>?token=xxx).
    const { resourceType, token } = await parseShareTokenRequest(req)
    const validated = await validateShareToken(token, resourceType)
    if (!validated.valid) return new Response('Unauthorized', { status: 401 })
    authCtx = { kind: 'share-token', resourceType, resourceId: validated.resourceId }
  }

  const capabilities = await buildCapabilities(authCtx)
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: authCtx.kind === 'session' ? authCtx.user.id : `customer:${authCtx.resourceId}`,
    capability: capabilities,
    ttl: 60 * 60 * 1000, // 1 hour
  })

  return Response.json(tokenRequest)
}
```

---

## 5. Event payload philosophy

Two modes, declared per event in the registry:

- **`ping`** — event carries no semantic payload; client triggers `useInvalidation()[entity.invalidationHook]()` → React Query refetches. **Default for new events.**
- **`patch`** — event carries a typed payload (Zod schema in registry); client validates and applies directly to React Query cache via `qc.setQueryData(entity.queryKey(id), patchFn(payload))`. Zero-latency UI. Use only for hot-path events where lag is measurable.

### Why hybrid (and not pure ping or pure patch)

- **Pure ping** → laggy under bursty updates (typing in a notes field firing 20 events/sec = 20 refetches).
- **Pure patch** → rebuilds the DB in React Query cache; every bug becomes a sync bug; payload schemas have to cover every code path.
- **Hybrid** → default to ping (simple, server-of-truth), graduate specific events to patch when lag is measurable.

### Patch safety

Every patch payload is validated with the registry's Zod schema **at the client boundary** before applying to cache:

```ts
const parsed = def.payload.safeParse(msg.data)
if (!parsed.success) {
  console.warn(`[realtime] invalid patch on ${type}.${msg.name}`, parsed.error)
  invalidation[entity.invalidationHook]({ [`${type}Id`]: id }) // fail-safe to ping
  return
}
qc.setQueryData(entity.queryKey(id), prev => applyPatch(prev, msg.name, parsed.data))
```

If a malformed broadcast arrives (out-of-date code, schema drift, attacker), it falls back to invalidate-and-refetch. **The cache is never corrupted by an unvalidated payload.**

---

## 6. Server publish API

Single entrypoint: `realtime` from `@/shared/services/ably/lib/publish.ts`.

```ts
// Entity events
realtime.entity('meeting', meetingId).emit('updated')                                      // ping
realtime.entity('meeting', meetingId).emit('status-changed', { status: 'completed' })      // patch
realtime.entity('proposal', proposalId).emit('viewed', { viewerId, at: nowIso() })

// List events
realtime.list('customer-pipeline').emit('item-moved', { itemId, from: 'fresh', to: 'rehash' })
realtime.list('dashboard').emit('action-queue-changed')

// User fanout
realtime.user(userId).notify({ type: 'proposal-approved', title: '...', href: '...' })
realtime.user(userId).deviceSync({ kind: 'navigate', href: '/dashboard/...' })

// Presence channel handle (for server-side history queries)
realtime.presence.channel('meeting', meetingId)
```

### Type safety

```ts
realtime.entity('meeting', id).emit('status-changed', { wrong: 'shape' })
//                                                    ^^^^^^^^^^^^^^^^^^^ TS ERROR — payload doesn't match registry schema

realtime.entity('meeting', id).emit('updated', { stuff: 1 })
//                                              ^^^^^^^^^^^ TS ERROR — 'updated' is ping mode, no payload allowed

realtime.entity('meeting', id).emit('status-changed')
//                                  ^^^^^^^^^^^^^^^^^ TS ERROR — patch mode requires payload
```

### Fire-and-forget semantics (intentional)

All `emit()` calls return `Promise<void>` but are typically `void`-prefixed at the call site. **Realtime broadcast is best-effort — it happens AFTER the DB write commits.** If Ably is down, the DB write still succeeds; clients eventually pick up changes via refetch-on-focus.

> **Realtime is a latency optimization, never a correctness dependency.**

### Failure handling

`channel.publish()` is wrapped in try/catch that logs the error with full context (channel, event, payload size) but does not rethrow. A separate Reactor message webhook + application logs surface any publish failures for monitoring.

### Where callers live

Inline in tRPC mutations, right after the DB write — same call-site pattern as today:

```ts
// Before (today's hardcoded pattern):
const channel = ably.channels.get(`meeting:${id}`)
void channel.publish('meeting.updated', { fields: Object.keys(rest) })

// After (kernel pattern):
void realtime.entity('meeting', id).emit('updated')

// Or if you want the patched fast-path:
if (rest.status) {
  void realtime.entity('meeting', id).emit('status-changed', { status: rest.status })
}
```

---

## 7. Reliability & missed events

Three layers of defense in depth:

1. **Ably `rewind: '2m'` on subscribe.** When `useChannel` mounts (or reconnects), Ably replays the last 2 minutes of events on the channel. Clients that briefly lost network catch up automatically. Configured per `useChannel` call.
2. **React Query `refetchOnWindowFocus: true`.** Already enabled globally. Catches anything beyond the rewind window.
3. **DB is source of truth.** Every query refetches on mount. Realtime never delivers data the DB doesn't already have.

### Why 2 minutes (not 30s, not 10m)

- 30s is too short — phone screen-locks for 45s+ are common.
- 10m means Ably retains a lot of history per channel — cost + complexity scales.
- 2m covers the common case (brief disconnect, tab switch, screen lock) and falls through cleanly to refetch-on-focus.

This is configurable per channel if needed in the future.

---

## 8. Reactor webhooks

Ably Reactor can POST to your server when specific things happen. The kernel scaffolds three endpoints from day 1, even though only one (presence audit) has a concrete day-1 use case.

```
/api/ably-webhooks/channel-lifecycle/route.ts   # first/last subscriber
/api/ably-webhooks/presence/route.ts            # enter/leave (REQUIRED for presence audit log)
/api/ably-webhooks/message/route.ts             # arbitrary published events (opt-in via Ably rule filter)
```

### HMAC signature verification

Every endpoint runs the request through `verifyAblyWebhook(req)` from `services/ably/lib/verify-webhook.ts`:

```ts
export async function verifyAblyWebhook(req: Request): Promise<unknown> {
  const sig = req.headers.get('x-ably-signature')
  const raw = await req.text()
  const keySecret = env.ABLY_API_KEY.split(':')[1]
  const expected = crypto.createHmac('sha256', keySecret).update(raw).digest('base64')
  if (!sig || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid Ably webhook signature')
  }
  return JSON.parse(raw)
}
```

### Reference handler — presence audit

```ts
// /api/ably-webhooks/presence/route.ts
export async function POST(req: Request) {
  const payload = await verifyAblyWebhook(req)
  const events = parsePresenceEvents(payload) // [{ channel, action, clientId, timestamp }, ...]
  await db.insert(realtimePresenceEvents).values(events.map(e => ({
    channel: e.channel,
    action: e.action,            // 'enter' | 'leave'
    userId: e.clientId,
    at: new Date(e.timestamp),
  })))
  return new Response('ok')
}
```

This powers "Oliver viewed proposal at 3:42pm" timeline events and "who's been viewing what" analytics for free, without client-side reporting (which would be unreliable — clients can lie or just close the tab).

### ngrok integration (local dev)

Webhook URLs in Ably Reactor config use:

```
${env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL}/api/ably-webhooks/*
```

Same convention QStash and Google Calendar push already use. Whichever worktree holds the ngrok tunnel receives the webhooks — see existing CLAUDE.md notes on tunnel ownership.

### A new database table

```sql
-- src/shared/db/schema/realtime-presence-events.ts
CREATE TABLE realtime_presence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  action text NOT NULL CHECK (action IN ('enter', 'leave')),
  user_id text NOT NULL,
  at timestamptz NOT NULL,
  CREATE INDEX idx_presence_channel_at ON realtime_presence_events (channel, at DESC),
  CREATE INDEX idx_presence_user_at ON realtime_presence_events (user_id, at DESC)
);
```

(Drizzle schema in actual migration.)

---

## 9. Client hooks API

Single entrypoint per scenario:

```tsx
// Entity sync — auto-invalidates or applies patches
const { status } = useEntitySync('meeting', meetingId)

// List sync — for dashboards, pipelines
const { status } = useListSync('customer-pipeline')

// Presence — who's viewing this right now
const { members, self } = usePresence('meeting', meetingId)

// Notifications — current user's bus
const { notifications, markRead } = useNotifications()
```

### `useEntitySync` reference impl

```ts
export function useEntitySync<T extends EntityName>(
  type: T,
  id: string,
): { status: ConnectionStatus } {
  const entity = entityRegistry[type]
  const invalidation = useInvalidation()
  const qc = useQueryClient()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useConnectionStateListener(s => setStatus(s.current))

  const handler = useCallback((msg: Ably.Message) => {
    const def = entity.events[msg.name]
    if (!def) return // unknown event — ignore for forward compat

    if (def.mode === 'ping') {
      const fn = invalidation[entity.invalidationHook]
      fn({ [`${type}Id`]: id })
      return
    }

    // Patch mode — validate, then apply to cache. On schema mismatch, fail safe.
    const parsed = def.payload.safeParse(msg.data)
    if (!parsed.success) {
      console.warn(`[realtime] invalid patch on ${type}.${msg.name}`, parsed.error)
      invalidation[entity.invalidationHook]({ [`${type}Id`]: id })
      return
    }
    qc.setQueryData(entity.queryKey(id), prev => applyPatch(prev, msg.name, parsed.data))
  }, [type, id, entity, invalidation, qc])

  useChannel(
    { channelName: ch.entity(type, id), options: { params: { rewind: '2m' } } },
    handler,
  )

  return { status }
}
```

### `usePresence` reference impl

```ts
export function usePresence(type: EntityName, id: string) {
  const session = useSession()
  const channelName = ch.entity(type, id)

  const { presenceData: members } = usePresenceListener(channelName)
  const { updateStatus } = useAblyPresence(channelName, {
    userId: session.user.id,
    userName: session.user.name,
    userImage: session.user.image,
    joinedAt: new Date().toISOString(),
  })

  return {
    members,                    // [{ userId, userName, userImage, joinedAt }, ...]
    self: session.user,
    updateStatus,               // for setting status text or extra metadata
  }
}
```

Auto-enter on mount, auto-leave on unmount. Ably handles abandoned sessions (closed-tab) via 15s presence timeout.

### Migration of existing code

`useMeetingSync(meetingId)` becomes a one-line re-export:

```ts
// src/features/meeting-flow/hooks/use-meeting-sync.ts
export const useMeetingSync = (id: string) => useEntitySync('meeting', id)
```

Eventually call sites adopt `useEntitySync('meeting', id)` directly and the wrapper is removed.

---

## 10. Observability

Two layers:

1. **Ably Dashboard** (already exists) — shows live channel activity, message rates, connection counts, history.
2. **In-app dev overlay** (`<RealtimeDebugger />`) — gated on `NEXT_PUBLIC_REALTIME_DEBUG=1`, rendered in root layout:
   - Connection state pill (top-right floating)
   - Active channel list with current capabilities
   - Live event log: last 50 events with timestamp, channel, event name, payload preview, mode badge (ping/patch)
   - "Force rewind" button
   - "Trigger test publish" form (uses the dev-only `/api/ably/dev-publish` endpoint)

Zero runtime cost when the env flag is off (component returns null, tree-shaken).

**Production telemetry:**
- Console-level: every publish failure logs `[realtime:publish-failed]` with full context.
- Future: integrate with the application's logging pipeline once one exists. Not part of v1.

---

## 11. Migration plan

| Phase | Scope | Outcome | Issue |
|-------|-------|---------|-------|
| **0. Scaffolding** | Rename `services/upstash/` → `services/ably/`, env var changes, token endpoint, registry skeleton, helpers | Existing meeting sync still works on migrated code path | TBD |
| **1. Meeting parity** | Migrate `meetings.router.ts` publish calls + `useMeetingSync` to kernel | Zero behavior change, new patterns proven | TBD |
| **2. Customers + Proposals + Projects** | Add to registry + publish calls in their routers + `useEntitySync` in their detail views | Entity-level sync live for all four core domains | TBD |
| **3. Lists** | `customer-pipeline` + `dashboard` list channels + `useListSync` integrations | Pipeline + dashboard go live | TBD |
| **4. Presence** | `usePresence` in meeting-flow + customer profile + proposal detail; presence avatar UI | "Who's viewing" indicators | TBD |
| **5. Notifications + Reactor** | User notification bus + presence audit webhook + `<RealtimeDebugger />` | Full platform | TBD |

### Explicit guardrail per phase

After each phase:
1. Run `pnpm tsc` + `pnpm lint` — must pass clean.
2. Manual smoke test in two tabs (mutate in tab A, observe in tab B).
3. Ably Dashboard sanity check — events show up where expected, capabilities match registry.

---

## 12. Testing strategy

- **Unit**:
  - `buildCapabilities()` with mocked CASL ability + DAL stubs for each role (super-admin, agent, agent-with-no-records, homeowner, share-token).
  - Each entity's `resolveAllowedIds` against an in-memory test fixture.
  - Payload schema validation for every patch event in registry.
  - Channel-name formatters round-trip stable.
- **Integration**:
  - Token endpoint with mocked sessions for each role.
  - Webhook endpoints with valid + invalid signatures.
  - End-to-end: publish via `realtime.entity()` server-side, subscribe in a Node test client, assert event received.
- **E2E (Playwright)**:
  - Two-tab test: open meeting in tab A, mutate, assert tab B receives update within 1s.
  - Two-user test (different sessions, same record): assert presence members + cross-user sync.
  - Customer-facing test: agent updates proposal, customer's proposal-flow tab reflects change.
- **Load/chaos** (deferred to post-v1):
  - Burst publish (100 events/sec) — verify rewind window is sufficient and no UI flicker.
  - Disconnect/reconnect — verify rewind delivers missed events.

---

## 13. Open questions / future work

These are intentionally deferred. Do not pre-solve them.

1. **Notification persistence.** Day-1 notifications are ephemeral (live only). When we want a notification center with read/unread state, add a `notifications` table, persist on emit, and have `useNotifications` query both DB + live channel. Out of v1 scope.
2. **Customer multi-resource share tokens.** Today share tokens are 1:1 with a proposal. If a customer has multiple proposals, we'd need either multiple tokens or a multi-resource token. Decide when use case appears.
3. **CASL object subjects.** When CASL migrates from string subjects (`'Meeting'`) to object subjects (`subject('Meeting', meeting)`), `resolveAllowedIds` can hoist its DAL filter into a CASL rule via `accessibleBy`. Big refactor — not in scope here.
4. **Cross-entity ripple events.** Today, a proposal status change publishes `entity:proposal:{id}.status-changed` only. If meeting view needs to react, the meeting view subscribes to its own meeting channel and re-fetches via the meeting's `getById` (which joins proposal data). If this becomes lag-sensitive, consider publishing to multiple channels per mutation. Defer until measured.
5. **Server-Sent Events fallback.** Some corporate networks block WebSockets. Ably auto-falls-back to long-polling (built-in). If we ever hit clients that even block that, revisit. Not now.
6. **Channel-name conflicts on entity rename.** If we ever rename `meeting → appointment`, in-flight clients on `entity:meeting:*` would lose updates. Mitigation: dual-publish during migration window. Document at the time.

---

## 14. Implementation checklist (resume here)

When picking this up:

- [ ] Confirm this spec is still current (read the entire doc).
- [ ] Read [§0 What exists today](#0-what-exists-today-the-starting-point) — verify nothing has drifted.
- [ ] Read [§4 Room Security](#4-room-security--token-issuance) — this is the trickiest part and the highest-stakes to get right.
- [ ] Verify CASL state (`src/shared/domains/permissions/abilities.ts`) hasn't changed in ways that affect the capability builder.
- [ ] Verify `useInvalidation` hooks haven't been renamed/restructured.
- [ ] Run `superpowers:writing-plans` skill against this spec to produce a phased implementation plan.
- [ ] Phase 0 first. Stop. Get a green tsc/lint. Then proceed.

---

## 15. Decisions log

For traceability — these are settled. Re-opening them requires explicit user input.

| # | Decision | Reason |
|---|----------|--------|
| 1 | All 6 use cases in scope (multi-device, multi-user, dashboard, customer-facing, presence, notifications) | User wants single kernel for all realtime needs |
| 2 | Entity-oriented convention (registry-driven), NOT thin primitives or full DDD kernel | Matches entity-first folder convention; low boilerplate; can grow into DDD later |
| 3 | JWT token auth with capability map; client never holds API key | Required for multi-user (B), customer-facing (D), and proper room security |
| 4 | Authorization defers to existing CASL + DAL row-checks + share tokens | Single source of truth for permissions; no parallel system |
| 5 | Hybrid payload mode (ping default, patch opt-in) declared in registry per event | Best of both: simple by default, fast where measured |
| 6 | Ably `rewind: '2m'` + React Query `refetchOnWindowFocus` | Belt and suspenders; cheap |
| 7 | Reactor webhooks scaffolded from day 1 (with HMAC verify) | Presence audit log is nearly free; the scaffold prevents reinventing the same pattern |
| 8 | In-app debug overlay gated on `NEXT_PUBLIC_REALTIME_DEBUG=1` | Saves hours of debugging; zero prod cost |
| 9 | Realtime is a latency optimization, never a correctness dependency. DB is source of truth. | If Ably is down, the app still works correctly — just less snappy |
| 10 | Channel-name formatters in one file; no string concatenation elsewhere | Single source of truth makes refactors safe |

---

**End of design spec.**
