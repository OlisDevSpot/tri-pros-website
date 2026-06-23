# Meta Pixel + CAPI — Phase 1 (Funnel-Half) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the funnel-half of the Meta measurement loop — browser Pixel + server CAPI dual-fire for `PageView` / `ViewContent` / `Lead` / `CompleteRegistration`, with a dormant `Schedule` seam and the attribution bundle persisted for phase 2.

**Architecture:** Meta is a first-class **provider** (`services/providers/meta/`) wrapped by a **sync service** (`meta-sync.service.ts`) and an **internal orchestrator** (`measurement.service.ts`); server events fire through a **QStash job**. The browser Pixel lives in the funnels domain (`funnels/lib/tracking/`) and auto-fires from a **convention emitter** wired into the funnel engine — zero per-funnel wiring. Browser and server share an `event_id` so Meta dedupes.

**Tech Stack:** Next.js 15 (App Router) · tRPC · Drizzle · Zod · Upstash QStash · `motion/react` · Meta Graph API (Conversions API) · browser `fbq`.

**Spec:** `docs/superpowers/specs/2026-06-23-meta-pixel-capi-measurement-design.md` (read it first).

## Global Constraints

- **Work on `main`. Do NOT create a branch.** (User directive; stage files explicitly per task so unrelated WIP isn't swept in.)
- **No test runner exists** in this repo (no vitest/jest, zero `*.test.ts`). Per project convention, each task's verification loop is **`pnpm tsc` → `pnpm lint` → commit**. Do NOT scaffold a test framework. Runtime behavior is verified via Meta's **Test Events** tool (Task 15).
- **Never run `pnpm build`** (memory rule). Use `pnpm tsc` for type-checks.
- **Meta is a provider** — follow `docs/codebase-conventions/service-architecture.md` exactly: one `client.ts` entry point, `schemas/` sibling of `lib/`, env via `createProviderConfig` (all fields `.optional()`), provider signatures carry no domain types, providers never import DAL.
- **Server-side side effects go through QStash jobs** — never raw `void fetch().catch()`. Meta events are "cosmetic" criticality → `void metaCapiEventJob.dispatch(...)`.
- **One React component per file. Named exports only. No `export default`** except Next.js route/layout files which require it (`funnels/layout.tsx` stays default).
- **Path alias:** `@/` → `src/`.
- **Lint:** `perfectionist/sort-imports` is enforced — keep imports sorted (external before internal, alphabetical); `pnpm lint --fix` auto-sorts if needed.
- **Env names (verbatim):** `NEXT_PUBLIC_META_PIXEL_ID` (public), `META_DATASET_ID`, `META_CAPI_TOKEN` (server-only). Existing `META_ACCESS_TOKEN` (ads CLI) is untouched.
- **Standard event names (verbatim):** `PageView`, `ViewContent`, `Lead`, `Schedule`, `CompleteRegistration`. Custom (phase 2): `MeetingComplete`, `ProposalSent`. Graph API version: `v21.0`.

---

## File Structure

**New (provider tier):**
- `src/shared/services/providers/meta/lib/config.ts` — env fragment + `createProviderConfig`
- `src/shared/services/providers/meta/constants/index.ts` — Graph version, base URL, event names, action sources
- `src/shared/services/providers/meta/schemas/primitives.ts` — shared Zod primitives
- `src/shared/services/providers/meta/schemas/server-event.ts` — CAPI payload Zod (what we send)
- `src/shared/services/providers/meta/client.ts` — `metaClient` singleton: `sendConversions`, `hashUserData`
- `src/shared/services/providers/meta/types.ts` — type re-exports for caller signatures
- `src/shared/services/providers/meta/DOCS.md` — provider usage rules + dual-fire invariant

**New (service tiers + durability):**
- `src/shared/services/meta-sync.service.ts` — domain → CAPI translation (`trackLead`)
- `src/shared/services/measurement.service.ts` — orchestrator (`trackFunnelLead`)
- `src/shared/services/providers/upstash/jobs/meta-capi-event.ts` — durable dispatch

**New (browser tracking, funnels domain):**
- `src/shared/domains/funnels/lib/tracking/fire-pixel.ts` — `fbq` wrapper + `mintEventId`
- `src/shared/domains/funnels/lib/tracking/pixel-loader.tsx` — one-time fbq script loader
- `src/shared/domains/funnels/lib/tracking/convention-map.ts` — step-kind → event map
- `src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts` — lifecycle emitter hook

**Modified:**
- `src/shared/config/server-env.ts` — spread `metaEnvFragment`, register `metaConfigMeta`
- `src/app/(frontend)/funnels/layout.tsx` — mount `<PixelLoader/>`
- `src/shared/domains/funnels/ui/funnel-engine.tsx` — invoke `useFunnelTracking`
- `src/shared/entities/customers/schemas/index.ts` — add `meta.{fbp,fbc}` to funnel source
- `src/shared/domains/funnels/lib/build-lead-input.ts` — capture `_fbp`/`_fbc` cookies
- `src/trpc/routers/funnels.router.ts` — `submitLead` gains `eventId`+`pixel`; dispatch Lead job; add `trackFunnelEvent`
- `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` — mint eventId, `firePixel('Lead')`, thread into submit
- `src/app/api/qstash-jobs/route.ts` — register `metaCapiEventJob`
- The Privacy Policy page — disclosure line

**Phase 2 (NOT in this plan — its own future plan):** CRM-half hooks (`Contact`/`MeetingComplete`/`ProposalSent`/`Purchase`) on entity transitions; value-based `Purchase`.

---

### Task 1: Meta provider env config

**Files:**
- Create: `src/shared/services/providers/meta/lib/config.ts`
- Modify: `src/shared/config/server-env.ts`

**Interfaces:**
- Produces: `metaEnvFragment` (Zod), `getMetaConfig(): MetaRuntimeConfig`, `isMetaConfigured(): boolean`, `metaConfigMeta`, and `MetaRuntimeConfig { pixelId, datasetId, capiToken }`.

- [ ] **Step 1: Write `config.ts`** (mirrors `providers/twilio/lib/config.ts`)

```ts
import { z } from 'zod'

import { createProviderConfig } from '@/shared/config/create-provider-config'

/**
 * Meta (Pixel + Conversions API) env fragment + runtime-config builder.
 *
 * NEXT_PUBLIC_META_PIXEL_ID is also read directly in the browser by the pixel
 * loader; it is included here so the server CAPI path and the boot banner see
 * one source of truth. META_CAPI_TOKEN is server-only and must never ship to
 * the client. META_DATASET_ID equals the Pixel ID (the CAPI events endpoint
 * target) — kept as its own var so a future standalone dataset can diverge.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
export const metaEnvFragment = z.object({
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  META_DATASET_ID: z.string().optional(),
  META_CAPI_TOKEN: z.string().optional(),
})

export type ParsedMetaEnv = z.infer<typeof metaEnvFragment>

export interface MetaRuntimeConfig {
  pixelId: string
  datasetId: string
  capiToken: string
}

const helpers = createProviderConfig({
  provider: 'meta',
  fragment: metaEnvFragment,
  requiredKeys: ['NEXT_PUBLIC_META_PIXEL_ID', 'META_DATASET_ID', 'META_CAPI_TOKEN'],
  toConfig: (parsed): MetaRuntimeConfig => ({
    pixelId: parsed.NEXT_PUBLIC_META_PIXEL_ID!,
    datasetId: parsed.META_DATASET_ID!,
    capiToken: parsed.META_CAPI_TOKEN!,
  }),
})

export const buildMetaConfig = helpers.build
export const getMetaConfig = helpers.get
export const isMetaConfigured = helpers.isConfigured
export const metaConfigMeta = helpers.configMeta
```

- [ ] **Step 2: Wire into `server-env.ts`** — add the import (sorted with other provider fragment imports), spread the fragment into the schema, and register the meta meta in the boot-banner `metas` array. Mirror exactly how `twilioEnvFragment` / `twilioConfigMeta` are already wired (search the file for `twilio` and add a sibling `meta` line in each of the three spots: import, `...metaEnvFragment.shape`, banner `metas` array).

- [ ] **Step 3: Type-check**

Run: `pnpm tsc`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: clean (run `pnpm lint --fix` first if import order trips).

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/meta/lib/config.ts src/shared/config/server-env.ts
git commit -m "feat(meta): add provider env config (pixel/dataset/capi token)"
```

---

### Task 2: Meta provider constants + schemas

**Files:**
- Create: `src/shared/services/providers/meta/constants/index.ts`
- Create: `src/shared/services/providers/meta/schemas/primitives.ts`
- Create: `src/shared/services/providers/meta/schemas/server-event.ts`

**Interfaces:**
- Produces: `META_GRAPH_VERSION`, `META_GRAPH_BASE_URL`, `META_EVENT` (event-name constants), `META_ACTION_SOURCE`; `metaServerEventSchema` (Zod) and `MetaServerEvent` (inferred type), `metaUserDataSchema`, `metaCustomDataSchema`.

- [ ] **Step 1: Write `constants/index.ts`**

```ts
/** Graph API version pinned for the Conversions API. Bump deliberately. */
export const META_GRAPH_VERSION = 'v21.0'
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`

/** Standard + custom Meta event names. Values are Meta's canonical strings. */
export const META_EVENT = {
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  Lead: 'Lead',
  Schedule: 'Schedule',
  CompleteRegistration: 'CompleteRegistration',
  // phase 2 (custom events) — declared now for one source of truth:
  Contact: 'Contact',
  MeetingComplete: 'MeetingComplete',
  ProposalSent: 'ProposalSent',
  Purchase: 'Purchase',
} as const

export type MetaEventName = (typeof META_EVENT)[keyof typeof META_EVENT]

/** action_source for events that originate on the website/server. */
export const META_ACTION_SOURCE = {
  website: 'website',
  systemGenerated: 'system_generated',
} as const
```

- [ ] **Step 2: Write `schemas/primitives.ts`**

```ts
import { z } from 'zod'

/** A SHA-256 hex string (advanced-matching identifier). */
export const hashedId = z.string().regex(/^[a-f0-9]{64}$/)

/** Unix time in SECONDS (Meta requires seconds, not ms). */
export const unixSeconds = z.number().int().positive()
```

- [ ] **Step 3: Write `schemas/server-event.ts`**

```ts
import { z } from 'zod'

import { hashedId, unixSeconds } from '@/shared/services/providers/meta/schemas/primitives'

/**
 * user_data — identifiers Meta matches on. `ph`/`em`/`external_id` are arrays of
 * SHA-256 hashes (advanced matching). `fbp`/`fbc` are the raw pixel cookies
 * (NOT hashed). `client_ip_address`/`client_user_agent` improve match quality.
 */
export const metaUserDataSchema = z.object({
  ph: z.array(hashedId).optional(),
  em: z.array(hashedId).optional(),
  external_id: z.array(hashedId).optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  client_ip_address: z.string().optional(),
  client_user_agent: z.string().optional(),
})

export const metaCustomDataSchema = z.object({
  content_category: z.string().optional(),
  content_name: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
}).passthrough()

export const metaServerEventSchema = z.object({
  event_name: z.string(),
  event_time: unixSeconds,
  event_id: z.string(),
  action_source: z.string(),
  event_source_url: z.string().optional(),
  user_data: metaUserDataSchema,
  custom_data: metaCustomDataSchema.optional(),
})

export type MetaServerEvent = z.infer<typeof metaServerEventSchema>
export type MetaUserData = z.infer<typeof metaUserDataSchema>
export type MetaCustomData = z.infer<typeof metaCustomDataSchema>
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/meta/constants src/shared/services/providers/meta/schemas
git commit -m "feat(meta): add CAPI constants + server-event schemas"
```

---

### Task 3: Meta provider client (`metaClient`)

**Files:**
- Create: `src/shared/services/providers/meta/client.ts`
- Create: `src/shared/services/providers/meta/types.ts`
- Create: `src/shared/services/providers/meta/DOCS.md`

**Interfaces:**
- Consumes: `getMetaConfig` (Task 1), `META_GRAPH_BASE_URL` (Task 2), `MetaServerEvent` (Task 2).
- Produces: `metaClient.sendConversions(events: MetaServerEvent[], opts?: { testEventCode?: string }): Promise<void>` and `metaClient.hashUserData(input: { phone?: string | null, email?: string | null }): { ph?: string[], em?: string[] }` and `metaClient.hashExternalId(id: string): string`.

- [ ] **Step 1: Write `client.ts`**

```ts
import { createHash } from 'node:crypto'

import { META_GRAPH_BASE_URL } from '@/shared/services/providers/meta/constants'
import { getMetaConfig } from '@/shared/services/providers/meta/lib/config'
import type { MetaServerEvent } from '@/shared/services/providers/meta/schemas/server-event'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Meta normalization: trim, lowercase, strip spaces. Phone keeps digits only. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
function normalizePhone(phone: string): string {
  // Meta wants digits incl. country code, no '+' or punctuation. Funnel phones
  // are E.164 (+1XXXXXXXXXX); stripping non-digits yields 1XXXXXXXXXX.
  return phone.replace(/\D/g, '')
}

function createMetaClient() {
  return {
    /**
     * Hash phone/email into advanced-matching arrays. Returns only the keys
     * present. Pure local helper exposed as a client method per
     * client-is-the-superset-entry-point.
     */
    hashUserData(input: { phone?: string | null, email?: string | null }): { ph?: string[], em?: string[] } {
      const out: { ph?: string[], em?: string[] } = {}
      if (input.phone) {
        out.ph = [sha256(normalizePhone(input.phone))]
      }
      if (input.email) {
        out.em = [sha256(normalizeEmail(input.email))]
      }
      return out
    },

    /** Hash a stable internal id (customer.id) for `external_id`. */
    hashExternalId(id: string): string {
      return sha256(id.trim().toLowerCase())
    },

    /**
     * Send one or more server events to the Conversions API. Throws on non-2xx
     * so the QStash job handler can retry. Never called with domain types.
     */
    async sendConversions(events: MetaServerEvent[], opts?: { testEventCode?: string }): Promise<void> {
      const { datasetId, capiToken } = getMetaConfig()
      const url = `${META_GRAPH_BASE_URL}/${datasetId}/events`
      const body: Record<string, unknown> = { data: events, access_token: capiToken }
      if (opts?.testEventCode) {
        body.test_event_code = opts.testEventCode
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`[meta] CAPI send failed ${res.status}: ${detail}`)
      }
    },
  }
}

export const metaClient = createMetaClient()
export type MetaClient = ReturnType<typeof createMetaClient>
```

- [ ] **Step 2: Write `types.ts`**

```ts
export type { MetaCustomData, MetaServerEvent, MetaUserData } from '@/shared/services/providers/meta/schemas/server-event'
export type { MetaEventName } from '@/shared/services/providers/meta/constants'
```

- [ ] **Step 3: Write `DOCS.md`**

```markdown
# Meta provider (Pixel + Conversions API)

Server-only Graph API client for the Conversions API (CAPI). The browser Pixel
(`fbq`) is NOT here — it lives in `src/shared/domains/funnels/lib/tracking/`
(providers are server-only).

## Invariants
- **Dual-fire + dedup:** browser-stage events fire from the Pixel AND from CAPI
  with the SAME `event_id`. Meta merges them. Never send a server-only `event_id`
  that a browser fire also used unless they are the same logical event.
- **One Pixel/Dataset** for all funnels. Trade rides on `custom_data.content_category`,
  funnel slug on `content_name`.
- **Hashing is server-side.** `hashUserData` SHA-256s normalized phone/email.
  The browser sends no PII.
- **No domain types** cross this client's signatures — translation lives in
  `meta-sync.service.ts`.

## Entry point
`metaClient.sendConversions(events, { testEventCode? })` · `metaClient.hashUserData(...)` ·
`metaClient.hashExternalId(id)`.
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/meta/client.ts src/shared/services/providers/meta/types.ts src/shared/services/providers/meta/DOCS.md
git commit -m "feat(meta): add metaClient (sendConversions + advanced-matching hashing)"
```

---

### Task 4: `meta-sync.service.ts` — domain → CAPI translation

**Files:**
- Create: `src/shared/services/meta-sync.service.ts`

**Interfaces:**
- Consumes: `metaClient` (Task 3), `META_EVENT` / `META_ACTION_SOURCE` (Task 2), `isMetaConfigured` (Task 1), `MetaServerEvent` (Task 2).
- Produces: `metaSyncService.trackLead(args: LeadEventArgs): Promise<void>` where
  `LeadEventArgs = { eventId: string, eventTime: number, phone?: string | null, externalId: string, fbp?: string | null, fbc?: string | null, clientIp?: string | null, clientUserAgent?: string | null, eventSourceUrl?: string | null, contentCategory?: string | null, contentName?: string | null, testEventCode?: string | null }`.

- [ ] **Step 1: Write `meta-sync.service.ts`**

```ts
import { META_ACTION_SOURCE, META_EVENT } from '@/shared/services/providers/meta/constants'
import { metaClient } from '@/shared/services/providers/meta/client'
import { isMetaConfigured } from '@/shared/services/providers/meta/lib/config'
import type { MetaServerEvent, MetaUserData } from '@/shared/services/providers/meta/schemas/server-event'

export interface LeadEventArgs {
  eventId: string
  eventTime: number
  phone?: string | null
  externalId: string
  fbp?: string | null
  fbc?: string | null
  clientIp?: string | null
  clientUserAgent?: string | null
  eventSourceUrl?: string | null
  contentCategory?: string | null
  contentName?: string | null
  testEventCode?: string | null
}

function buildUserData(args: LeadEventArgs): MetaUserData {
  const hashed = metaClient.hashUserData({ phone: args.phone })
  const userData: MetaUserData = {
    ...hashed,
    external_id: [metaClient.hashExternalId(args.externalId)],
  }
  if (args.fbp) {
    userData.fbp = args.fbp
  }
  if (args.fbc) {
    userData.fbc = args.fbc
  }
  if (args.clientIp) {
    userData.client_ip_address = args.clientIp
  }
  if (args.clientUserAgent) {
    userData.client_user_agent = args.clientUserAgent
  }
  return userData
}

/**
 * ACL facade: wraps metaClient in domain operations and translates a domain
 * event into the CAPI wire shape. No DB access. Phase 1 = trackLead; phase 2
 * adds trackContact/trackMeetingComplete/trackProposalSent/trackPurchase.
 */
function createMetaSyncService() {
  return {
    async trackLead(args: LeadEventArgs): Promise<void> {
      // Config absent (local dev / unprovisioned) → no-op. Keeps the loop inert
      // until Oliver creates the dataset + token.
      if (!isMetaConfigured()) {
        return
      }
      const event: MetaServerEvent = {
        event_name: META_EVENT.Lead,
        event_time: args.eventTime,
        event_id: args.eventId,
        action_source: META_ACTION_SOURCE.website,
        event_source_url: args.eventSourceUrl ?? undefined,
        user_data: buildUserData(args),
        custom_data: {
          content_category: args.contentCategory ?? undefined,
          content_name: args.contentName ?? undefined,
        },
      }
      await metaClient.sendConversions([event], {
        testEventCode: args.testEventCode ?? undefined,
      })
    },
  }
}

export type MetaSyncService = ReturnType<typeof createMetaSyncService>
export const metaSyncService = createMetaSyncService()
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/meta-sync.service.ts
git commit -m "feat(meta): add meta-sync service (domain Lead event -> CAPI payload)"
```

---

### Task 5: `measurement.service.ts` — orchestrator

**Files:**
- Create: `src/shared/services/measurement.service.ts`

**Interfaces:**
- Consumes: `metaSyncService.trackLead` + `LeadEventArgs` (Task 4).
- Produces: `measurementService.trackFunnelLead(args: FunnelLeadArgs): Promise<void>` where `FunnelLeadArgs = LeadEventArgs` (phase 1 forwards directly; phase 2 will add DAL reads here for value-based Purchase, which is why this tier exists).

- [ ] **Step 1: Write `measurement.service.ts`**

```ts
import { metaSyncService } from '@/shared/services/meta-sync.service'
import type { LeadEventArgs } from '@/shared/services/meta-sync.service'

export type FunnelLeadArgs = LeadEventArgs

/**
 * Internal orchestrator for the Meta measurement loop. Phase 1 forwards the
 * funnel Lead straight to meta-sync (all data is in hand at submit time, so no
 * DAL read is needed). Phase 2 grows here: CRM-half events (Contact/Meeting/
 * Proposal/Purchase) read entities via DAL to assemble user_data + value, then
 * call the corresponding meta-sync method.
 */
function createMeasurementService() {
  return {
    async trackFunnelLead(args: FunnelLeadArgs): Promise<void> {
      await metaSyncService.trackLead(args)
    },
  }
}

export type MeasurementService = ReturnType<typeof createMeasurementService>
export const measurementService = createMeasurementService()
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/measurement.service.ts
git commit -m "feat(meta): add measurement service (funnel Lead orchestrator)"
```

---

### Task 6: QStash job `meta-capi-event`

**Files:**
- Create: `src/shared/services/providers/upstash/jobs/meta-capi-event.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`

**Interfaces:**
- Consumes: `measurementService.trackFunnelLead` + `FunnelLeadArgs` (Task 5), `createJob` (existing).
- Produces: `metaCapiEventJob` with payload `{ event: 'Lead', args: FunnelLeadArgs }`. Dispatched via `void metaCapiEventJob.dispatch(...)`.

- [ ] **Step 1: Write the job**

```ts
import { measurementService } from '@/shared/services/measurement.service'
import type { FunnelLeadArgs } from '@/shared/services/measurement.service'

import { createJob } from '../lib/create-job'

/**
 * Durable server-side CAPI dispatch. "Cosmetic" criticality — a dropped event
 * degrades Meta optimization but is not a data-integrity bug — so call sites
 * use `void metaCapiEventJob.dispatch(...)`. QStash still gives durable enqueue
 * + retries; Meta dedupes on event_id so a retry double-send is harmless.
 *
 * Phase 1 handles only 'Lead'. Phase 2 extends the discriminated payload with
 * Contact / MeetingComplete / ProposalSent / Purchase variants.
 */
export type MetaCapiEventPayload = { event: 'Lead', args: FunnelLeadArgs }

export const metaCapiEventJob = createJob(
  'meta-capi-event',
  async (payload: MetaCapiEventPayload) => {
    if (payload.event === 'Lead') {
      await measurementService.trackFunnelLead(payload.args)
    }
  },
)
```

- [ ] **Step 2: Register in `route.ts`** — add the import (sorted) and append `metaCapiEventJob` to the `jobs: Job[]` array, mirroring how `syncMeetingToGcalJob` is imported and listed.

```ts
import { metaCapiEventJob } from '@/shared/services/providers/upstash/jobs/meta-capi-event'
// ...and add `metaCapiEventJob,` to the `jobs` array.
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/upstash/jobs/meta-capi-event.ts "src/app/api/qstash-jobs/route.ts"
git commit -m "feat(meta): add meta-capi-event QStash job + register it"
```

---

### Task 7: Browser `firePixel` wrapper + `mintEventId`

**Files:**
- Create: `src/shared/domains/funnels/lib/tracking/fire-pixel.ts`

**Interfaces:**
- Produces: `mintEventId(): string`; `firePixel(event: string, params?: { eventId?: string, contentCategory?: string, contentName?: string, custom?: Record<string, unknown> }): void`; `readFbCookies(): { fbp: string | null, fbc: string | null }`. All are browser-only (guard on `typeof window`).

- [ ] **Step 1: Write `fire-pixel.ts`**

```ts
/**
 * Browser Pixel surface. Nobody calls raw `fbq` — they call firePixel(). The
 * loader (pixel-loader.tsx) defines window.fbq; this wrapper is a no-op until
 * it exists, so calls before load (or when the pixel is unconfigured) are safe.
 */

interface Fbq {
  (...args: unknown[]): void
}
declare global {
  interface Window {
    fbq?: Fbq
  }
}

/** Shared dedup id for a browser event and its server CAPI twin. */
export function mintEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for ancient browsers; randomUUID is universal on funnel targets.
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/** Read Meta's attribution cookies set by the pixel/click. */
export function readFbCookies(): { fbp: string | null, fbc: string | null } {
  if (typeof document === 'undefined') {
    return { fbp: null, fbc: null }
  }
  const read = (name: string): string | null => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  }
  return { fbp: read('_fbp'), fbc: read('_fbc') }
}

export function firePixel(
  event: string,
  params?: { eventId?: string, contentCategory?: string, contentName?: string, custom?: Record<string, unknown> },
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return
  }
  const customData: Record<string, unknown> = { ...params?.custom }
  if (params?.contentCategory) {
    customData.content_category = params.contentCategory
  }
  if (params?.contentName) {
    customData.content_name = params.contentName
  }
  window.fbq('track', event, customData, params?.eventId ? { eventID: params.eventId } : undefined)
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/lib/tracking/fire-pixel.ts
git commit -m "feat(meta): add browser firePixel wrapper + event-id mint + fb cookie reader"
```

---

### Task 8: Pixel loader + mount in funnel layout

**Files:**
- Create: `src/shared/domains/funnels/lib/tracking/pixel-loader.tsx`
- Modify: `src/app/(frontend)/funnels/layout.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_META_PIXEL_ID` (env, public).
- Produces: `<PixelLoader/>` — injects the fbq base script + fires the initial `PageView` once. Renders nothing when the pixel id is absent (local dev).

- [ ] **Step 1: Write `pixel-loader.tsx`**

```tsx
'use client'

import Script from 'next/script'

/**
 * One-time Meta Pixel base-code loader. Mounted by the funnel layout so it
 * loads on every funnel screen but nowhere else in the app. Renders nothing
 * (and loads no script) when NEXT_PUBLIC_META_PIXEL_ID is unset — local dev and
 * unprovisioned environments stay inert. Standard Meta snippet; the initial
 * PageView fires here, all later events go through firePixel().
 */
export function PixelLoader() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  if (!pixelId) {
    return null
  }
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');`}
    </Script>
  )
}
```

- [ ] **Step 2: Mount in `funnels/layout.tsx`** — add the import and render `<PixelLoader/>` inside the wrapper div. Replace the "Meta Pixel mounts here in Plan 3" comment.

```tsx
import type { ReactNode } from 'react'

