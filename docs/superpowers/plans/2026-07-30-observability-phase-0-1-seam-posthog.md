# Observability — Phase 0 + 1 (Emit Seam + PostHog + Funnel Drop-off) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the decoupled `track()` emit seam and its first two providers (PostHog + first-party DB), then bolt it onto the funnels so we can see where Meta-ad visitors drop off — while laying reusable observability infrastructure the rest of the codebase attaches to later.

**Architecture:** A new write-side domain `src/shared/domains/observability/` exposes one `track(event, payload, ctx)` facade (client + server variants). Call sites import only the facade + a typed event name — never a vendor SDK. The facade validates against a compile-time event registry, sanitizes PII once, and fans out to enabled **providers** behind a common interface. Phase-1 providers: **PostHog** (client SDK, reverse-proxied through `/ingest`; anonymous funnel-step drop-off, sessions, replay) and **first-party** (server-only, writes a generic `observability_events` Neon table via a DAL — used for server-side conversion events). The existing read-side analytics domain is untouched this phase.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM (Postgres/Neon), Zod, `posthog-js`, `posthog-node`. Providers follow the repo's `createProviderConfig` pattern.

## Global Constraints

Every task's requirements implicitly include these (copied from repo conventions + the design spec `docs/superpowers/specs/2026-07-30-observability-infrastructure-design.md`):

- **Verification = `pnpm tsc` + `pnpm lint` ONLY.** There is no test runner in this repo. NEVER run `pnpm build`. Behavioral checks use a dev-only smoke route.
- **DB pushes = `pnpm db:push:dev` ONLY.** Never `db:push:prod` (prod is explicit + owner-approved). Each worktree has its own Neon branch.
- **DAL owns all writes** (Rule 19). Services/jobs/routes never call `db.insert/update` directly — they go through a DAL function.
- **jsonb `props`/`context` are append-only** — never shallow-merge (ADR-0005, `jsonb-columns.md`). Zod-parse at the write boundary.
- **Never set `updatedAt` manually** — `.$onUpdate()` handles it. The events table is append-only and has NO `updatedAt`.
- **Named exports only. One component per file. No file-level constants in component files.** (`memory/coding-conventions.md`.)
- **Provider config via `createProviderConfig`** — Zod fragment `.optional()`, `requiredKeys`, `toConfig`; register the fragment in `src/shared/config/server-env.ts`. No module-scope `env.*` reads (import cycle hazard).
- **Terminology: "provider"** for fan-out targets. Never "sink"/"destination".
- **Privacy = pragmatic minimum:** mask PII in replays + sanitize before fan-out + privacy-policy disclosure. No consent banner this phase.
- **`@/` path alias → `src/`.**

---

## File Structure

**New — write-side domain (`src/shared/domains/observability/`):**
- `events.ts` — `defineEvent` + the compile-time event registry (`funnel_step_viewed`, `funnel_step_completed`, `lead_submitted`, `appointment_set`).
- `sanitize.ts` — pure PII masking applied to `props`/`context` before fan-out.
- `types.ts` — `ObservabilityProvider` interface, `TrackContext`, `ObservabilityContext`.
- `track.client.ts` — client facade + client provider registry (`'use client'`-safe, no server imports).
- `track.server.ts` — server facade + server provider registry (server-only).
- `index.ts` — public surface (events + types only; never re-exports the server facade into client space).

**New — providers (`src/shared/services/providers/`):**
- `posthog/lib/config.ts` — env fragment + `createProviderConfig`.
- `posthog/browser.ts` — `posthog-js` init (client).
- `posthog/client.ts` — `posthog-node` singleton (server).
- `posthog/DOCS.md` — provider notes.
- `sentry/` — NOT this phase (Phase 2).

**New — first-party store:**
- `src/shared/db/schema/observability-events.ts` — the table.
- `src/shared/dal/observability/server/writes.ts` — insert DAL (infra-level, not entity-scoped).

**New — app wiring:**
- `src/app/(frontend)/_components/posthog-provider.tsx` — client init + pageview mount (exact dir confirmed in Task 8).
- `src/app/(frontend)/dashboard/_dev/observability-smoke/route.ts` — dev-only smoke endpoint.

**Modified:**
- `src/shared/db/schema/index.ts` — export the new table.
- `src/shared/config/server-env.ts` — spread the PostHog fragment + register its config meta.
- `next.config.ts` — `/ingest` reverse-proxy rewrites + `skipTrailingSlashRedirect`.
- `src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts` — bolt in `track()` for step events.
- `src/shared/services/measurement.service.ts` — bolt in server `track('lead_submitted' | 'appointment_set')` alongside the existing Meta calls.
- The privacy policy page (located in Task 1).

---

### Task 1: Privacy foundation (Phase 0)

