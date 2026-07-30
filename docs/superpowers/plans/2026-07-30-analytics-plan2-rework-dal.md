# Analytics Plan 2 Rework — Route SQL through the DAL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the hard-rule violation in the committed Plan 2 data-acquisition layer — raw `db.select` inside `src/shared/domains/analytics/` — by relocating all SQL aggregation into the customers DAL, collapsing three duplicated query skeletons into one shared filter, and decoupling the Meta-insights config gate from the CAPI-required-keys gate.

**Architecture:** SQL aggregation moves to `entities/customers/dal/server/ad-performance.ts` (the only layer allowed to import `db`). The three `domains/analytics/sources/local/*` files become thin adapters that call the DAL and unwrap `DalReturn` via `dalVerifySuccess`, importing no `db`, `drizzle`, or schema. The shared paid-Meta cohort filter is extracted once. Meta insights gets its own `createProviderConfig` instance so reading the Marketing-API creds no longer throws when the CAPI trio is unset.

**Tech Stack:** Drizzle (Postgres/Neon), the repo DAL kit (`dalDbOperation` / `DalReturn` / `dalVerifySuccess`), the analytics `source()` builder, `createProviderConfig`.

## Global Constraints

- **Hard DAL rule (ADR-0002:157 / `dal-conventions.md#only-dal-imports-db`):** only files under `src/shared/dal/**` or `src/shared/entities/*/dal/**` may `import { db }`. After this rework, **zero** files under `src/shared/domains/analytics/**` import `db`, drizzle operators, or `@/shared/db/schema/*`.
- **DAL signatures (`dal-conventions.md`):** every exported DAL function returns `Promise<DalReturn<T>>` via `dalDbOperation`. Analytics aggregations are SYSTEM-level/omni reads → they take **no `ctx`** (precedent: `listEnrollableLeadsBySource` in `customers/dal/server/queries.ts`), never visibility-scoped.
- **No new columns, no schema change.** Read-only rework.
- **No manual `updatedAt`** anywhere (N/A here — reads only).
- **Verification is `pnpm tsc` + `pnpm lint` only** (no test runner in this repo). Never `pnpm build`.
- **Scope predicate stays exact:** `brandedMetaPaidScope = and(eq(utm_source,'meta'), eq(utm_medium,'paid'))` — deliberately narrower than `leadSourceId='branded-meta-ads'`. Do not widen it.
- **Cohort stays `customers.createdAt`** for all three (so appts÷leads and signed÷leads are same-population rates). `createdAt` is `timestamp({mode:'string'})` → `.toISOString()` comparison is correct; keep it.
- Lint gotchas: object-shape aliases → `interface`; no `ts/no-explicit-any` disable comments (rule is off); `style/arrow-parens`, `antfu/if-newline`. Judge lint by the printed error count (editor mode exits 0).

---

### Task 1: Customers DAL — `ad-performance.ts` (SQL aggregation home)

**Files:**
- Create: `src/shared/entities/customers/dal/server/ad-performance.ts`

**Interfaces:**
- Consumes: `db`, `@/shared/db/schema/*`, `dalDbOperation`, `isSignedCustomerSql()`.
- Produces (later tasks rely on these exact names/shapes):
  - `brandedMetaPaidScope: SQL` (re-exported for future Sales DAL reuse)
  - `leadsByAdKey(range): Promise<DalReturn<AdKeyLeads[]>>` where `AdKeyLeads = { adKey: string, leads: number }`
  - `appointmentsByAdKey(range): Promise<DalReturn<AdKeyAppointments[]>>` where `AdKeyAppointments = { adKey: string, appointments: number }`
  - `signedByAdKey(range): Promise<DalReturn<AdKeySigned[]>>` where `AdKeySigned = { adKey: string, signed: number }`
  - `range` param type: `{ start: Date, end: Date }` (structurally accepts the domain `DateRange`).

- [ ] **Step 1: Write the file**