import { PixelLoader } from '@/shared/domains/funnels/lib/tracking/pixel-loader'

// Funnel-only chrome. No marketing nav/footer — funnels are deliberately
// isolated from the (site) group. Meta Pixel loads here (Phase 1).
export default function FunnelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="funnel-light min-h-dvh bg-background text-foreground">
      <PixelLoader />
      {children}
    </div>
  )
}
```
(Keep the existing `text-foreground` docblock comment above the return — it is load-bearing per the funnel light-theme memory.)

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/lib/tracking/pixel-loader.tsx "src/app/(frontend)/funnels/layout.tsx"
git commit -m "feat(meta): mount Meta Pixel loader in funnel layout (PageView)"
```

---

### Task 9: Convention emitter (`ViewContent` + `CompleteRegistration`)

**Files:**
- Create: `src/shared/domains/funnels/lib/tracking/convention-map.ts`
- Create: `src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`

**Interfaces:**
- Consumes: `firePixel` (Task 7), `FunnelSpec` + `FunnelEngineApi` (existing), `StepKind` (existing types).
- Produces: `useFunnelTracking(spec: FunnelSpec, engine: FunnelEngineApi): void` — browser-only lifecycle emitter. Fires `ViewContent` once on the first answer of any step, and `CompleteRegistration` once when a terminal `confirmation` step is reached. `PageView` is owned by the loader (Task 8); `Lead` is owned by the PII step (Task 12). Uses a per-session fired-once guard.