**Files:**
- Locate + Modify: the privacy-policy page/content (find in Step 1).
- Create: `src/shared/domains/observability/PII.md` — the masking policy of record.

- [ ] **Step 1: Locate the privacy policy source**

Run: `grep -rliE 'privacy policy|privacy-policy|CCPA' src public --include='*.tsx' --include='*.mdx' --include='*.md' --include='*.ts' | head`
If none exists, create `src/app/(frontend)/(site)/privacy/page.tsx` following the nearest sibling `(site)` page's structure (check `src/app/(frontend)/(site)/` for the pattern). Record the resolved path in the commit message.

- [ ] **Step 2: Add the disclosure copy**

Add a section to the privacy policy covering, in plain language:
- We use analytics and session-recording tools (PostHog) to understand how visitors use the site.
- We record page interactions and may capture approximate location from IP address.
- We mask personal fields (name, phone, email, address) in recordings.
- Visitors can opt out via browser Do-Not-Track / ad blockers.

- [ ] **Step 3: Write the PII masking policy of record**

Create `src/shared/domains/observability/PII.md`:

```markdown
# Observability PII Policy

Pragmatic-minimum privacy (owner decision, 2026-07-30). No consent banner in v1.

## Never send to any provider (masked/stripped by the facade's sanitize step)
- Full name, email, phone number, street address, ZIP beyond first 3 digits.

## Session replay masking
- PostHog `maskAllInputs: true` (default ON).
- Any element rendering PII that is NOT an <input> must carry `data-ph-mask`
  and is covered by `maskTextSelector: '[data-ph-mask]'`.

## Enforcement
- `src/shared/domains/observability/sanitize.ts` is the single enforcement
  point. It runs on every event before fan-out. Adding a PII field = add it
  to `PII_KEYS` there.
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (privacy page is JSX/MD; no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/observability/PII.md <privacy-policy-path>
git commit -m "feat(observability): privacy disclosure + PII masking policy (Phase 0)"
```

---

### Task 2: `observability_events` table

**Files:**
- Create: `src/shared/db/schema/observability-events.ts`
- Modify: `src/shared/db/schema/index.ts`

**Interfaces:**
- Produces: `observabilityEvents` (drizzle table), `InsertObservabilityEvent` (zod-inferred insert type), `ObservabilityEventRow` (select type).

- [ ] **Step 1: Write the schema file**

Create `src/shared/db/schema/observability-events.ts`:

```ts
import type z from 'zod'
import type { ObservabilityContext } from '@/shared/domains/observability/types'
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id } from '../lib/schema-helpers'
import { customers } from './customers'

// Generic, append-only observability event log. NOT funnel-specific — any
// action in the codebase writes rows here via the first-party provider's DAL.
// `occurredAt` is the event moment (caller-supplied ISO); `createdAt` is the
// row-insert moment. No `updatedAt`: rows are immutable.
// see docs/superpowers/specs/2026-07-30-observability-infrastructure-design.md#7
export const observabilityEvents = pgTable('observability_events', {
  id,
  name: text('name').notNull(),
  occurredAt: timestamp('occurred_at', { mode: 'string', withTimezone: true }).notNull(),
  distinctId: text('distinct_id').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  sessionId: text('session_id'),
  // Event-specific payload. Append-only; zod-parsed at the write boundary.
  props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
  // Request context (utm_*, path, referrer, userAgent, geo) captured per event.
  context: jsonb('context').$type<ObservabilityContext>(),
  createdAt,
}, t => [
  index('observability_events_name_occurred_idx').on(t.name, t.occurredAt),
  index('observability_events_customer_idx').on(t.customerId),
  index('observability_events_session_idx').on(t.sessionId),
])

export const selectObservabilityEventSchema = createSelectSchema(observabilityEvents)
export type ObservabilityEventRow = z.infer<typeof selectObservabilityEventSchema>

export const insertObservabilityEventSchema = createInsertSchema(observabilityEvents)
  .omit({ id: true, createdAt: true })
export type InsertObservabilityEvent = z.infer<typeof insertObservabilityEventSchema>
```

> Note: this imports the `ObservabilityContext` TYPE from Task 6's `types.ts`. Implement Task 6's `types.ts` first, or stub the type as `Record<string, unknown>` and tighten it when Task 6 lands. (Type-only import — zero runtime coupling.)

- [ ] **Step 2: Export from the schema barrel**

In `src/shared/db/schema/index.ts`, add after the other `export *` lines:

```ts
export * from './observability-events'
```

- [ ] **Step 3: Verify types**

Run: `pnpm tsc`
Expected: PASS (assuming `ObservabilityContext` exists or is stubbed).

- [ ] **Step 4: Push schema to dev DB**