```ts
// Paid-Meta ad-performance aggregations, keyed by adKey (utm_content).
// The ONLY home for these SQL rollups — domains/analytics/sources/local/* call
// THESE, never db (hard DAL rule, ADR-0002:157). SYSTEM-level omni reads: no ctx,
// not visibility-scoped (precedent: listEnrollableLeadsBySource in queries.ts).
import type { SQL } from 'drizzle-orm'
import type { DalReturn } from '@/shared/dal/server/types'
import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { isSignedCustomerSql } from '@/shared/entities/customers/lib/signed-customer-sql'

interface DateRangeInput {
  start: Date
  end: Date
}

export interface AdKeyLeads {
  adKey: string
  leads: number
}

export interface AdKeyAppointments {
  adKey: string
  appointments: number
}

export interface AdKeySigned {
  adKey: string
  signed: number
}

/**
 * Paid Meta AD click scope. utm_source=meta AND utm_medium=paid is emitted
 * SOLELY by scripts/meta/sync/ad-link.ts (buildUrlTags) — the one signal of a
 * paid ad click. Deliberately narrower than customers.leadSourceId='branded-meta-ads'
 * (which also counts organic funnel visitors with no attribution). Exported for
 * reuse by future Sales/Marketing DAL reads.
 */
export const brandedMetaPaidScope = and(
  eq(customerLeadAttribution.utmSource, 'meta'),
  eq(customerLeadAttribution.utmMedium, 'paid'),
)!

/**
 * Shared per-adKey cohort filter: paid-Meta scope + non-null adKey + lead-creation
 * date window (customers.createdAt). Extracted once so the three aggregations can
 * never drift apart. `extra` folds in a per-metric predicate (e.g. isSignedCustomerSql()).
 */
function paidMetaByAdKeyWhere(range: DateRangeInput, extra?: SQL): SQL {
  return and(
    brandedMetaPaidScope,
    isNotNull(customerLeadAttribution.utmContent),
    gte(customers.createdAt, range.start.toISOString()),
    lte(customers.createdAt, range.end.toISOString()),
    extra,
  )!
}

/** First-party lead count per adKey (paid-Meta attribution rows in range). */
export async function leadsByAdKey(range: DateRangeInput): Promise<DalReturn<AdKeyLeads[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        count: sql<number>`COUNT(${customerLeadAttribution.customerId})::int`,
      })
      .from(customerLeadAttribution)
      .innerJoin(customers, eq(customers.id, customerLeadAttribution.customerId))
      .where(paidMetaByAdKeyWhere(range))
      .groupBy(customerLeadAttribution.utmContent)
    return rows.map(r => ({ adKey: r.adKey as string, leads: r.count }))
  })
}

/** Appointments = distinct customers with ≥1 meeting, per adKey in range. */
export async function appointmentsByAdKey(range: DateRangeInput): Promise<DalReturn<AdKeyAppointments[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        count: sql<number>`COUNT(DISTINCT ${meetings.customerId})::int`,
      })
      .from(meetings)
      .innerJoin(customers, eq(customers.id, meetings.customerId))
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(paidMetaByAdKeyWhere(range))
      .groupBy(customerLeadAttribution.utmContent)
    return rows.map(r => ({ adKey: r.adKey as string, appointments: r.count }))
  })
}

/** Signed customers (≥1 project) per adKey in range. */
export async function signedByAdKey(range: DateRangeInput): Promise<DalReturn<AdKeySigned[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        adKey: customerLeadAttribution.utmContent,
        count: sql<number>`COUNT(DISTINCT ${customers.id})::int`,
      })
      .from(customers)
      .innerJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
      .where(paidMetaByAdKeyWhere(range, isSignedCustomerSql()))
      .groupBy(customerLeadAttribution.utmContent)
    return rows.map(r => ({ adKey: r.adKey as string, signed: r.count }))
  })
}
```

> Note on the `!` after `and(...)`: drizzle's `and()` returns `SQL | undefined`; the three inputs are always present so the assertion is safe and keeps `brandedMetaPaidScope`/`paidMetaByAdKeyWhere` typed as `SQL`. If lint objects to non-null assertion, wrap instead: `const scope = and(...); if (!scope) throw new Error('unreachable')`.

> Why not a single generic query over all three: the FROM/JOIN roots differ (leads root = attribution; appointments root = meetings; signed root = customers) and the count expressions differ (`COUNT` vs `COUNT(DISTINCT ...)`). Forcing one query over heterogeneous roots fights the ORM types for no gain. The thing that actually drifts — the cohort WHERE clause — is extracted once in `paidMetaByAdKeyWhere`. That is the correct DRY boundary.