- [ ] **Step 1: Write `convention-map.ts`**

```ts
import type { StepKind } from '@/shared/domains/funnels/types'

/**
 * Convention: which browser-only Pixel event a step KIND implies on completion.
 * Binding to kind (not step id) is what makes the suite scale to N funnels with
 * zero per-funnel wiring. `pii-form` (Lead) and `datetime` (Schedule) are NOT
 * here — they are dual-fire (need a server twin with a threaded event_id) and
 * are fired at their own submit sites, not from this lifecycle emitter.
 */
export const STEP_KIND_BROWSER_EVENT: Partial<Record<StepKind, string>> = {
  confirmation: 'CompleteRegistration',
}
```

- [ ] **Step 2: Write `use-funnel-tracking.ts`**

```ts
'use client'

import { useEffect, useRef } from 'react'

import { STEP_KIND_BROWSER_EVENT } from '@/shared/domains/funnels/lib/tracking/convention-map'
import { firePixel, mintEventId } from '@/shared/domains/funnels/lib/tracking/fire-pixel'
import type { FunnelEngineApi } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import type { FunnelSpec } from '@/shared/domains/funnels/types'

/**
 * Browser-only convention emitter. Auto-fires the lifecycle events the engine
 * already implies:
 *   - ViewContent: first time ANY step receives an answer (engagement signal).
 *   - CompleteRegistration: when a terminal `confirmation` step is reached.
 * PageView is fired by the pixel loader; Lead is fired by the PII step (dual-fire
 * needs a threaded event_id). A per-mount guard prevents re-fires on back-nav.
 */
export function useFunnelTracking(spec: FunnelSpec, engine: FunnelEngineApi): void {
  const fired = useRef<Set<string>>(new Set())
  const contentCategory = spec.pixel.contentCategory
  const contentName = spec.slug

  // ViewContent — first answer on any step.
  const hasAnyAnswer = Object.values(engine.answers).some(v => v != null)
  useEffect(() => {
    if (hasAnyAnswer && !fired.current.has('ViewContent')) {
      fired.current.add('ViewContent')
      firePixel('ViewContent', { eventId: mintEventId(), contentCategory, contentName })
    }
  }, [hasAnyAnswer, contentCategory, contentName])

  // CompleteRegistration (and any future browser-only kind) — on step kind.
  const stepKind = engine.step.kind
  useEffect(() => {
    const event = STEP_KIND_BROWSER_EVENT[stepKind]
    if (event && !fired.current.has(event)) {
      fired.current.add(event)
      firePixel(event, { eventId: mintEventId(), contentCategory, contentName })
    }
  }, [stepKind, contentCategory, contentName])
}
```