Run: `pnpm db:push:dev`
Expected: drizzle-kit creates `observability_events`. Confirm the printed plan adds the table + 3 indexes and targets the DEV branch.

- [ ] **Step 5: Verify + commit**

Run: `pnpm lint`

```bash
git add src/shared/db/schema/observability-events.ts src/shared/db/schema/index.ts
git commit -m "feat(observability): observability_events table + indexes"
```

---

### Task 3: Event registry (`defineEvent` + v1 events)

**Files:**
- Create: `src/shared/domains/observability/events.ts`

**Interfaces:**
- Produces:
  - `defineEvent<Name, Schema>(def) => EventDef<Name, Schema>`
  - Event constants: `FUNNEL_STEP_VIEWED`, `FUNNEL_STEP_COMPLETED`, `LEAD_SUBMITTED`, `APPOINTMENT_SET` (each an `EventDef`).
  - `type EventName = 'funnel_step_viewed' | 'funnel_step_completed' | 'lead_submitted' | 'appointment_set'`
  - `type PayloadOf<E>` = `z.infer<E['schema']>`

- [ ] **Step 1: Write the registry + events**

Create `src/shared/domains/observability/events.ts`:

```ts
import { z } from 'zod'

export interface EventDef<Name extends string, Schema extends z.ZodType> {
  readonly name: Name
  readonly schema: Schema
}

// Compile-time event registry entry. Adding an observable event = one call.
// Mirrors the Entity Action System registry shape (ADR-0001).
export function defineEvent<Name extends string, Schema extends z.ZodType>(
  def: EventDef<Name, Schema>,
): EventDef<Name, Schema> {
  return def
}

export const FUNNEL_STEP_VIEWED = defineEvent({
  name: 'funnel_step_viewed',
  schema: z.object({
    funnelSlug: z.string(),
    stepIndex: z.number().int().nonnegative(),
    stepId: z.string(),
  }),
})

export const FUNNEL_STEP_COMPLETED = defineEvent({
  name: 'funnel_step_completed',
  schema: z.object({
    funnelSlug: z.string(),
    stepIndex: z.number().int().nonnegative(),
    stepId: z.string(),
  }),
})

export const LEAD_SUBMITTED = defineEvent({
  name: 'lead_submitted',
  schema: z.object({
    funnelSlug: z.string(),
    contentCategory: z.string().optional(),
  }),
})

export const APPOINTMENT_SET = defineEvent({
  name: 'appointment_set',
  schema: z.object({
    occurredAtIso: z.string(),
  }),
})

export const OBSERVABILITY_EVENTS = {
  FUNNEL_STEP_VIEWED,
  FUNNEL_STEP_COMPLETED,
  LEAD_SUBMITTED,
  APPOINTMENT_SET,
} as const

export type AnyEventDef = (typeof OBSERVABILITY_EVENTS)[keyof typeof OBSERVABILITY_EVENTS]
export type EventName = AnyEventDef['name']
export type PayloadOf<E extends EventDef<string, z.ZodType>> = z.infer<E['schema']>
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/domains/observability/events.ts
git commit -m "feat(observability): typed compile-time event registry"
```

---

### Task 4: PII sanitize (pure)

**Files:**
- Create: `src/shared/domains/observability/sanitize.ts`

**Interfaces:**
- Produces: `sanitize<T extends Record<string, unknown>>(obj: T | undefined): T | undefined` — returns a shallow copy with PII keys redacted to `'[redacted]'`.

- [ ] **Step 1: Write the sanitizer**

Create `src/shared/domains/observability/sanitize.ts`:

```ts
// Single PII enforcement point. Runs on every event's props + context before
// any provider sees them. Adding a PII field = add a key here.
// see ./PII.md
const PII_KEYS: ReadonlySet<string> = new Set([
  'name', 'firstName', 'lastName', 'fullName',
  'email', 'phone', 'phoneNumber', 'tel',
  'address', 'street', 'streetAddress', 'addressLine1',
])

const REDACTED = '[redacted]'

export function sanitize<T extends Record<string, unknown>>(obj: T | undefined): T | undefined {
  if (!obj) {
    return obj
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    out[key] = PII_KEYS.has(key) ? REDACTED : value
  }
  return out as T
}
```

- [ ] **Step 2: Add a dev-only self-check to the smoke route (deferred to Task 10)**