- [ ] **Step 2: Verify types + lint**

Run: `pnpm tsc` then `pnpm lint`
Expected: no new errors attributable to this file. (`isSignedCustomerSql()` returns an `SQL` predicate — confirm its signature; if it needs an alias arg, pass none as the existing signed source did.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/customers/dal/server/ad-performance.ts
git commit -m "feat(analytics): customers DAL — paid-Meta ad-performance aggregations (leads/appointments/signed by adKey)"
```

---

### Task 2: Domain sources become thin DAL adapters

**Files:**
- Modify: `src/shared/domains/analytics/sources/local/leads-per-adkey.ts` (full rewrite)
- Modify: `src/shared/domains/analytics/sources/local/appointments-per-adkey.ts` (full rewrite)
- Modify: `src/shared/domains/analytics/sources/local/signed-per-adkey.ts` (full rewrite)
- Delete: `src/shared/domains/analytics/sources/local/branded-meta-scope.ts` (moved into the DAL)

**Interfaces:**
- Consumes: `leadsByAdKey` / `appointmentsByAdKey` / `signedByAdKey` from Task 1; `dalVerifySuccess` from `@/shared/dal/server/lib/helpers`.
- Produces: `leadsPerAdKey`, `appointmentsPerAdKey`, `signedPerAdKey` — unchanged source names/keys/row shapes, so metrics/resolver consumers are untouched.

- [ ] **Step 1: Confirm `branded-meta-scope.ts` has no consumers outside the three sources**

Run: `grep -rn "branded-meta-scope\|brandedMetaPaidScope" src --include=*.ts`
Expected: only the three `sources/local/*-per-adkey.ts` files (which this task rewrites) plus the new DAL file. If anything else imports it, STOP and report.

- [ ] **Step 2: Rewrite `leads-per-adkey.ts`**

```ts
// Local source: first-party paid-Meta lead count per adKey. Thin adapter over the
// customers DAL — imports NO db (SQL lives in the DAL, ADR-0002:157).
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { leadsByAdKey } from '@/shared/entities/customers/dal/server/ad-performance'
import { source } from '../../types'

export const leadsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => dalVerifySuccess(await leadsByAdKey(range)),
})
```

- [ ] **Step 3: Rewrite `appointments-per-adkey.ts`**

```ts
// Local source: appointments (distinct customers with ≥1 meeting) per adKey. Thin
// adapter over the customers DAL — imports NO db.
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { appointmentsByAdKey } from '@/shared/entities/customers/dal/server/ad-performance'
import { source } from '../../types'

export const appointmentsPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => dalVerifySuccess(await appointmentsByAdKey(range)),
})
```

- [ ] **Step 4: Rewrite `signed-per-adkey.ts`**

```ts
// Local source: signed customers (≥1 project) per adKey. Thin adapter over the
// customers DAL — imports NO db.
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { signedByAdKey } from '@/shared/entities/customers/dal/server/ad-performance'
import { source } from '../../types'

export const signedPerAdKey = source({
  key: 'adKey',
  load: async ({ range }) => dalVerifySuccess(await signedByAdKey(range)),
})
```

- [ ] **Step 5: Delete the moved scope file**

```bash
git rm src/shared/domains/analytics/sources/local/branded-meta-scope.ts
```

- [ ] **Step 6: Prove the domain layer no longer touches db**

Run: `grep -rn "@/shared/db\|drizzle-orm" src/shared/domains/analytics`
Expected: **no matches** (types.ts/resolver.ts were already pure; the three sources are now clean; remote source only imports the sync service).

- [ ] **Step 7: Verify + commit**

Run: `pnpm tsc` then `pnpm lint` — expected clean.

```bash
git add src/shared/domains/analytics/sources/local
git commit -m "refactor(analytics): local sources → thin DAL adapters; drop raw db from domains/ (ADR-0002:157)"
```

---

### Task 3: Decouple Meta-insights config from the CAPI required-keys gate

**Files:**
- Modify: `src/shared/services/providers/meta/lib/config.ts`
- Modify: `src/shared/services/providers/meta/client.ts:99-102` (the `fetchAdInsights` config read)

**Interfaces:**
- Produces: `getMetaInsightsConfig(): MetaInsightsConfig` and `isMetaInsightsConfigured(): boolean`, both derived from a dedicated `createProviderConfig` instance (not a raw `process.env` peek).
- Removes: the hand-rolled `isMetaInsightsConfigured()` (`process.env` read) and the now-unused `marketingToken?`/`adAccountId?` fields on `MetaRuntimeConfig`.

- [ ] **Step 1: Add a dedicated insights config instance in `config.ts`**

Remove `marketingToken?`/`adAccountId?` from `MetaRuntimeConfig` and its `toConfig` mapping (they belonged to the CAPI config only by accident). Then append, after the existing `helpers` block:

```ts
export interface MetaInsightsConfig {
  marketingToken: string
  adAccountId: string
}

// Separate config surface: Marketing-API insights creds are independent of the
// CAPI trio, so reading them must NOT require CAPI to be configured. Own factory
// instance → own required-keys gate (never throws on the CAPI keys).
const insightsHelpers = createProviderConfig({
  provider: 'meta-insights',
  fragment: metaEnvFragment,
  requiredKeys: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
  toConfig: (parsed): MetaInsightsConfig => ({
    marketingToken: parsed.META_ACCESS_TOKEN!,
    adAccountId: parsed.META_AD_ACCOUNT_ID!,
  }),
})

export const getMetaInsightsConfig = insightsHelpers.get
export const isMetaInsightsConfigured = insightsHelpers.isConfigured
```

Delete the old:
```ts
export function isMetaInsightsConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID)
}
```
and the now-dead `import process from 'node:process'` if nothing else in the file uses it (check — the top-of-file `process` import may become unused).

- [ ] **Step 2: Point `fetchAdInsights` at the insights config**

In `client.ts`, change the import `getMetaConfig` usage inside `fetchAdInsights` to `getMetaInsightsConfig`:

```ts
async fetchAdInsights(input: {
  since: string
  until: string
  fields: string
  timeIncrement?: number
}): Promise<MetaAdInsightRaw[]> {
  const { marketingToken, adAccountId } = getMetaInsightsConfig()
  // ...unchanged: buildUrl + Bearer header + cursor pagination...
}
```

The prior `if (!marketingToken || !adAccountId) throw` guard is no longer needed — `getMetaInsightsConfig()` throws `NotConfiguredError` if either key is missing, and `byAd` only calls this after `isMetaInsightsConfigured()` passes. Remove the guard. Update the top import: add `getMetaInsightsConfig` (keep `getMetaConfig` — still used by `sendConversions`).

- [ ] **Step 3: Confirm the sync-service gate still lines up**

`meta-insights-sync.service.ts` imports `isMetaInsightsConfigured` from `providers/meta/lib/config` and returns `[]` when false — signature unchanged (still `(): boolean`), so no edit needed. Verify the import still resolves.

- [ ] **Step 4: Verify + commit**

Run: `pnpm tsc` then `pnpm lint` — expected clean. (Watch for a now-unused `node:process` import in config.ts.)

```bash
git add src/shared/services/providers/meta/lib/config.ts src/shared/services/providers/meta/client.ts
git commit -m "fix(analytics): dedicated Meta-insights config gate — decouple from CAPI required keys, drop process.env peek"
```

---

## Self-Review

- **Spec coverage:** Task 1 = corrected §5.5 (SQL in customers DAL) + N1 layering; Task 2 = domains/ is a pure engine; Task 3 = §9 insights-config decoupling. All three audit findings (B-1 HIGH, B-2 MEDIUM, B-6 LOW) are addressed.
- **Type consistency:** source names (`leadsPerAdKey`/`appointmentsPerAdKey`/`signedPerAdKey`), keys (`'adKey'`), and row shapes (`{adKey, leads|appointments|signed}`) are unchanged from the committed sources, so `metrics/*` and the resolver need no changes. DAL names (`leadsByAdKey` etc.) are distinct from source names.
- **No placeholders:** every step has real code or a concrete command.
- **Untouched by design:** `resolver.ts`, `types.ts`, `index.ts`, the remote `adStats` source, `meta-insights-sync.service.ts`, `schemas/insights.ts` — none change.