- [ ] **Step 3: Wire into `funnel-engine.tsx`** — add the import (sorted) and call the hook right after `const engine = useFunnelEngine(spec)`:

```tsx
import { useFunnelTracking } from '@/shared/domains/funnels/lib/tracking/use-funnel-tracking'
// ...inside FunnelEngine, after `const utm = useFunnelUtm(slug)`:
  useFunnelTracking(spec, engine)
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/lib/tracking/convention-map.ts src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts src/shared/domains/funnels/ui/funnel-engine.tsx
git commit -m "feat(meta): convention emitter for ViewContent + CompleteRegistration"
```

---

### Task 10: Persist the attribution bundle (`_fbp`/`_fbc`)

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts`
- Modify: `src/shared/domains/funnels/lib/build-lead-input.ts`

**Interfaces:**
- Produces: the funnel `source` variant in `leadMetaSchema` gains `meta?: { fbp: string | null, fbc: string | null }`. `buildLeadInput` populates it from `readFbCookies()` so phase-2 CRM events can replay attribution. `external_id` is NOT stored (it equals `customer.id`).

- [ ] **Step 1: Extend the funnel source variant in `leadMetaSchema`** — inside the `z.object({ kind: z.literal('funnel'), ... })` member, add a `meta` field after `utm`:

```ts
      meta: z.object({
        fbp: z.string().nullable(),
        fbc: z.string().nullable(),
      }).partial().optional(),