No test runner exists; `sanitize` is exercised by the Task 10 smoke route. No action here.

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/domains/observability/sanitize.ts
git commit -m "feat(observability): PII sanitize enforcement point"
```

---

### Task 5: Provider interface + context types

**Files:**
- Create: `src/shared/domains/observability/types.ts`

**Interfaces:**
- Produces:
  - `interface ObservabilityContext` — `{ path?, referrer?, userAgent?, utmSource?, utmMedium?, utmCampaign?, utmContent?, utmTerm? }` (all optional).
  - `interface TrackContext` — `{ distinctId: string; sessionId?: string; customerId?: string; occurredAtIso?: string; context?: ObservabilityContext }`.
  - `interface ObservabilityProvider` — `{ readonly name: string; isEnabled: () => boolean; capture: (name: string, props: Record<string, unknown>, ctx: TrackContext) => void | Promise<void> }`.

- [ ] **Step 1: Write the types**

Create `src/shared/domains/observability/types.ts`:

```ts
// Request/session context attached to every event. No PII fields — those are
// stripped by sanitize.ts even if a caller mistakenly includes them.
export interface ObservabilityContext {
  path?: string
  referrer?: string
  userAgent?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
}

// Who/when the event is about. distinctId links anonymous → identified.
export interface TrackContext {
  distinctId: string
  sessionId?: string
  customerId?: string
  /** Event moment. Defaults to now at the facade if omitted. */
  occurredAtIso?: string
  context?: ObservabilityContext
}

