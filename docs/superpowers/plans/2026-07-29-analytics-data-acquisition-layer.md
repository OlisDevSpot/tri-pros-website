# Analytics Data-Acquisition Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the analytics framework real data — a Meta Marketing-API insights `source` (spend/CPM/CTR per ad, resolved to `adKey`) and three local SQL `source`s (leads / appointments / signed customers per `adKey`) — so a later plan can wire them into metrics and `resolve()` returns real numbers.

**Architecture:** Follows spec §5.5. Remote path: extend `providers/meta` (config + client `fetchAdInsights`) → a new `meta-insights-sync.service.ts` (ACL facade: numeric `ad_id` → `adKey` via `meta.lock.json`, string→number coercion) → a framework `source` in `sources/remote/`. Local path: framework `source`s in `sources/local/` that run raw Drizzle aggregations (allowed — the analytics domain is not a service). All sources are **module-level singletons** whose `load({ range })` reads the context, so the resolver's identity-based dedup works.

**Tech Stack:** TypeScript, Drizzle ORM, Zod, Meta Graph API v23.0. Verified with `pnpm tsc` + `pnpm lint` (no test runner by repo convention).

## Global Constraints

- **No schema changes to existing tables.** This plan adds no columns and no tables (a read-only acquisition layer).
- **`db` boundary:** the analytics **domain** (`src/shared/domains/analytics/**`) MAY import `@/shared/db` (it's a read-model/aggregation surface, like `lead-sources.router.ts`; precedent: `domains/permissions`, `domains/auth` import db). **Services MUST NOT** import db — `meta-insights-sync.service.ts` imports only the client/config/lock-loader, never `@/shared/db`.
- **Provider signatures return provider-native types**, never domain types (ADR-0003). The sync service translates native → domain (`adKey`-keyed rows).
- **No module-scope `process.env` reads** — new env vars go through `createProviderConfig`'s fragment (`config.ts`).
- **Sources are module-level singletons** reading `ctx.range` inside `load` (NOT factory functions taking `range`) — required for resolver dedup-by-identity.
- **Named exports only. No new libraries.**
- **Repo lint (`@antfu/eslint-config`) conventions — apply proactively (learned from prior plan):** (1) object-shape type aliases must be `export interface`, not `type` (`ts/consistent-type-definitions`); union/mapped/generic-ref types stay `type`. (2) Do NOT add `@typescript-eslint/no-explicit-any` eslint-disable comments (rule is off; the directive errors). (3) antfu `style/arrow-parens` wants parens around arrow args that have a curly body, and NO parens around a single arg with an expression body; `antfu/if-newline` wants a newline after `if (...)`. Prefer running `npx eslint --fix <file>` before committing, then confirm by the printed problem count (NOT the shell exit code — this eslint exits 0 in editor-detection mode even with errors).
- **Verification per task:** `pnpm tsc` (0 errors) + `npx eslint <files>` showing 0 problems. Never `pnpm build`. No tests.
- **Path alias:** `@/` → `src/`.

## Cross-cutting deployment note (do NOT action in this plan; flag forward)

`meta-insights-sync.service.ts` reads `scripts/meta/meta.lock.json` at runtime via `fs.readFileSync(join(process.cwd(), 'scripts/meta/meta.lock.json'))`. This works in local dev immediately. On Vercel, the consuming route/job (later plans) will need `outputFileTracingIncludes` to bundle that file. Record this in the ledger for the plan that adds the analytics tRPC route / snapshot job; it is NOT part of this plan.

---

### Task 1: Meta ad-insights response schema

**Files:**
- Create: `src/shared/services/providers/meta/schemas/insights.ts`

**Interfaces:**
- Produces: `metaAdInsightRowSchema` (Zod), `type MetaAdInsightRaw = z.infer<typeof metaAdInsightRowSchema>`, `metaAdInsightsResponseSchema`. Meta returns all numerics as strings and `actions`/`cost_per_action_type` as `{action_type, value}[]`; the schema captures that raw shape (coercion happens in the sync service, Task 4).

- [ ] **Step 1: Create the file**

```ts
// Zod for Meta Marketing-API ad-level Insights rows (raw wire shape).
// All metrics arrive as STRINGS; actions are nested arrays. Coercion → domain
// numbers happens in meta-insights-sync.service.ts, not here.
import { z } from 'zod'

const actionEntrySchema = z.object({
  action_type: z.string(),
  value: z.string(),
})

export const metaAdInsightRowSchema = z
  .object({
    ad_id: z.string(),
    ad_name: z.string().optional(),
    spend: z.string().optional(),
    impressions: z.string().optional(),
    reach: z.string().optional(),
    frequency: z.string().optional(),
    cpm: z.string().optional(),
    ctr: z.string().optional(),
    cpc: z.string().optional(),
    inline_link_clicks: z.string().optional(),
    actions: z.array(actionEntrySchema).optional(),
    cost_per_action_type: z.array(actionEntrySchema).optional(),
    date_start: z.string().optional(),
    date_stop: z.string().optional(),
  })
  .passthrough()

export type MetaAdInsightRaw = z.infer<typeof metaAdInsightRowSchema>

export const metaAdInsightsResponseSchema = z.object({
  data: z.array(metaAdInsightRowSchema),
  paging: z
    .object({
      next: z.string().optional(),
      cursors: z.object({ after: z.string().optional() }).optional(),
    })
    .optional(),
})

export type MetaAdInsightsResponse = z.infer<typeof metaAdInsightsResponseSchema>
```

- [ ] **Step 2:** `pnpm tsc` → 0 errors.
- [ ] **Step 3:** `npx eslint src/shared/services/providers/meta/schemas/insights.ts` → 0 problems.
- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/meta/schemas/insights.ts
git commit -m "feat(analytics): Zod schema for Meta ad-level insights rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extend Meta provider config with Marketing-API credentials

**Files:**
- Modify: `src/shared/services/providers/meta/lib/config.ts`

**Interfaces:**
- Consumes: existing `metaEnvFragment`, `MetaRuntimeConfig`, `createProviderConfig` helpers, `getMetaConfig`, `isMetaConfigured`.
- Produces: `metaEnvFragment` gains optional `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID`; `MetaRuntimeConfig` gains optional `marketingToken?: string` + `adAccountId?: string`; new export `isMetaInsightsConfigured(): boolean`.

**Context:** Insights uses a DIFFERENT credential than CAPI. `requiredKeys` MUST stay the CAPI trio (adding Marketing keys there would break boot in CAPI-only envs). Marketing keys are optional; a dedicated gate reports insights availability.

- [ ] **Step 1: Read `src/shared/services/providers/meta/lib/config.ts`** to see the exact current `metaEnvFragment`, `MetaRuntimeConfig`, `createProviderConfig({...})` call, and what's exported (`getMetaConfig`, `isMetaConfigured`).

- [ ] **Step 2: Add the two optional env keys to `metaEnvFragment`.** Append inside the `z.object({...})`:

```ts
  META_ACCESS_TOKEN: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
```

- [ ] **Step 3: Add the two optional fields to the `MetaRuntimeConfig` interface** (keep it an `interface`):

```ts
  marketingToken?: string
  adAccountId?: string
```

- [ ] **Step 4: Populate them in `toConfig`** (leave `requiredKeys` unchanged):

```ts
    marketingToken: parsed.META_ACCESS_TOKEN,
    adAccountId: parsed.META_AD_ACCOUNT_ID,
```

- [ ] **Step 5: Add the insights gate export** near `isMetaConfigured`:

```ts
export function isMetaInsightsConfigured(): boolean {
  const config = getMetaConfig()
  return Boolean(config.marketingToken && config.adAccountId)
}
```

(If `getMetaConfig()` throws when unconfigured, mirror however `isMetaConfigured` guards that — read the existing implementation and match its pattern exactly rather than assuming.)

- [ ] **Step 6:** `pnpm tsc` → 0 errors.
- [ ] **Step 7:** `npx eslint src/shared/services/providers/meta/lib/config.ts` → 0 problems.
- [ ] **Step 8: Commit**

```bash
git add src/shared/services/providers/meta/lib/config.ts
git commit -m "feat(analytics): add optional Meta Marketing-API creds + insights config gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Provider client `fetchAdInsights` method

**Files:**
- Modify: `src/shared/services/providers/meta/client.ts`

**Interfaces:**
- Consumes (Task 1): `metaAdInsightsResponseSchema`, `MetaAdInsightRaw` from `../schemas/insights` (adjust relative path to the file's actual location); (Task 2) `getMetaConfig`. Existing: `META_GRAPH_BASE_URL` constant already imported/used by `sendConversions`.
- Produces: a new method on the object returned by `createMetaClient()`: `fetchAdInsights(input: { since: string; until: string; fields: string; timeIncrement?: number }): Promise<MetaAdInsightRaw[]>`. Follows paging via `paging.next`. Returns provider-native rows.

- [ ] **Step 1: Read `src/shared/services/providers/meta/client.ts`** — note how `sendConversions` builds its URL (`${META_GRAPH_BASE_URL}/...`), reads config via `getMetaConfig()`, uses `fetch` + `AbortSignal.timeout(30_000)`, and throws on non-ok. Match that style.

- [ ] **Step 2: Add the imports** at the top (merge with existing imports; use the correct relative path from `client.ts` to the schema — `client.ts` is at `providers/meta/`, schema at `providers/meta/schemas/insights.ts`, so `./schemas/insights`):

```ts
import { metaAdInsightsResponseSchema, type MetaAdInsightRaw } from './schemas/insights'
```

- [ ] **Step 3: Add the method inside the object returned by `createMetaClient()`** (alongside `sendConversions`):

```ts
    async fetchAdInsights(input: {
      since: string
      until: string
      fields: string
      timeIncrement?: number
    }): Promise<MetaAdInsightRaw[]> {
      const { marketingToken, adAccountId } = getMetaConfig()
      if (!marketingToken || !adAccountId) {
        throw new Error('[meta] insights not configured (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID)')
      }

      const first = new URL(`${META_GRAPH_BASE_URL}/${adAccountId}/insights`)
      first.searchParams.set('access_token', marketingToken)
      first.searchParams.set('level', 'ad')
      first.searchParams.set('time_range', JSON.stringify({ since: input.since, until: input.until }))
      if (input.timeIncrement) first.searchParams.set('time_increment', String(input.timeIncrement))
      first.searchParams.set('fields', input.fields)
      first.searchParams.set('limit', '200')

      const rows: MetaAdInsightRaw[] = []
      let url: string | null = first.toString()
      while (url) {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
        if (!res.ok) {
          throw new Error(`[meta] insights fetch failed ${res.status}: ${await res.text().catch(() => '')}`)
        }
        const parsed = metaAdInsightsResponseSchema.parse(await res.json())
        rows.push(...parsed.data)
        url = parsed.paging?.next ?? null
      }
      return rows
    },
```

- [ ] **Step 4:** `pnpm tsc` → 0 errors.
- [ ] **Step 5:** `npx eslint src/shared/services/providers/meta/client.ts` → 0 problems.
- [ ] **Step 6: Commit**

```bash
git add src/shared/services/providers/meta/client.ts
git commit -m "feat(analytics): metaClient.fetchAdInsights (ad-level, paged)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Meta insights sync service (ACL facade)

**Files:**
- Create: `src/shared/services/meta-insights-sync.service.ts`

**Interfaces:**
- Consumes: `metaClient` (`@/shared/services/providers/meta/client`), `isMetaInsightsConfigured` (Task 2), and `MetaAdInsightRaw` if needed for typing.
- Produces: `metaInsightsSyncService` singleton with `async byAd(range: { start: Date; end: Date }): Promise<AdInsightRow[]>`; `type MetaInsightsSyncService`; `interface AdInsightRow`.
- MUST NOT import `@/shared/db`.

**Context:** ACL translation: numeric `ad_id` → `adKey` via `scripts/meta/meta.lock.json` (drop unmanaged ads), and string metrics → numbers. Returns rows keyed by `adKey`. Inert (`[]`) when insights not configured, mirroring how `meta-sync.service.ts` no-ops when `!isMetaConfigured()`.

- [ ] **Step 1: Read `src/shared/services/meta-sync.service.ts`** to match the factory/singleton/type-export shape and the config-gate-at-top idiom.

- [ ] **Step 2: Create the file**

```ts
// ACL facade over metaClient.fetchAdInsights: numeric ad_id → adKey (via the
// campaign-as-code lock), string metrics → numbers. Returns adKey-keyed domain
// rows. NEVER imports @/shared/db. Mirrors meta-sync.service.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { metaClient } from '@/shared/services/providers/meta/client'
import { isMetaInsightsConfigured } from '@/shared/services/providers/meta/lib/config'

export interface AdInsightRow {
  adKey: string
  spend: number
  impressions: number
  reach: number
  frequency: number
  cpm: number
  ctr: number
  cpc: number
  inlineLinkClicks: number
  metaLeads: number
  landingPageViews: number
}

interface AdLockEntry {
  id: string
  creativeId: string
  fp: string
}

interface MetaLockShape {
  ads: Record<string, AdLockEntry>
}

const INSIGHTS_FIELDS
  = 'ad_id,ad_name,spend,impressions,reach,frequency,cpm,ctr,cpc,inline_link_clicks,actions,cost_per_action_type'

function loadAdKeyById(): Map<string, string> {
  const lock = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts/meta/meta.lock.json'), 'utf8'),
  ) as MetaLockShape
  const byId = new Map<string, string>()
  for (const [adKey, entry] of Object.entries(lock.ads)) byId.set(entry.id, adKey)
  return byId
}

function extractAction(
  actions: { action_type: string, value: string }[] | undefined,
  type: string,
): number {
  const hit = actions?.find((a) => a.action_type === type)
  return hit ? Number(hit.value) : 0
}

function num(value: string | undefined): number {
  return value ? Number(value) : 0
}

function createMetaInsightsSyncService() {
  return {
    async byAd(range: { start: Date, end: Date }): Promise<AdInsightRow[]> {
      if (!isMetaInsightsConfigured()) return []

      const byId = loadAdKeyById()
      const raw = await metaClient.fetchAdInsights({
        since: range.start.toISOString().slice(0, 10),
        until: range.end.toISOString().slice(0, 10),
        fields: INSIGHTS_FIELDS,
      })

      return raw.flatMap((row) => {
        const adKey = byId.get(row.ad_id)
        if (!adKey) return []
        return [{
          adKey,
          spend: num(row.spend),
          impressions: num(row.impressions),
          reach: num(row.reach),
          frequency: num(row.frequency),
          cpm: num(row.cpm),
          ctr: num(row.ctr),
          cpc: num(row.cpc),
          inlineLinkClicks: num(row.inline_link_clicks),
          metaLeads: extractAction(row.actions, 'offsite_conversion.fb_pixel_lead'),
          landingPageViews: extractAction(row.actions, 'landing_page_view'),
        }]
      })
    },
  }
}

export const metaInsightsSyncService = createMetaInsightsSyncService()
export type MetaInsightsSyncService = ReturnType<typeof createMetaInsightsSyncService>
```

- [ ] **Step 3:** `pnpm tsc` → 0 errors.
- [ ] **Step 4:** `npx eslint src/shared/services/meta-insights-sync.service.ts` → 0 problems. Confirm the file does NOT import `@/shared/db`.
- [ ] **Step 5: Commit**

```bash
git add src/shared/services/meta-insights-sync.service.ts
git commit -m "feat(analytics): meta-insights-sync service — adKey resolution + coercion ACL

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Remote source — `adStats`

**Files:**
- Create: `src/shared/domains/analytics/sources/remote/meta-insights.ts`

**Interfaces:**
- Consumes: `source` from `../../types`; `metaInsightsSyncService` (Task 4).
- Produces: `export const adStats` — a module-level singleton `Source` keyed by `adKey`, whose `load({ range })` returns `AdInsightRow[]`.

**Context:** Module-level singleton (stable identity for dedup). Reads `ctx.range` inside `load`.

- [ ] **Step 1: Create the file**

```ts
// Remote analytics source: Meta ad-level insights keyed by adKey.
// Module-level singleton — stable identity so the resolver dedups it across metrics.
import { metaInsightsSyncService } from '@/shared/services/meta-insights-sync.service'
import { source } from '../../types'

export const adStats = source({
  key: 'adKey',
  load: ({ range }) => metaInsightsSyncService.byAd(range),
})
```

- [ ] **Step 2:** `pnpm tsc` → 0 errors. (Confirms `AdInsightRow` satisfies `SourceRow` and `adKey` is a valid `key`.)
- [ ] **Step 3:** `npx eslint src/shared/domains/analytics/sources/remote/meta-insights.ts` → 0 problems.
- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/analytics/sources/remote/meta-insights.ts
git commit -m "feat(analytics): adStats remote source (Meta insights by adKey)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Local SQL sources — leads / appointments / signed per adKey

**Files:**
- Create: `src/shared/domains/analytics/sources/local/leads-per-adkey.ts`
- Create: `src/shared/domains/analytics/sources/local/appointments-per-adkey.ts`
- Create: `src/shared/domains/analytics/sources/local/signed-per-adkey.ts`

**Interfaces:**
- Consumes: `source` from `../../types`; `db` from `@/shared/db`; drizzle `and/eq/gte/lte/sql`; schema tables `customers`, `customerLeadAttribution`, `meetings`; `isSignedCustomerSql` from `@/shared/entities/customers/lib/signed-customer-sql`.
- Produces: `export const leadsPerAdKey`, `export const appointmentsPerAdKey`, `export const signedPerAdKey` — module-level singleton `Source`s keyed by `adKey`, each reading `ctx.range`.

**Context:** Raw `db` aggregation is allowed here (domain, not service — see Global Constraints). `createdAt` columns are `mode:'string'` timestamps → compare against `.toISOString()`. `utmContent` is nullable → filter `IS NOT NULL`. Copy the exact column refs verified in grounding.

- [ ] **Step 1: Create `leads-per-adkey.ts`**

```ts
// Local source: first-party lead count per adKey (attribution rows in range).
// Module-level singleton for resolver dedup. Raw db aggregation (domain, not service).
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { source } from '../../types'

export const leadsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        leads: sql<number>`COUNT(${customerLeadAttribution.customerId})::int`,
      })
      .from(customerLeadAttribution)
      .innerJoin(customers, eq(customers.id, customerLeadAttribution.customerId))
      .where(and(
        sql`${customerLeadAttribution.utmContent} IS NOT NULL`,
        gte(customers.createdAt, range.start.toISOString()),
        lte(customers.createdAt, range.end.toISOString()),
      ))
      .groupBy(customerLeadAttribution.utmContent)

    return rows.map((r) => ({ adKey: r.adKey as string, leads: r.leads }))
  },
})
```

- [ ] **Step 2: Create `appointments-per-adkey.ts`**

```ts
// Local source: appointments (meetings) per adKey in range.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { source } from '../../types'