```

- [ ] **Step 2: Populate it in `build-lead-input.ts`** — import the cookie reader and add `meta` to `source`:

```ts
import { readFbCookies } from '@/shared/domains/funnels/lib/tracking/fire-pixel'
// ...inside buildLeadInput, before the return:
  const { fbp, fbc } = readFbCookies()
// ...within source: { kind: 'funnel', offer, funnelSlug, utm: ctx.utm, ... }
      meta: { fbp, fbc },
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean (note: `build-lead-input.ts` is `'use client'`-safe — `readFbCookies` guards on `document`).

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/schemas/index.ts src/shared/domains/funnels/lib/build-lead-input.ts
git commit -m "feat(meta): persist _fbp/_fbc attribution bundle on funnel leads"
```

---

### Task 11: `submitLead` — accept `eventId`+`pixel`, dispatch the Lead CAPI twin

**Files:**
- Modify: `src/trpc/routers/funnels.router.ts`

**Interfaces:**
- Consumes: `metaCapiEventJob` (Task 6).
- Produces: `submitLead` input gains `eventId?: string` and `pixel?: { contentCategory: string, contentName: string }`. After a successful ingest, when `eventId` is present, dispatches the Lead CAPI job (fire-and-forget). Reads `_fbp`/`_fbc` from `input.leadMetaJSON.source` (funnel variant) to replay attribution.

- [ ] **Step 1: Add imports** (sorted) at the top of the router:

```ts
import { metaCapiEventJob } from '@/shared/services/providers/upstash/jobs/meta-capi-event'
import { clientIp } from '../lib/client-ip'  // already imported — do not duplicate
```

- [ ] **Step 2: Extend the `submitLead` input** — add two optional fields to the `z.object({...})`:

```ts
      eventId: z.string().optional(),
      pixel: z.object({
        contentCategory: z.string(),
        contentName: z.string(),
      }).optional(),