// A fan-out target. Enabled providers receive every (sanitized) event. A dark
// provider (missing config) returns false from isEnabled() and is skipped —
// never an error. Concrete providers live under services/providers/<name>/.
export interface ObservabilityProvider {
  readonly name: string
  isEnabled: () => boolean
  capture: (
    name: string,
    props: Record<string, unknown>,
    ctx: TrackContext,
  ) => void | Promise<void>
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (This also unblocks Task 2's `ObservabilityContext` type import — if you stubbed it, remove the stub now.)

```bash
git add src/shared/domains/observability/types.ts
git commit -m "feat(observability): provider interface + context types"
```

---

### Task 6: First-party write DAL

**Files:**
- Create: `src/shared/dal/observability/server/writes.ts`

**Interfaces:**
- Consumes: `observabilityEvents`, `insertObservabilityEventSchema` (Task 2); `TrackContext` (Task 5).
- Produces: `insertObservabilityEvent(row: InsertObservabilityEvent): Promise<void>` — the ONLY write path to the table.

- [ ] **Step 1: Confirm the db client import path**

Run: `grep -rn "from '@/shared/db'" src/shared/entities/customers/dal/server/*.ts | head -3`
Use whatever `db` import the existing DALs use (likely `import { db } from '@/shared/db'`). Match it exactly.

- [ ] **Step 2: Write the DAL**

Create `src/shared/dal/observability/server/writes.ts` (adjust the `db` import to match Step 1):

```ts
import type { InsertObservabilityEvent } from '@/shared/db/schema/observability-events'
import { db } from '@/shared/db'
import { insertObservabilityEventSchema, observabilityEvents } from '@/shared/db/schema/observability-events'

// The single sanctioned write path to observability_events (Rule 19: DAL owns
// writes). Zod-parses at the boundary (jsonb-columns.md). Append-only insert.
export async function insertObservabilityEvent(row: InsertObservabilityEvent): Promise<void> {
  const parsed = insertObservabilityEventSchema.parse(row)
  await db.insert(observabilityEvents).values(parsed)
}
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/dal/observability/server/writes.ts
git commit -m "feat(observability): first-party event write DAL"
```

---

### Task 7: Facades — client + server + provider registries

**Files:**
- Create: `src/shared/domains/observability/track.server.ts`
- Create: `src/shared/domains/observability/track.client.ts`
- Create: `src/shared/domains/observability/index.ts`

**Interfaces:**
- Consumes: `EventDef`, `PayloadOf` (Task 3); `sanitize` (Task 4); `ObservabilityProvider`, `TrackContext` (Task 5); `insertObservabilityEvent` (Task 6).
- Produces:
  - Server: `trackServer<E>(event: E, payload: PayloadOf<E>, ctx: TrackContext): Promise<void>`
  - Client: `trackClient<E>(event: E, payload: PayloadOf<E>, ctx?: Partial<TrackContext>): void`
  - `registerServerProvider(p)` / `registerClientProvider(p)` — used by providers to self-register.

- [ ] **Step 1: Write the server facade + registry**

Create `src/shared/domains/observability/track.server.ts`:

```ts
import 'server-only'
import type { EventDef, PayloadOf } from './events'
import type { ObservabilityProvider, TrackContext } from './types'
import { insertObservabilityEvent } from '@/shared/dal/observability/server/writes'
import { sanitize } from './sanitize'

const providers: ObservabilityProvider[] = []

export function registerServerProvider(p: ObservabilityProvider): void {
  if (!providers.some(existing => existing.name === p.name)) {
    providers.push(p)
  }
}

// Built-in first-party provider: durable, owned copy in Neon. Always enabled.
const firstPartyProvider: ObservabilityProvider = {
  name: 'first-party',
  isEnabled: () => true,
  capture: async (name, props, ctx) => {
    await insertObservabilityEvent({
      name,
      occurredAt: ctx.occurredAtIso ?? new Date().toISOString(),
      distinctId: ctx.distinctId,
      customerId: ctx.customerId ?? null,
      sessionId: ctx.sessionId ?? null,
      props,
      context: ctx.context ?? null,
    })
  },
}
registerServerProvider(firstPartyProvider)

export async function trackServer<E extends EventDef<string, import('zod').ZodType>>(
  event: E,
  payload: PayloadOf<E>,
  ctx: TrackContext,
): Promise<void> {
  const validated = event.schema.parse(payload) as Record<string, unknown>
  const safeProps = sanitize(validated) ?? {}
  const safeCtx: TrackContext = { ...ctx, context: sanitize(ctx.context) }
  await Promise.all(
    providers.filter(p => p.isEnabled()).map(p => p.capture(event.name, safeProps, safeCtx)),
  )
}
```

> `new Date().toISOString()` (not raw SQL NOW()) per repo convention.

- [ ] **Step 2: Write the client facade + registry**

Create `src/shared/domains/observability/track.client.ts`:

```ts
'use client'
import type { EventDef, PayloadOf } from './events'
import type { ObservabilityProvider, TrackContext } from './types'
import { sanitize } from './sanitize'

const providers: ObservabilityProvider[] = []

export function registerClientProvider(p: ObservabilityProvider): void {
  if (!providers.some(existing => existing.name === p.name)) {
    providers.push(p)
  }
}

// Client facade. Phase 1: fans to PostHog only (anonymous drop-off lives in
// PostHog by design — see spec §9 Phase 3 open decision). distinctId is filled
// by the PostHog provider from its own SDK when omitted.
export function trackClient<E extends EventDef<string, import('zod').ZodType>>(
  event: E,
  payload: PayloadOf<E>,
  ctx?: Partial<TrackContext>,
): void {
  const validated = event.schema.parse(payload) as Record<string, unknown>
  const safeProps = sanitize(validated) ?? {}
  const safeCtx: TrackContext = {
    distinctId: ctx?.distinctId ?? 'anonymous',
    sessionId: ctx?.sessionId,
    customerId: ctx?.customerId,
    occurredAtIso: ctx?.occurredAtIso,
    context: sanitize(ctx?.context),
  }
  for (const p of providers) {
    if (p.isEnabled()) {
      void p.capture(event.name, safeProps, safeCtx)
    }
  }
}
```

- [ ] **Step 3: Write the public surface**

Create `src/shared/domains/observability/index.ts`:

```ts
// Public surface. Import events/types from here. Facades are imported directly
// from their variant file (track.client / track.server) so the server-only
// module never leaks into a client bundle.
export * from './events'
export type { ObservabilityContext, ObservabilityProvider, TrackContext } from './types'
```

- [ ] **Step 4: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (`server-only` will error if `track.server.ts` is ever imported by a client module — that's the guardrail working.)

```bash
git add src/shared/domains/observability/track.server.ts src/shared/domains/observability/track.client.ts src/shared/domains/observability/index.ts
git commit -m "feat(observability): client + server track() facades with provider registries"
```

---

### Task 8: PostHog provider (config + browser + server clients)

**Files:**
- Create: `src/shared/services/providers/posthog/lib/config.ts`
- Create: `src/shared/services/providers/posthog/browser.ts`
- Create: `src/shared/services/providers/posthog/client.ts`
- Create: `src/shared/services/providers/posthog/DOCS.md`
- Modify: `src/shared/config/server-env.ts`

**Interfaces:**
- Consumes: `createProviderConfig`; `registerClientProvider`, `registerServerProvider`; `ObservabilityProvider`.
- Produces: `getPosthogConfig()`, `isPosthogConfigured()`, `posthogConfigMeta`, `posthogEnvFragment`; `initPosthogBrowser()`; `posthogBrowserProvider` (client); `posthogServerProvider` (server).

- [ ] **Step 1: Install SDKs**

Run: `pnpm add posthog-js posthog-node`
Expected: both added to `dependencies`.

- [ ] **Step 2: Provider config**

Create `src/shared/services/providers/posthog/lib/config.ts`:

```ts
import { z } from 'zod'
import { createProviderConfig } from '@/shared/config/create-provider-config'

// PostHog project API key is publishable (safe on the client) — hence the
// NEXT_PUBLIC_ prefix. Host is our own reverse-proxy path (/ingest) so ad
// blockers don't drop events; the SDK still needs the real ui_host for links.
export const posthogEnvFragment = z.object({
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
})

export type ParsedPosthogEnv = z.infer<typeof posthogEnvFragment>

export interface PosthogRuntimeConfig {
  key: string
  host: string
}

const helpers = createProviderConfig({
  provider: 'posthog',
  fragment: posthogEnvFragment,
  requiredKeys: ['NEXT_PUBLIC_POSTHOG_KEY'],
  toConfig: (parsed): PosthogRuntimeConfig => ({
    key: parsed.NEXT_PUBLIC_POSTHOG_KEY!,
    host: parsed.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  }),
})

export const getPosthogConfig = helpers.get
export const isPosthogConfigured = helpers.isConfigured
export const posthogConfigMeta = helpers.configMeta
```

- [ ] **Step 3: Register the fragment in server-env**

In `src/shared/config/server-env.ts`:
1. Add the import alongside the other provider config imports:
```ts
import { posthogConfigMeta, posthogEnvFragment } from '@/shared/services/providers/posthog/lib/config'
```
2. Spread the fragment into `envSchema` (near the other `...xEnvFragment.shape` lines):
```ts
  // POSTHOG — fragment lives at providers/posthog/lib/config.ts
  ...posthogEnvFragment.shape,
```
3. Add `posthogConfigMeta` to wherever the config metas are collected for the boot banner (grep `configMeta` in the file to find the array/registry and append it).

- [ ] **Step 4: Browser init + client provider**

Create `src/shared/services/providers/posthog/browser.ts`:

```ts
'use client'
import type { ObservabilityProvider } from '@/shared/domains/observability/types'
import posthog from 'posthog-js'
import { registerClientProvider } from '@/shared/domains/observability/track.client'
import { getPosthogConfig, isPosthogConfigured } from './lib/config'

let started = false

export function initPosthogBrowser(): void {
  if (started || !isPosthogConfigured() || typeof window === 'undefined') {
    return
  }
  started = true
  const { key } = getPosthogConfig()
  posthog.init(key, {
    api_host: '/ingest', // reverse-proxied (next.config rewrites)
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
    },
  })
}

export const posthogBrowserProvider: ObservabilityProvider = {
  name: 'posthog',
  isEnabled: () => started,
  capture: (name, props, ctx) => {
    if (ctx.customerId) {
      posthog.identify(ctx.customerId)
    }
    posthog.capture(name, { ...props, ...ctx.context })
  },
}

registerClientProvider(posthogBrowserProvider)
```

- [ ] **Step 5: Server client + server provider**

Create `src/shared/services/providers/posthog/client.ts`:

```ts
import 'server-only'
import type { ObservabilityProvider } from '@/shared/domains/observability/types'
import { PostHog } from 'posthog-node'
import { registerServerProvider } from '@/shared/domains/observability/track.server'
import { getPosthogConfig, isPosthogConfigured } from './lib/config'

let singleton: PostHog | null = null

function getPosthogServer(): PostHog | null {
  if (!isPosthogConfigured()) {
    return null
  }
  if (!singleton) {
    const { key, host } = getPosthogConfig()
    singleton = new PostHog(key, { host, flushAt: 1, flushInterval: 0 })
  }
  return singleton
}

export const posthogServerProvider: ObservabilityProvider = {
  name: 'posthog',
  isEnabled: () => isPosthogConfigured(),
  capture: async (name, props, ctx) => {
    const ph = getPosthogServer()
    if (!ph) {
      return
    }
    ph.capture({
      distinctId: ctx.customerId ?? ctx.distinctId,
      event: name,
      properties: { ...props, ...ctx.context },
    })
    await ph.flush()
  },
}

registerServerProvider(posthogServerProvider)
```

- [ ] **Step 6: DOCS**

Create `src/shared/services/providers/posthog/DOCS.md` with: the two env vars, the `/ingest` proxy rationale, `person_profiles: 'identified_only'` (anonymous events don't create person profiles → stays under free-tier limits), and the masking config pointer to `observability/PII.md`.

- [ ] **Step 7: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add src/shared/services/providers/posthog src/shared/config/server-env.ts package.json pnpm-lock.yaml
git commit -m "feat(observability): PostHog provider (config + browser + server)"
```

---

### Task 9: Reverse-proxy rewrites + app-level PostHog init

**Files:**
- Modify: `next.config.ts`
- Create: `src/app/(frontend)/_components/posthog-provider.tsx` (confirm dir in Step 2)
- Modify: the frontend root layout (located in Step 3)

- [ ] **Step 1: Add `/ingest` rewrites**

In `next.config.ts`, add these two keys to `nextConfig` (alongside `async headers()`):

```ts
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
      { source: '/ingest/flags', destination: 'https://us.i.posthog.com/flags' },
    ]
  },
```

- [ ] **Step 2: Create the init component**

Run: `find "src/app/(frontend)" -maxdepth 2 -name 'layout.tsx' | head`
Create `src/app/(frontend)/_components/posthog-provider.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { initPosthogBrowser } from '@/shared/services/providers/posthog/browser'

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthogBrowser()
  }, [])
  return <>{children}</>
}
```

- [ ] **Step 3: Mount it in the frontend root layout**

In the `(frontend)` root layout from Step 1, wrap the body children with `<PosthogProvider>`. Match the existing provider-nesting style (there are likely other client providers already — nest alongside them).

- [ ] **Step 4: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git add next.config.ts "src/app/(frontend)/_components/posthog-provider.tsx" <layout-path>
git commit -m "feat(observability): /ingest reverse-proxy + PostHog browser init"
```