export const appointmentsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        appointments: sql<number>`COUNT(DISTINCT ${meetings.customerId})::int`,
      })
      .from(meetings)
      .innerJoin(customers, eq(customers.id, meetings.customerId))
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(and(
        sql`${customerLeadAttribution.utmContent} IS NOT NULL`,
        gte(meetings.createdAt, range.start.toISOString()),
        lte(meetings.createdAt, range.end.toISOString()),
      ))
      .groupBy(customerLeadAttribution.utmContent)

    return rows.map((r) => ({ adKey: r.adKey as string, appointments: r.appointments }))
  },
})
```

- [ ] **Step 3: Create `signed-per-adkey.ts`** (note: `isSignedCustomerSql()` hard-codes `"customers"."id"`, so `customers` must be in the query scope — it is)

```ts
// Local source: signed customers (≥1 project) per adKey in range.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'
import { source } from '../../types'

export const signedPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        signed: sql<number>`COUNT(DISTINCT ${customers.id})::int`,
      })
      .from(customers)
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(and(
        isSignedCustomerSql(),
        sql`${customerLeadAttribution.utmContent} IS NOT NULL`,
        gte(customers.createdAt, range.start.toISOString()),
        lte(customers.createdAt, range.end.toISOString()),
      ))
      .groupBy(customerLeadAttribution.utmContent)

    return rows.map((r) => ({ adKey: r.adKey as string, signed: r.signed }))
  },
})
```

- [ ] **Step 4:** `pnpm tsc` → 0 errors. (Verifies the Drizzle query builders type-check against the real schema columns — the primary safety net here.)
- [ ] **Step 5:** `npx eslint src/shared/domains/analytics/sources/local/` → 0 problems.
- [ ] **Step 6: Commit** (all three in one commit — they are one cohesive deliverable)

```bash
git add src/shared/domains/analytics/sources/local/leads-per-adkey.ts src/shared/domains/analytics/sources/local/appointments-per-adkey.ts src/shared/domains/analytics/sources/local/signed-per-adkey.ts
git commit -m "feat(analytics): local SQL sources — leads/appointments/signed per adKey

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## What this plan delivers