```

- [ ] **Step 3: Dispatch the CAPI Lead twin** — after the existing `return { customerId: result.data.customer.id }` is computed, replace the final return with a dispatch + return. Insert before `return`:

```ts
      const customerId = result.data.customer.id

      // Server CAPI twin of the browser `Lead` pixel — same event_id → Meta
      // dedupes. Cosmetic criticality: a dropped enqueue only weakens optimization.
      if (input.eventId) {
        const ip = clientIp((ctx as { req?: Request }).req)
        const ua = (ctx as { req?: Request }).req?.headers.get('user-agent') ?? null
        const fb = input.leadMetaJSON.source?.kind === 'funnel'
          ? input.leadMetaJSON.source.meta
          : undefined
        void metaCapiEventJob.dispatch({
          event: 'Lead',
          args: {
            eventId: input.eventId,
            eventTime: Math.floor(Date.now() / 1000),
            phone: input.phone,
            externalId: customerId,
            fbp: fb?.fbp ?? null,
            fbc: fb?.fbc ?? null,
            clientIp: ip,
            clientUserAgent: ua,
            contentCategory: input.pixel?.contentCategory ?? null,
            contentName: input.pixel?.contentName ?? null,
          },
        })
      }

      return { customerId }
```
(Replace the existing `return { customerId: result.data.customer.id }` line — do not leave both.)

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. (If TS narrows `input.leadMetaJSON.source` oddly, confirm the funnel-variant `.meta` access is guarded by the `kind === 'funnel'` check as written.)

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/funnels.router.ts
git commit -m "feat(meta): submitLead fires server CAPI Lead twin (dedup via event_id)"
```