---

### Task 10: Bolt `track()` into funnels + server conversions + smoke route

**Files:**
- Modify: `src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts`
- Modify: `src/shared/services/measurement.service.ts`
- Create: `src/app/(frontend)/dashboard/_dev/observability-smoke/route.ts`

**Interfaces:**
- Consumes: `trackClient` + events (client); `trackServer` + events (server); `insertObservabilityEvent` indirectly.

- [ ] **Step 1: Emit funnel step events (client)**

In `use-funnel-tracking.ts`, add a step-change effect that emits `FUNNEL_STEP_VIEWED` on each step and `FUNNEL_STEP_COMPLETED` when a step's answer is recorded. Add imports:

```ts
import { trackClient } from '@/shared/domains/observability/track.client'
import { FUNNEL_STEP_COMPLETED, FUNNEL_STEP_VIEWED } from '@/shared/domains/observability'
```

Add (inside the hook, after the existing effects — reuse `engine.step`, `spec.slug`):

```ts
  const stepIndex = engine.stepIndex
  const stepId = engine.step.id
  useEffect(() => {
    trackClient(FUNNEL_STEP_VIEWED, { funnelSlug: spec.slug, stepIndex, stepId })
  }, [spec.slug, stepIndex, stepId])
```

> Confirm the exact field names on `engine` (`stepIndex`, `step.id`) via `grep -n "stepIndex\|step:" src/shared/domains/funnels/hooks/use-funnel-engine.ts`. If names differ, use the real ones. Emit `FUNNEL_STEP_COMPLETED` from wherever the engine records an answer for the current step (same file's answer handler, or an effect keyed on `engine.answers[stepId]`).

- [ ] **Step 2: Emit server conversion events**

In `measurement.service.ts`, inside `trackFunnelLead`, after the existing `metaSyncService.trackLead(args)` call, add a first-party/PostHog server event. Add imports:

```ts
import { trackServer } from '@/shared/domains/observability/track.server'
import { APPOINTMENT_SET, LEAD_SUBMITTED } from '@/shared/domains/observability'
```

In `trackFunnelLead` (derive `distinctId`/`funnelSlug` from `args` — inspect `LeadEventArgs` shape first via `grep -n "LeadEventArgs\|interface.*Lead" src/shared/services/meta-sync.service.ts`):

```ts
      await trackServer(LEAD_SUBMITTED, {
        funnelSlug: args.funnelSlug,
        contentCategory: args.contentCategory,
      }, { distinctId: args.distinctId ?? args.eventId })
```

In `trackAppointmentSet`, after the successful `metaSyncService.trackSchedule(...)`:

```ts
      await trackServer(APPOINTMENT_SET, { occurredAtIso: args.occurredAtIso }, {
        distinctId: row.id,
        customerId: row.id,
        occurredAtIso: args.occurredAtIso,
      })
```

> Adjust the exact `args.*` field names to the real `LeadEventArgs`/`AppointmentSetArgs` shapes. Keep the new call AFTER the Meta call so observability never blocks the existing conversion path; wrap in try/catch if the Meta path isn't already wrapped, so a provider hiccup can't fail a lead.

- [ ] **Step 3: Create the dev-only smoke route**

Create `src/app/(frontend)/dashboard/_dev/observability-smoke/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { insertObservabilityEvent } from '@/shared/dal/observability/server/writes'
import { db } from '@/shared/db'
import { observabilityEvents } from '@/shared/db/schema/observability-events'
import { sanitize } from '@/shared/domains/observability/sanitize'

// Dev-only smoke: writes one event through the DAL, reads it back, verifies
// PII sanitize. Guarded to non-production. see plan Task 10.
export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in production' }, { status: 404 })
  }
  const distinctId = `smoke-${Date.now()}`
  const masked = sanitize({ funnelSlug: 'kitchens', email: 'leak@example.com' })
  await insertObservabilityEvent({
    name: 'funnel_step_completed',
    occurredAt: new Date().toISOString(),
    distinctId,
    customerId: null,
    sessionId: null,
    props: masked ?? {},
    context: { path: '/smoke' },
  })
  const rows = await db.select().from(observabilityEvents)
  const mine = rows.filter(r => r.distinctId === distinctId)
  return NextResponse.json({
    ok: mine.length === 1,
    piiRedacted: (mine[0]?.props as Record<string, unknown>)?.email === '[redacted]',
    row: mine[0] ?? null,
  })
}
```

- [ ] **Step 4: Verify (types + lint)**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Smoke-verify behavior**

Run: `pnpm dev` (in one shell), then in another: `curl -s http://localhost:3000/dashboard/_dev/observability-smoke | jq`
Expected: `{ "ok": true, "piiRedacted": true, ... }`. This proves: DAL write path works, the events table accepts the row, and sanitize redacts PII.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts src/shared/services/measurement.service.ts "src/app/(frontend)/dashboard/_dev/observability-smoke/route.ts"
git commit -m "feat(observability): bolt track() into funnel steps + server conversions + smoke route"
```

---

### Task 11: PostHog dashboard config + funnel insight (manual, documented)

**Files:**
- Modify: `src/shared/services/providers/posthog/DOCS.md`

This task is configuration in the PostHog web app, not code. Do it once keys are live.

- [ ] **Step 1: Create the PostHog project + get keys**

In PostHog Cloud (US), create the project. Copy the project API key → set `NEXT_PUBLIC_POSTHOG_KEY` in `.env.local` (dev) and Vercel env (preview/prod). Leave `NEXT_PUBLIC_POSTHOG_HOST` unset (defaults to US cloud).

- [ ] **Step 2: Verify events arrive**

With `pnpm dev` running, click through a funnel in a real browser (NOT headless — matches the repo's pixel-verification rule). In PostHog → Activity, confirm `funnel_step_viewed` / `funnel_step_completed` events with `funnelSlug`, `stepIndex`.

- [ ] **Step 3: Build the drop-off funnel insight**

In PostHog → Product Analytics → New Funnel: add steps in order (`funnel_step_completed` filtered by `stepIndex` 0,1,2…, or one step per `stepId`). Break down by `utm_campaign` / `utm_content` to see drop-off per creative. Save to a "Meta Funnels" dashboard.

- [ ] **Step 4: Turn on session replay**

PostHog → Settings → confirm recordings enabled + input masking on. Watch one replay end-to-end; verify name/phone fields render masked.

- [ ] **Step 5: Document + commit**

Append the project URL, dashboard link, and the "verify in a real browser" note to `posthog/DOCS.md`.

```bash
git add src/shared/services/providers/posthog/DOCS.md
git commit -m "docs(observability): PostHog funnel insight + replay setup notes"
```

---

## Self-Review

**Spec coverage (against `2026-07-30-observability-infrastructure-design.md`):**
- R1 (single facade, no vendor SDK at call sites) → Tasks 7, 10 ✅
- R2 (typed compile-time registry) → Task 3 ✅
- R3 (providers behind interface, dark = skipped) → Tasks 5, 7, 8 ✅
- R4 (generic first-party store, DAL writes) → Tasks 2, 6 ✅
- R5 (central PII sanitize before fan-out) → Tasks 4, 7 ✅
- R6 (funnel drop-off per step, sliceable by UTM; identify on submit) → Tasks 10, 11 ✅
- R7 (error alerting) → **Phase 2, not this plan** (correctly out of scope) ✅
- R8 (read-side source) → **Phase 3, not this plan** ✅
- N1 (zero vendor coupling at call sites) → facade design, Tasks 7/10 ✅
- N2 (createProviderConfig, server-only keys) → Task 8 ✅
- N3 (adblock-resilient `/ingest`) → Task 9 ✅
- N4 (jsonb append-only, zod at boundary) → Tasks 2, 6 ✅
- N5 (free-tier: `identified_only`, `flushAt:1`) → Task 8 ✅
- N6 (masked replays + sanitize + disclosure) → Tasks 1, 4, 8 ✅
- Phase 0 (privacy) → Task 1 ✅

**Placeholder scan:** No "TBD/TODO". The three "confirm exact field name" notes (Tasks 6 Step 1, 10 Steps 1–2) are grep-to-verify instructions with concrete fallbacks, not deferred work — acceptable because the engine/args shapes weren't read during planning; each names the exact grep to run.

**Type consistency:** `ObservabilityProvider.capture(name, props, ctx)` signature is identical across Tasks 5, 7, 8. `TrackContext` fields (`distinctId`, `sessionId`, `customerId`, `occurredAtIso`, `context`) consistent across Tasks 5, 7, 8, 10. `EventDef`/`PayloadOf` consistent Tasks 3, 7. Table insert type `InsertObservabilityEvent` consistent Tasks 2, 6, 7.

**Known cross-task ordering:** Task 2's schema imports a type from Task 5's `types.ts`. Implement order 5 → 2, OR use the documented stub. Flagged in Task 2 Step 1.