Four framework `source`s ready to be composed into metrics: `adStats` (remote Meta insights) and `leadsPerAdKey` / `appointmentsPerAdKey` / `signedPerAdKey` (local SQL), all keyed by `adKey`, all module-level singletons. Plus the provider plumbing (config creds, `fetchAdInsights`, the insights sync ACL). Nothing consumes them yet — the next plan wires metrics + buckets so `resolve()` returns real CPL / cost-per-appointment / ROAS-per-creative.

## Self-review notes

- Spec coverage: implements spec §5.5 provider/sync/sources rows and the §6 Marketing source inputs (`adStats`, `leads`, `appointments`, `signedPerAdKey`). Metrics/buckets that consume these are the NEXT plan (spec §6 catalog).
- No columns/tables added (Global Constraint honored).
- `meta-insights-sync.service.ts` imports no `db` (constraint honored); local sources import `db` (allowed — domain).
- Deployment file-tracing for `meta.lock.json` flagged forward, not actioned here.

## Next plans

3. **Marketing + Sales buckets** — metric descriptors wiring these sources (spec §6), with `available:false` instrumentation-needed stubs; a `buckets/index.ts` registry.
4. **Snapshot table + job** — `analytics_snapshots` + daily QStash job iterating registered buckets' `trend:true` metrics (add `outputFileTracingIncludes` for `meta.lock.json` here).
5. **Router + UI** — `analytics.router.ts` (`superAdminProcedure` → `resolve`) + `src/features/analytics/*`, nav flip, gating, prefetch/hydrate.