---

### Task 12: PII step — mint `event_id`, fire browser `Lead`, thread into submit

**Files:**
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx`

**Interfaces:**
- Consumes: `firePixel` + `mintEventId` (Task 7); the extended `submitLead` input (Task 11); `ctx` + `spec.pixel.contentCategory` (via props).
- Produces: on PII submit, the browser `Lead` pixel fires with a fresh `eventId`, and that same `eventId` + `pixel: { contentCategory, contentName }` are passed into the `submitLead` mutation so the server twin dedupes.

- [ ] **Step 1: Read the current submit handler.** Open `pii-form-step.tsx` and locate where `submit.mutateAsync(...)` is called with the `buildLeadInput(...)` result (around the form `onSubmit`). Note the variable holding the lead input and the `ctx` prop.

- [ ] **Step 2: Add imports** (sorted):

```ts
import { firePixel, mintEventId } from '@/shared/domains/funnels/lib/tracking/fire-pixel'
```

- [ ] **Step 3: Mint + fire + thread.** In the submit handler, immediately before the `submit.mutateAsync(...)` call, mint the id and fire the browser pixel; then add `eventId` + `pixel` to the mutation payload. The `contentCategory` comes from the funnel spec — it is available via the step's `ctx` only as `ctx.slug`; the trade category is `ctx`-adjacent, so pass it through from the engine. Use `ctx.slug` as `contentName` and derive `contentCategory` from the funnel registry:

```ts
    const eventId = mintEventId()
    const leadInput = buildLeadInput({ ctx, pii: data, answers })
    firePixel('Lead', {
      eventId,
      contentCategory: leadInput.leadMetaJSON.interestedTradesRaw?.[0],
      contentName: ctx.slug,
    })
    const result = await submit.mutateAsync({
      phone: leadInput.phone,
      name: leadInput.name,
      city: leadInput.city,
      state: leadInput.state,
      zip: leadInput.zip,
      leadSourceSlug: leadInput.leadSourceSlug,
      leadMetaJSON: leadInput.leadMetaJSON,
      eventId,
      pixel: {
        contentCategory: ctx.pixel?.contentCategory ?? ctx.slug,
        contentName: ctx.slug,
      },
    })
```

> NOTE for the implementer: the funnel `ctx` (`FunnelContext`) does not currently carry `pixel.contentCategory`. To keep the content_category authoritative (matching the server), extend `FunnelContext` with `pixel: FunnelPixel` and populate it in `funnel-engine.tsx`'s `ctx` memo (`pixel: spec.pixel`). This is a 2-line change: add `pixel: FunnelPixel` to the `FunnelContext` interface in `types.ts`, and add `pixel: spec.pixel` to the `useMemo` object in `funnel-engine.tsx`. Then `ctx.pixel.contentCategory` is exact. If you prefer not to touch the context, fall back to `leadInput.leadMetaJSON.interestedTradesRaw?.[0]` for `contentCategory` on both the browser fire and the mutation — but the `FunnelContext` extension is the cleaner, recommended path and keeps browser + server identical.

- [ ] **Step 4: (Recommended) extend `FunnelContext`** — in `src/shared/domains/funnels/types.ts` add `pixel: FunnelPixel` to `FunnelContext`; in `funnel-engine.tsx` add `pixel: spec.pixel` to the `ctx` `useMemo`. This makes `ctx.pixel.contentCategory` available to every step.

- [ ] **Step 5: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/funnels/ui/steps/pii-form-step.tsx src/shared/domains/funnels/types.ts src/shared/domains/funnels/ui/funnel-engine.tsx
git commit -m "feat(meta): PII step dual-fires Lead (browser + threaded event_id)"
```

---

### Task 13: Generic `trackFunnelEvent` mutation (dormant `Schedule` seam)

**Files:**
- Modify: `src/trpc/routers/funnels.router.ts`

**Interfaces:**
- Consumes: `metaCapiEventJob` (Task 6) — Schedule path is declared but the job's phase-1 handler only acts on `'Lead'`, so this seam is inert until a `datetime` step + a `'Schedule'` payload variant exist. Produces: `funnelsRouter.trackFunnelEvent({ leadId, event, eventId, pixel? })` — guarded by leadId UUID + rate-limited, mirroring `enrichFunnelLead`.

> RATIONALE: included per spec §10 as the future server-twin entry for `Schedule` and any post-lead browser event. It is intentionally minimal and currently unreachable from the kitchen funnel (no `datetime` step). Keeping it now avoids reopening the router when the first scheduling funnel ships.

- [ ] **Step 1: Add a rate limiter** next to the others:

```ts
const trackRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'funnel:track',
})
```

- [ ] **Step 2: Add the procedure** to `funnelsRouter`:

```ts
  // Generic post-lead server-twin seam for dual-fire browser events that fire
  // AFTER the lead exists (e.g. Schedule). Guarded by the leadId UUID; the
  // browser passes the same eventId it used for its pixel so Meta dedupes.
  // Dormant in phase 1 — no funnel emits 'Schedule' yet (no datetime step).
  trackFunnelEvent: baseProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      event: z.enum(['Schedule']),
      eventId: z.string(),
      pixel: z.object({ contentCategory: z.string(), contentName: z.string() }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await trackRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      // Phase 1: the meta-capi-event job only handles 'Lead'. This endpoint is
      // the wiring seam; the 'Schedule' job variant + measurement.service method
      // land alongside the first datetime-bearing funnel. Acknowledge for now.
      return { ok: true as const }
    }),
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/funnels.router.ts
git commit -m "feat(meta): add dormant trackFunnelEvent seam for future Schedule twin"
```

---

### Task 14: Privacy Policy disclosure + memory/docs note

**Files:**
- Modify: the Privacy Policy page (locate it — Step 1)
- Modify: `src/shared/domains/funnels/DOCS.md`

**Interfaces:** none (content only).

- [ ] **Step 1: Locate the Privacy Policy page**

Run: `grep -rln -i "privacy policy" src/app | head`
Pick the page component (likely under `src/app/(frontend)/(site)/.../privacy*`). If none exists, note that in the commit and add the disclosure to the funnel PII step's trust microcopy instead.

- [ ] **Step 2: Add the disclosure line** to the data-sharing section (verbatim copy):

> "We share limited, hashed contact information (such as a one-way encrypted version of your phone number) with advertising partners, including Meta, to measure and improve the performance of our advertising. This data cannot be reversed to reveal your original information."

- [ ] **Step 3: Add a note to `funnels/DOCS.md`** — a short subsection pointing at the measurement design + the convention emitter:

```markdown
## Measurement (Meta Pixel + CAPI)

The funnel auto-fires Meta events by CONVENTION — see
`src/shared/domains/funnels/lib/tracking/`. New funnels need NO Meta wiring:
they declare `pixel.contentCategory` in their FunnelSpec and the engine fires
`PageView` / `ViewContent` / `Lead` / `CompleteRegistration` automatically.
Design: `docs/superpowers/specs/2026-06-23-meta-pixel-capi-measurement-design.md`.
Provider: `src/shared/services/providers/meta/`. Server twins fire via the
`meta-capi-event` QStash job. `Schedule` is dormant until a `datetime` step exists.
```

- [ ] **Step 4: Lint (docs don't type-check, but run lint for the page edit)**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(meta): privacy disclosure + funnel measurement DOCS note"
```

---

### Task 15: End-to-end runtime verification (Meta Test Events)

**Files:** none (manual verification). This task has no code; it is the acceptance gate.

**Prerequisite (Oliver, one-time):** Pixel/Dataset created, `NEXT_PUBLIC_META_PIXEL_ID` / `META_DATASET_ID` / `META_CAPI_TOKEN` set in the environment. Until then this task is **blocked but the build is complete** — the integration no-ops safely without config.

- [ ] **Step 1: Set env + a test event code.** In Events Manager → Test Events, copy the `test_event_code`. For staging, temporarily pass it through (a `META_TEST_EVENT_CODE` env read in `meta-sync` via the optional `testEventCode` arg — wire only if QA needs it; production omits it).

- [ ] **Step 2: Run the funnel.** `pnpm dev`, open `/funnels/kitchens` (or the subdomain), and complete: tap a card (→ `ViewContent`), submit PII (→ `Lead`), reach confirmation (→ `CompleteRegistration`).

- [ ] **Step 3: Verify in Test Events.** Confirm `PageView`, `ViewContent`, `Lead`, `CompleteRegistration` appear.

- [ ] **Step 4: Verify dedup (the critical gate).** The `Lead` must show **"Received from: Browser and Server"** as ONE event. Two separate `Lead`s = broken `event_id` threading → revisit Tasks 11–12.

- [ ] **Step 5: Verify EMQ.** Open the server `Lead`'s details — Event Match Quality should reflect the hashed phone + `external_id` + `fbp`/`fbc` landing (score > 0, ideally ≥ 6).

- [ ] **Step 6: Record outcome.** Note pass/fail in the PR description. No commit (verification only).

---

## Self-Review

**1. Spec coverage** (spec §→task):
- §3/§4.1 provider + config → Tasks 1–3 ✓
- §4.2 sync service → Task 4 ✓
- §4.3 measurement orchestrator → Task 5 ✓
- §4.4 QStash durability → Task 6 ✓
- §4.5 browser pixel (loader + wrapper) → Tasks 7–8 ✓
- §5 convention emitter (`ViewContent`/`CompleteRegistration` by kind; `PageView` loader; `Lead` at PII; fired-once guard; event_id threading) → Tasks 8, 9, 11, 12 ✓
- §5 escape hatch (`track?` on step content) → **deferred** (YAGNI; no phase-1 funnel needs it; noted here so it isn't lost). Acceptable: convention covers 100% of current funnels.
- §6.3 attribution carry-forward planted in phase 1 → Task 10 ✓
- §7 env names + gating → Tasks 1, 4 (no-op when unconfigured), 8 (loader renders null) ✓
- §8 Test Events verification → Task 15 ✓
- §9 privacy disclosure → Task 14 ✓
- §10 `trackFunnelEvent` dormant seam → Task 13 ✓
- §6 CRM-half (Contact→Purchase) → **out of scope (phase 2)**, correctly excluded ✓

**2. Placeholder scan:** no TBD/TODO in code steps; every code step shows complete code. Task 12 flags a context decision with both paths spelled out (recommended + fallback) — not a placeholder. Task 14 Step 1 is a locate-then-edit (path discovered at runtime), with a defined fallback. ✓

**3. Type consistency:** `LeadEventArgs` (Task 4) = `FunnelLeadArgs` (Task 5) = `metaCapiEventJob` payload `args` (Task 6) = the object built in `submitLead` (Task 11) — fields match (`eventId`, `eventTime`, `phone`, `externalId`, `fbp`, `fbc`, `clientIp`, `clientUserAgent`, `contentCategory`, `contentName`, `testEventCode?`). `firePixel`/`mintEventId`/`readFbCookies` (Task 7) consumed consistently in Tasks 8/9/10/12. `metaServerEventSchema`/`MetaServerEvent` (Task 2) consumed in Tasks 3/4. `META_EVENT` names match the Global Constraints. ✓

One fix applied during review: Task 11 reads `_fbp`/`_fbc` from the persisted `leadMetaJSON.source.meta` (Task 10) rather than re-reading cookies server-side (cookies aren't reliably forwarded to the tRPC mutation) — consistent with Task 10's persistence and Task 4's `fbp`/`fbc` args.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute here with checkpoints.
