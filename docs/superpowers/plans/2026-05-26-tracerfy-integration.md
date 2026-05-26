# Tracerfy Integration V1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Tracerfy as the first data-enrichment provider in the four-tier service architecture, with a sync internal service that writes property + person enrichment into Customer JSONB profiles.

**Architecture:** New provider at `src/shared/services/providers/tracerfy/` (client + types + constants + translator). New internal service `customer-enrichment.service.ts` orchestrates `customerCrud` (DAL) + `tracerfyClient`. New tRPC procedure on the customers business router. No background jobs, no auto-triggers in v1.

**Tech Stack:** TypeScript, `fetch` (no SDK — Tracerfy is REST-only), Zod, Drizzle ORM, tRPC, Next.js 15, pnpm, Neon (dev branch). All conventions per `docs/adr/0003-service-provider-architecture.md` + `docs/codebase-conventions/service-architecture.md`.

**Spec:** `docs/superpowers/specs/2026-05-26-tracerfy-integration-design.md`.

---

## Pre-flight

You'll need a Tracerfy API key. Get it from the Tracerfy account dashboard. Account should have enough credit balance to do ~20 lookups (200 credits ≈ $4 at $0.02/credit).

Run all commands from the repo root: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website`.

Package manager: **pnpm** (never npm). Worktree is the current branch. Dev DB is the worktree's Neon branch — `pnpm db:push:dev` is safe.

---

## Task 1: Add `TRACERFY_API_KEY` to server env schema

**Files:**
- Modify: `src/shared/config/server-env.ts`
- Modify: `.env.local` (gitignored — local only)

- [ ] **Step 1: Add env var to Zod schema**

Open `src/shared/config/server-env.ts` and find the section comment block (look for `// RESEND`). Add a new block at the end of the existing third-party-services section (after the last provider, before any `// DATABASE` block if it's down lower). The exact place doesn't matter — just match the existing comment-block-per-provider style. Insert:

```ts
  // TRACERFY (data enrichment — skip-trace + property data)
  TRACERFY_API_KEY: z.string().optional(),
```

`.optional()` so dev environments without a Tracerfy account don't break startup. The service will fail-fast with a clear error if the key is missing AND the service is invoked.

- [ ] **Step 2: Add the actual key to `.env.local`**

Append to `.env.local` (gitignored):

```
TRACERFY_API_KEY=<paste-real-key-here>
```

- [ ] **Step 3: Verify env loads**

Run:

```bash
pnpm tsx -e "import('./src/shared/config/server-env').then(m => console.log('TRACERFY_API_KEY length:', m.default.TRACERFY_API_KEY?.length ?? 0))"
```

Expected: prints a non-zero length (the key was loaded).

- [ ] **Step 4: Commit**

```bash
git add src/shared/config/server-env.ts
git commit -m "feat(env): add TRACERFY_API_KEY for data-enrichment provider"
```

---

## Task 2: Create provider `constants.ts`

**Files:**
- Create: `src/shared/services/providers/tracerfy/constants.ts`

- [ ] **Step 1: Create directory + write constants**

```bash
mkdir -p src/shared/services/providers/tracerfy/lib
```

Create `src/shared/services/providers/tracerfy/constants.ts`:

```ts
/**
 * Tracerfy REST API constants.
 * Docs: https://www.tracerfy.com/skip-tracing-api-documentation/
 */

export const TRACERFY_BASE_URL = 'https://tracerfy.com/v1/api'

export const TRACERFY_ENDPOINTS = {
  // Sync (instant) lookups — what we use in v1
  traceLookup: '/trace/lookup/',
  leadBuilderLookup: '/lead-builder/lookup/',
  autocomplete: '/lead-builder/autocomplete/',
  analytics: '/analytics/',
  // Async / batch — not used in v1, listed for future reference
  traceBatch: '/trace/',
  traceParcelLookup: '/trace/parcel/lookup/',
  leadBuilderPreview: '/lead-builder/preview/',
  leadBuilderExecute: '/lead-builder/execute/',
  dncLookup: '/dnc/lookup/',
  dncScrub: '/dnc/scrub/',
} as const

/**
 * Sync lookups: 500/min. Far above any expected v1 traffic.
 * Listed here as documentation; not enforced client-side.
 */
export const TRACERFY_RATE_LIMITS = {
  syncLookupsPerMinute: 500,
} as const
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/providers/tracerfy/constants.ts
git commit -m "feat(tracerfy): add provider constants (base URL + endpoint paths)"
```

---

## Task 3: Create provider `types.ts`

**Files:**
- Create: `src/shared/services/providers/tracerfy/types.ts`

- [ ] **Step 1: Write the provider-native types**

Create `src/shared/services/providers/tracerfy/types.ts`:

```ts
/**
 * Tracerfy-native response types. These mirror the Tracerfy REST shape
 * (snake_case fields, integer/float as documented). They live ONLY inside
 * the provider — never imported by services or DAL. Translation to domain
 * types happens in `lib/map-from-tracerfy.ts`.
 *
 * Docs: https://www.tracerfy.com/skip-tracing-api-documentation/
 */

export interface TracerfyPhone {
  number: string
  type: 'Mobile' | 'Landline'
  dnc: boolean
  tcpa?: boolean
  carrier?: string
  rank: number
}

export interface TracerfyEmail {
  email: string
  rank: number
}

export interface TracerfyMailingAddress {
  street?: string
  address?: string
  city: string
  state: string
  zip: string
}

export interface TracerfyPerson {
  first_name: string
  last_name: string
  full_name?: string
  dob?: string // YYYY-MM-DD
  age?: number | string
  deceased: boolean
  property_owner: boolean
  litigator: boolean
  mailing_address?: TracerfyMailingAddress
  phones: TracerfyPhone[]
  emails: TracerfyEmail[]
}

export interface TracerfyPropensity {
  score: number
  category: 'Low' | 'Medium' | 'High'
  factors?: Array<{ name: string, points: number, reason: string }>
}

/**
 * Subset of /lead-builder/rows/ fields that /lead-builder/lookup/ returns
 * inside `property`. We only type the fields we promote into Customer
 * JSONB — anything else is preserved in the raw `tracerfyEnrichmentJSON`.
 */
export interface TracerfyProperty {
  address: string
  city: string
  state: string
  zip_code: string
  county?: string
  latitude?: number
  longitude?: number
  apn?: string
  property_type?: string
  year_built?: number
  beds?: number
  baths?: number
  units_count?: number
  stories?: number
  building_size_sqft?: number
  lot_size_sqft?: number
  roof_material?: string
  estimated_value?: number
  estimated_equity?: number
  equity_percent?: number
  last_sale_date?: string
  last_sale_price?: number
  years_owned?: number
  open_mortgage_balance?: number
  lender_name?: string
  estimated_mortgage_payment?: number
  owner_occupied?: boolean
  absentee_owner?: boolean
  hoa?: boolean
  vacant?: boolean
  free_clear?: boolean
  high_equity?: boolean
  // Propensity bundles (sell/refi/roof/hvac/solar) — flat in Tracerfy,
  // grouped by us in the translator. We type the raw flat shape here.
  sell_propensity_score?: number
  sell_propensity_category?: 'Low' | 'Medium' | 'High'
  refi_propensity_score?: number
  refi_propensity_category?: 'Low' | 'Medium' | 'High'
  roof_renovate_propensity_score?: number
  roof_renovate_propensity_category?: 'Low' | 'Medium' | 'High'
  hvac_renovate_propensity_score?: number
  hvac_renovate_propensity_category?: 'Low' | 'Medium' | 'High'
  solar_renovate_propensity_score?: number
  solar_renovate_propensity_category?: 'Low' | 'Medium' | 'High'
}

export interface TracerfyLeadBuilderLookupResponse {
  hit: boolean
  credits_deducted: number
  skip_trace_hit?: boolean
  property?: TracerfyProperty
  owners?: Array<{ first_name: string, last_name: string }>
  mailing_address?: TracerfyMailingAddress
  contacts?: {
    phones: TracerfyPhone[]
    emails: TracerfyEmail[]
    litigator?: boolean
    has_contact?: boolean
    contact_clean?: boolean
  }
}

export interface TracerfyTraceLookupResponse {
  address: string
  city: string
  state: string
  zip: string
  find_owner: boolean
  hit: boolean
  persons_count: number
  credits_deducted: number
  persons: TracerfyPerson[]
}

export interface TracerfyAutocompleteResult {
  title: string
  address: string
  street_address: string
  house?: string
  street?: string
  city: string
  state: string
  zip: string
  county?: string
  apn?: string
  latitude?: number
  longitude?: number
}

export interface TracerfyAutocompleteResponse {
  query: string
  credits_deducted: 0
  results: TracerfyAutocompleteResult[]
}

export interface TracerfyAnalyticsResponse {
  total_queues: number
  properties_traced: number
  queues_pending: number
  queues_completed: number
  balance: number
}

export interface TracerfyLookupInput {
  address: string
  city: string
  state: string
  zip?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/providers/tracerfy/types.ts
git commit -m "feat(tracerfy): add provider-native response types"
```

---

## Task 4: Create provider `client.ts`

**Files:**
- Create: `src/shared/services/providers/tracerfy/client.ts`

- [ ] **Step 1: Write the client factory + singleton**

Create `src/shared/services/providers/tracerfy/client.ts`. Pattern matches `zoho-sign/client.ts` (factory function + exported singleton). No external SDK — plain `fetch`.

```ts
import env from '@/shared/config/server-env'
import { TRACERFY_BASE_URL, TRACERFY_ENDPOINTS } from './constants'
import type {
  TracerfyAnalyticsResponse,
  TracerfyAutocompleteResponse,
  TracerfyLeadBuilderLookupResponse,
  TracerfyLookupInput,
  TracerfyTraceLookupResponse,
} from './types'

function getApiKey(): string {
  const key = env.TRACERFY_API_KEY
  if (!key) {
    throw new Error('TRACERFY_API_KEY is not set. Add it to .env.local and restart.')
  }
  return key
}

async function tracerfyFetch<T>(
  endpoint: string,
  init: { method: 'GET' | 'POST', body?: unknown },
): Promise<T> {
  const url = `${TRACERFY_BASE_URL}${endpoint}`
  const res = await fetch(url, {
    method: init.method,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '<no body>')
    throw new Error(`Tracerfy ${init.method} ${endpoint} failed (${res.status}): ${errText}`)
  }

  return res.json() as Promise<T>
}

function createTracerfyClient() {
  return {
    /**
     * POST /lead-builder/lookup/ — full property + skip-trace in one call.
     * 10 credits on hit, 0 on miss.
     */
    async leadBuilderLookup(input: TracerfyLookupInput): Promise<TracerfyLeadBuilderLookupResponse> {
      return tracerfyFetch<TracerfyLeadBuilderLookupResponse>(
        TRACERFY_ENDPOINTS.leadBuilderLookup,
        {
          method: 'POST',
          body: {
            address: input.address,
            city: input.city,
            state: input.state,
            zip_code: input.zip,
          },
        },
      )
    },

    /**
     * POST /trace/lookup/ — skip-trace only (no property fields).
     * 5 credits on hit, 0 on miss. Cheaper fallback.
     */
    async traceLookup(input: TracerfyLookupInput & { findOwner?: boolean }): Promise<TracerfyTraceLookupResponse> {
      return tracerfyFetch<TracerfyTraceLookupResponse>(
        TRACERFY_ENDPOINTS.traceLookup,
        {
          method: 'POST',
          body: {
            address: input.address,
            city: input.city,
            state: input.state,
            zip: input.zip,
            find_owner: input.findOwner ?? true,
          },
        },
      )
    },

    /**
     * POST /lead-builder/autocomplete/ — address suggestions. FREE.
     */
    async autocompleteAddress(query: string): Promise<TracerfyAutocompleteResponse> {
      return tracerfyFetch<TracerfyAutocompleteResponse>(
        TRACERFY_ENDPOINTS.autocomplete,
        { method: 'POST', body: { search: query } },
      )
    },

    /**
     * GET /analytics/ — account summary including credit balance.
     */
    async getAccountAnalytics(): Promise<TracerfyAnalyticsResponse> {
      return tracerfyFetch<TracerfyAnalyticsResponse>(
        TRACERFY_ENDPOINTS.analytics,
        { method: 'GET' },
      )
    },
  }
}

export type TracerfyClient = ReturnType<typeof createTracerfyClient>
export const tracerfyClient = createTracerfyClient()
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc
```

Expected: no errors related to the new files. If there are unrelated existing errors, ignore them.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/tracerfy/client.ts
git commit -m "feat(tracerfy): add HTTP client with leadBuilderLookup, traceLookup, autocomplete, analytics"
```

---

## Task 5: Smoke-test script — first live call against Tracerfy

This is the moment of truth. Validates auth, base URL, response shape against the real API. Costs ~10 credits per `leadBuilderLookup` hit.

**Files:**
- Create: `scripts/tracerfy/test-lookup.ts`

- [ ] **Step 1: Create the script**

```bash
mkdir -p scripts/tracerfy
```

Create `scripts/tracerfy/test-lookup.ts`:

```ts
/* eslint-disable no-console */
/**
 * Smoke test: call Tracerfy's lead-builder/lookup against a real address
 * and pretty-print the response. Validates auth, URL, and field shape.
 *
 * Usage:
 *   pnpm tsx scripts/tracerfy/test-lookup.ts "<address>" "<city>" "<state>" "[zip]"
 *
 * Example:
 *   pnpm tsx scripts/tracerfy/test-lookup.ts "1600 Amphitheatre Pkwy" "Mountain View" "CA" "94043"
 *
 * Cost: 10 credits on hit, 0 on miss.
 */
import './../lib/load-env'

import { tracerfyClient } from '@/shared/services/providers/tracerfy/client'

async function main() {
  const [address, city, state, zip] = process.argv.slice(2)

  if (!address || !city || !state) {
    console.error('Usage: pnpm tsx scripts/tracerfy/test-lookup.ts "<address>" "<city>" "<state>" "[zip]"')
    process.exit(1)
  }

  console.log(`\n→ Looking up: ${address}, ${city}, ${state}${zip ? ` ${zip}` : ''}\n`)

  console.log('--- Account analytics (pre-call) ---')
  const before = await tracerfyClient.getAccountAnalytics()
  console.log(`Credit balance: ${before.balance}`)

  console.log('\n--- Lead-builder lookup ---')
  const result = await tracerfyClient.leadBuilderLookup({ address, city, state, zip })
  console.log(JSON.stringify(result, null, 2))

  console.log('\n--- Account analytics (post-call) ---')
  const after = await tracerfyClient.getAccountAnalytics()
  console.log(`Credit balance: ${after.balance} (Δ ${after.balance - before.balance})`)

  console.log(`\n✓ hit: ${result.hit}, credits_deducted: ${result.credits_deducted}`)
}

main().catch((err) => {
  console.error('\n✗ Tracerfy smoke test failed:')
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run it against a known SoCal address**

Pick a real residential address you know (your own home, a recent customer, or a public landmark). For an unowned/non-residential address Tracerfy may return `hit: false`.

```bash
pnpm tsx scripts/tracerfy/test-lookup.ts "<address>" "<city>" "CA" "<zip>"
```

Expected on a hit:
- Balance reads OK pre-call
- JSON response prints with `hit: true`, `credits_deducted: 10`
- `property.year_built`, `beds`, `baths`, `estimated_value` etc. populated
- `contacts.phones[]` and `contacts.emails[]` populated
- `owners[]` has names
- Balance after = balance before - 10

If `hit: false`: not necessarily a bug — try a different residential address. Try 3 addresses before declaring failure.

- [ ] **Step 3: Commit the script**

```bash
git add scripts/tracerfy/test-lookup.ts
git commit -m "test(tracerfy): smoke-test script for live lead-builder/lookup"
```

---

## Task 6: Translator — `map-from-tracerfy.ts`

Pure function. Pure unit-testable. No I/O.

**Files:**
- Create: `src/shared/services/providers/tracerfy/lib/map-from-tracerfy.ts`

- [ ] **Step 1: Write the translator**

This produces three sparse profile patches + a contact-suggestions object. The service merges these into existing JSONB per the rules in the spec (fill-if-null vs always-overwrite).

```ts
import type {
  TracerfyLeadBuilderLookupResponse,
  TracerfyPerson,
  TracerfyProperty,
} from '../types'

export interface PropensityScore {
  score: number
  category: 'Low' | 'Medium' | 'High'
}

export interface TracerfyPropensityBundle {
  sell?: PropensityScore
  refi?: PropensityScore
  roof?: PropensityScore
  hvac?: PropensityScore
  solar?: PropensityScore
}

/**
 * Fields we promote into propertyProfileJSON. All optional — translator
 * returns sparse objects (only fields with real signals).
 */
export interface PropertyProfilePatch {
  // Fill-if-null fields (never overwrite agent-entered structural data)
  fillIfNull: {
    yearBuiltExact?: number
    beds?: number
    baths?: number
    buildingSizeSqft?: number
    lotSizeSqft?: number
    stories?: number
    propertyType?: string
    roofMaterial?: string
  }
  // Always-overwrite fields (objective market data; latest is best)
  overwrite: {
    estimatedValue?: number
    estimatedEquity?: number
    equityPercent?: number
    lastSaleDate?: string
    lastSalePrice?: number
    yearsOwned?: number
    ownerOccupied?: boolean
    absenteeOwner?: boolean
    hoa?: boolean
    propensityScores?: TracerfyPropensityBundle
  }
}

export interface CustomerProfilePatch {
  fillIfNull: {
    dob?: string
    isPropertyOwner?: boolean
  }
  overwrite: {
    isDeceased?: boolean
    isLitigator?: boolean
  }
}

export interface FinancialProfilePatch {
  overwrite: {
    openMortgageBalance?: number
    estimatedMortgagePayment?: number
    lenderName?: string
  }
}

export interface ContactSuggestions {
  phones: Array<{ number: string, type: string, dnc: boolean, rank: number }>
  emails: Array<{ email: string, rank: number }>
  ownerNames: Array<{ firstName: string, lastName: string }>
}

export interface TracerfyTranslated {
  propertyProfile: PropertyProfilePatch
  customerProfile: CustomerProfilePatch
  financialProfile: FinancialProfilePatch
  contactSuggestions: ContactSuggestions
}

/**
 * Treat empty string / null / undefined as "no signal" and skip.
 * Numbers: keep 0 only for boolean-flag-like fields (handled separately).
 */
function nonEmpty<T>(v: T | null | undefined | ''): T | undefined {
  if (v === null || v === undefined || v === '') {
    return undefined
  }
  return v
}

function buildPropensityBundle(p: TracerfyProperty): TracerfyPropensityBundle | undefined {
  const bundle: TracerfyPropensityBundle = {}
  if (p.sell_propensity_score != null && p.sell_propensity_category) {
    bundle.sell = { score: p.sell_propensity_score, category: p.sell_propensity_category }
  }
  if (p.refi_propensity_score != null && p.refi_propensity_category) {
    bundle.refi = { score: p.refi_propensity_score, category: p.refi_propensity_category }
  }
  if (p.roof_renovate_propensity_score != null && p.roof_renovate_propensity_category) {
    bundle.roof = { score: p.roof_renovate_propensity_score, category: p.roof_renovate_propensity_category }
  }
  if (p.hvac_renovate_propensity_score != null && p.hvac_renovate_propensity_category) {
    bundle.hvac = { score: p.hvac_renovate_propensity_score, category: p.hvac_renovate_propensity_category }
  }
  if (p.solar_renovate_propensity_score != null && p.solar_renovate_propensity_category) {
    bundle.solar = { score: p.solar_renovate_propensity_score, category: p.solar_renovate_propensity_category }
  }
  return Object.keys(bundle).length > 0 ? bundle : undefined
}

function mapProperty(p: TracerfyProperty): PropertyProfilePatch {
  return {
    fillIfNull: {
      yearBuiltExact: nonEmpty(p.year_built),
      beds: nonEmpty(p.beds),
      baths: nonEmpty(p.baths),
      buildingSizeSqft: nonEmpty(p.building_size_sqft),
      lotSizeSqft: nonEmpty(p.lot_size_sqft),
      stories: nonEmpty(p.stories),
      propertyType: nonEmpty(p.property_type),
      roofMaterial: nonEmpty(p.roof_material),
    },
    overwrite: {
      estimatedValue: nonEmpty(p.estimated_value),
      estimatedEquity: nonEmpty(p.estimated_equity),
      equityPercent: nonEmpty(p.equity_percent),
      lastSaleDate: nonEmpty(p.last_sale_date),
      lastSalePrice: nonEmpty(p.last_sale_price),
      yearsOwned: nonEmpty(p.years_owned),
      ownerOccupied: p.owner_occupied,
      absenteeOwner: p.absentee_owner,
      hoa: p.hoa,
      propensityScores: buildPropensityBundle(p),
    },
  }
}

function mapPrimaryPerson(persons: TracerfyPerson[]): CustomerProfilePatch {
  const owner = persons.find(x => x.property_owner) ?? persons[0]
  if (!owner) {
    return { fillIfNull: {}, overwrite: {} }
  }

  return {
    fillIfNull: {
      dob: nonEmpty(owner.dob),
      isPropertyOwner: owner.property_owner,
    },
    overwrite: {
      isDeceased: owner.deceased,
      isLitigator: owner.litigator,
    },
  }
}

function mapFinancial(p: TracerfyProperty): FinancialProfilePatch {
  return {
    overwrite: {
      openMortgageBalance: nonEmpty(p.open_mortgage_balance),
      estimatedMortgagePayment: nonEmpty(p.estimated_mortgage_payment),
      lenderName: nonEmpty(p.lender_name),
    },
  }
}

function mapContacts(response: TracerfyLeadBuilderLookupResponse): ContactSuggestions {
  const phones = (response.contacts?.phones ?? []).map(p => ({
    number: p.number,
    type: p.type,
    dnc: p.dnc,
    rank: p.rank,
  }))
  const emails = (response.contacts?.emails ?? []).map(e => ({
    email: e.email,
    rank: e.rank,
  }))
  const ownerNames = (response.owners ?? []).map(o => ({
    firstName: o.first_name,
    lastName: o.last_name,
  }))
  return { phones, emails, ownerNames }
}

/**
 * Translate a Tracerfy lead-builder lookup hit into sparse domain patches.
 * Throws if `response.hit === false` — callers must check `hit` first.
 */
export function mapLeadBuilderHitToProfileUpdates(
  response: TracerfyLeadBuilderLookupResponse,
): TracerfyTranslated {
  if (!response.hit) {
    throw new Error('mapLeadBuilderHitToProfileUpdates called with hit=false response')
  }

  const property = response.property
  if (!property) {
    throw new Error('Tracerfy hit response missing `property` field')
  }

  return {
    propertyProfile: mapProperty(property),
    // Persons aren't returned in lead-builder/lookup — owner names come
    // from `response.owners` and demographic flags only via /trace/lookup.
    // For v1 we derive minimal CustomerProfilePatch from `response.owners`
    // (just isPropertyOwner). Full person demographics need /trace/lookup.
    customerProfile: response.owners && response.owners.length > 0
      ? { fillIfNull: { isPropertyOwner: true }, overwrite: {} }
      : { fillIfNull: {}, overwrite: {} },
    financialProfile: mapFinancial(property),
    contactSuggestions: mapContacts(response),
  }
}

/**
 * Translate a /trace/lookup/ hit into a CustomerProfilePatch + contacts.
 * Used when we want demographic data (dob, deceased, litigator) that
 * lead-builder/lookup doesn't return.
 */
export function mapTraceLookupHitToCustomerPatch(
  persons: TracerfyPerson[],
): { customerProfile: CustomerProfilePatch, contactSuggestions: ContactSuggestions } {
  const customerProfile = mapPrimaryPerson(persons)
  const phones = persons.flatMap(p => p.phones.map(ph => ({
    number: ph.number,
    type: ph.type,
    dnc: ph.dnc,
    rank: ph.rank,
  })))
  const emails = persons.flatMap(p => p.emails.map(e => ({
    email: e.email,
    rank: e.rank,
  })))
  const ownerNames = persons.map(p => ({ firstName: p.first_name, lastName: p.last_name }))
  return { customerProfile, contactSuggestions: { phones, emails, ownerNames } }
}
```

- [ ] **Step 2: Quick smoke test the translator with a real response**

Extend the smoke-test script to also print the translated output. Edit `scripts/tracerfy/test-lookup.ts` and add after the lookup result print:

```ts
import { mapLeadBuilderHitToProfileUpdates } from '@/shared/services/providers/tracerfy/lib/map-from-tracerfy'
```

And inside `main()`, after the `JSON.stringify(result, null, 2)` line, add:

```ts
  if (result.hit) {
    console.log('\n--- Translated domain patches ---')
    console.log(JSON.stringify(mapLeadBuilderHitToProfileUpdates(result), null, 2))
  }
```

- [ ] **Step 3: Re-run the smoke test**

```bash
pnpm tsx scripts/tracerfy/test-lookup.ts "<known-residential-address>" "<city>" "CA" "<zip>"
```

Expected: previous output PLUS a "Translated domain patches" block showing sparse `propertyProfile`, `financialProfile`, and `contactSuggestions`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc
```

Expected: no errors related to new files.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/tracerfy/lib/map-from-tracerfy.ts scripts/tracerfy/test-lookup.ts
git commit -m "feat(tracerfy): add Tracerfy → domain translator + extend smoke test"
```

---

## Task 7: Extend Zod schemas for new profile fields

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts`

- [ ] **Step 1: Add propensity-score helper schema**

In `src/shared/entities/customers/schemas/index.ts`, after the existing `painSchema` definition and before `customerProfileSchema`, insert:

```ts
const propensityScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  category: z.enum(['Low', 'Medium', 'High']),
})
```

- [ ] **Step 2: Extend `customerProfileSchema`**

Find `export const customerProfileSchema = z.object({ ... }).partial()`. Add these new fields **inside the `z.object({...})` block** (above the closing `}).partial()`), after the existing `age` field:

```ts
  // Tracerfy-sourced
  dob: z.string(), // YYYY-MM-DD
  isPropertyOwner: z.boolean(),
  isDeceased: z.boolean(),
  isLitigator: z.boolean(),
```

`.partial()` already makes them optional — no per-field `.optional()` needed.

- [ ] **Step 3: Extend `propertyProfileSchema`**

Find `export const propertyProfileSchema = z.object({ ... }).partial()`. Add these new fields inside the block, after the existing `insulationLevel` field:

```ts
  // Tracerfy-sourced — coexist with existing enum fields (roofType, yearBuilt range).
  // These are raw/exact values from the data provider.
  yearBuiltExact: z.number().int(),
  beds: z.number().int(),
  baths: z.number(),
  buildingSizeSqft: z.number().int(),
  lotSizeSqft: z.number().int(),
  stories: z.number().int(),
  propertyType: z.string(),
  roofMaterial: z.string(),
  estimatedValue: z.number().int(),
  estimatedEquity: z.number().int(),
  equityPercent: z.number(),
  lastSaleDate: z.string(),
  lastSalePrice: z.number().int(),
  yearsOwned: z.number().int(),
  ownerOccupied: z.boolean(),
  absenteeOwner: z.boolean(),
  propensityScores: z.object({
    sell: propensityScoreSchema.optional(),
    refi: propensityScoreSchema.optional(),
    roof: propensityScoreSchema.optional(),
    hvac: propensityScoreSchema.optional(),
    solar: propensityScoreSchema.optional(),
  }),
```

- [ ] **Step 4: Extend `financialProfileSchema`**

Find `export const financialProfileSchema = z.object({ ... }).partial()`. Add these inside the block:

```ts
  openMortgageBalance: z.number().int(),
  estimatedMortgagePayment: z.number().int(),
  lenderName: z.string(),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc
```

Expected: clean. Existing customer code referencing these schemas should still work because all new fields are optional via `.partial()`.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/customers/schemas/index.ts
git commit -m "feat(customers): extend profile schemas with Tracerfy-sourced fields"
```

---

## Task 8: Add Drizzle columns for raw response + timestamp

**Files:**
- Modify: `src/shared/db/schema/customers.ts`

- [ ] **Step 1: Import the response type at top of file**

In `src/shared/db/schema/customers.ts`, add to existing imports (sort alphabetically per perfectionist eslint rule):

```ts
import type { TracerfyLeadBuilderLookupResponse } from '@/shared/services/providers/tracerfy/types'
```

- [ ] **Step 2: Add the two new columns to the `customers` table definition**

Find `geocodedAt: timestamp('geocoded_at', ...)` line. Right after it, add:

```ts
  // Raw Tracerfy lead-builder lookup response. Retained so mapping can be
  // re-applied without paying for another API call when translator changes.
  tracerfyEnrichmentJSON: jsonb('tracerfy_enrichment_json').$type<TracerfyLeadBuilderLookupResponse>(),
  tracerfyEnrichedAt: timestamp('tracerfy_enriched_at', { mode: 'string', withTimezone: true }),
```

- [ ] **Step 3: Push schema to dev DB**

**CRITICAL:** Use `db:push:dev` — NEVER `db:push` (that's production).

```bash
pnpm db:push:dev
```

Expected: drizzle-kit prompts confirming the two new columns, then applies. Two new nullable columns is non-destructive — no data loss risk.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm tsc
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema/customers.ts
git commit -m "feat(db): add tracerfy_enrichment_json + tracerfy_enriched_at to customers table"
```

---

## Task 9: Create `customer-enrichment.service.ts`

**Files:**
- Create: `src/shared/services/customer-enrichment.service.ts`

- [ ] **Step 1: Read existing service to copy ScopedContext + DAL pattern**

Before writing, read `src/shared/services/contracts.service.ts` (first 80 lines) to confirm the `ScopedContext` import path and the `customerCrud.getById/update` call signature. The reference impl lives at `src/shared/entities/customers/dal/server/crud.ts` (singleton export).

Confirm imports look like:
- `import type { ScopedContext } from '@/shared/dal/server/types'`
- `import { customerCrud } from '@/shared/entities/customers/dal/server/crud'`

If paths differ in the codebase, use the actual paths.

- [ ] **Step 2: Write the service**

Create `src/shared/services/customer-enrichment.service.ts`:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import type {
  CustomerProfile,
  FinancialProfile,
  PropertyProfile,
} from '@/shared/entities/customers/schemas'
import { tracerfyClient } from '@/shared/services/providers/tracerfy/client'
import {
  mapLeadBuilderHitToProfileUpdates,
  type ContactSuggestions,
} from '@/shared/services/providers/tracerfy/lib/map-from-tracerfy'

const RE_ENRICH_COOLDOWN_DAYS = 30

export type EnrichmentStatus =
  | 'enriched'
  | 'skipped-fresh'
  | 'miss'
  | 'invalid-address'

export interface EnrichmentResult {
  status: EnrichmentStatus
  creditsDeducted: number
  contactSuggestions?: ContactSuggestions
}

function isWithinCooldown(enrichedAtIso: string | null | undefined): boolean {
  if (!enrichedAtIso) {
    return false
  }
  const enrichedAt = new Date(enrichedAtIso).getTime()
  if (Number.isNaN(enrichedAt)) {
    return false
  }
  const cutoffMs = RE_ENRICH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - enrichedAt < cutoffMs
}

/**
 * Merge two partial profile objects, applying fill-if-null vs overwrite rules.
 * - `fillIfNull` fields only set when the existing value is null/undefined.
 * - `overwrite` fields always overwrite (when the incoming value is defined).
 */
function mergeProfile<T extends Record<string, unknown>>(
  existing: T | null | undefined,
  patch: { fillIfNull: Partial<T>, overwrite: Partial<T> },
): T {
  const base: Record<string, unknown> = { ...(existing ?? {}) }
  for (const [k, v] of Object.entries(patch.fillIfNull)) {
    if (v !== undefined && (base[k] === undefined || base[k] === null)) {
      base[k] = v
    }
  }
  for (const [k, v] of Object.entries(patch.overwrite)) {
    if (v !== undefined) {
      base[k] = v
    }
  }
  return base as T
}

export async function enrichCustomerFromTracerfy(
  ctx: ScopedContext,
  customerId: string,
  opts: { force?: boolean } = {},
): Promise<EnrichmentResult> {
  const existing = dalVerifySuccess(await customerCrud.getById(ctx, { id: customerId }))
  if (!existing) {
    throw new Error(`Customer ${customerId} not found`)
  }

  const customer = existing as Record<string, unknown>
  const enrichedAt = customer.tracerfyEnrichedAt as string | null | undefined

  if (!opts.force && isWithinCooldown(enrichedAt)) {
    return { status: 'skipped-fresh', creditsDeducted: 0 }
  }

  const address = customer.address as string | null
  const city = customer.city as string | null
  const state = customer.state as string | null
  const zip = customer.zip as string | null

  if (!address || !city || !state) {
    return { status: 'invalid-address', creditsDeducted: 0 }
  }

  const response = await tracerfyClient.leadBuilderLookup({
    address,
    city,
    state,
    zip: zip ?? undefined,
  })

  const nowIso = new Date().toISOString()

  if (!response.hit) {
    // Record the miss so cooldown applies; don't merge any fields.
    dalVerifySuccess(await customerCrud.update(ctx, {
      id: customerId,
      data: {
        tracerfyEnrichmentJSON: response,
        tracerfyEnrichedAt: nowIso,
      } as Record<string, unknown>,
    }))
    return { status: 'miss', creditsDeducted: response.credits_deducted }
  }

  // Hit — translate and merge into profile JSONBs.
  const translated = mapLeadBuilderHitToProfileUpdates(response)

  const nextCustomerProfile = mergeProfile<CustomerProfile>(
    customer.customerProfileJSON as CustomerProfile | null,
    translated.customerProfile,
  )
  const nextPropertyProfile = mergeProfile<PropertyProfile>(
    customer.propertyProfileJSON as PropertyProfile | null,
    translated.propertyProfile,
  )
  const nextFinancialProfile = mergeProfile<FinancialProfile>(
    customer.financialProfileJSON as FinancialProfile | null,
    translated.financialProfile,
  )

  dalVerifySuccess(await customerCrud.update(ctx, {
    id: customerId,
    data: {
      customerProfileJSON: nextCustomerProfile,
      propertyProfileJSON: nextPropertyProfile,
      financialProfileJSON: nextFinancialProfile,
      tracerfyEnrichmentJSON: response,
      tracerfyEnrichedAt: nowIso,
    } as Record<string, unknown>,
  }))

  return {
    status: 'enriched',
    creditsDeducted: response.credits_deducted,
    contactSuggestions: translated.contactSuggestions,
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc
```

Expected: clean. If you hit a type error about `dalVerifySuccess` import path, search the codebase:

```bash
grep -rn "export.*dalVerifySuccess" src/shared/dal/
```

Use the correct path.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/customer-enrichment.service.ts
git commit -m "feat(services): add customer-enrichment.service with Tracerfy backend"
```

---

## Task 10: Service-level smoke test (dev DB)

Validate the full path: load customer → call Tracerfy → merge → persist.

**Files:**
- Modify: `scripts/tracerfy/test-lookup.ts`

- [ ] **Step 1: Add a `--customerId` mode to the smoke test**

Replace the contents of `scripts/tracerfy/test-lookup.ts` with this expanded version (keeps both modes):

```ts
/* eslint-disable no-console */
/**
 * Tracerfy smoke test — two modes.
 *
 * Mode A — raw lookup (no DB):
 *   pnpm tsx scripts/tracerfy/test-lookup.ts "<address>" "<city>" "<state>" "[zip]"
 *
 * Mode B — service-level enrichment (writes to dev DB):
 *   pnpm tsx scripts/tracerfy/test-lookup.ts --customerId <uuid> [--force]
 */
import './../lib/load-env'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { tracerfyClient } from '@/shared/services/providers/tracerfy/client'
import { mapLeadBuilderHitToProfileUpdates } from '@/shared/services/providers/tracerfy/lib/map-from-tracerfy'
import { enrichCustomerFromTracerfy } from '@/shared/services/customer-enrichment.service'

async function runRawLookup(address: string, city: string, state: string, zip?: string) {
  console.log(`\n→ Raw lookup: ${address}, ${city}, ${state}${zip ? ` ${zip}` : ''}\n`)
  const before = await tracerfyClient.getAccountAnalytics()
  console.log(`Credit balance (pre): ${before.balance}`)

  const result = await tracerfyClient.leadBuilderLookup({ address, city, state, zip })
  console.log('\n--- Raw response ---')
  console.log(JSON.stringify(result, null, 2))

  if (result.hit) {
    console.log('\n--- Translated patches ---')
    console.log(JSON.stringify(mapLeadBuilderHitToProfileUpdates(result), null, 2))
  }

  const after = await tracerfyClient.getAccountAnalytics()
  console.log(`\nCredit balance (post): ${after.balance} (Δ ${after.balance - before.balance})`)
}

async function runServiceEnrichment(customerId: string, force: boolean) {
  console.log(`\n→ Service-level enrichCustomerFromTracerfy(${customerId}, force=${force})\n`)
  const before = await tracerfyClient.getAccountAnalytics()
  console.log(`Credit balance (pre): ${before.balance}`)

  const result = await enrichCustomerFromTracerfy(SYSTEM_CONTEXT, customerId, { force })
  console.log('\n--- Result ---')
  console.log(JSON.stringify(result, null, 2))

  const after = await tracerfyClient.getAccountAnalytics()
  console.log(`\nCredit balance (post): ${after.balance} (Δ ${after.balance - before.balance})`)
}

async function main() {
  const args = process.argv.slice(2)
  const customerIdIdx = args.indexOf('--customerId')

  if (customerIdIdx !== -1) {
    const customerId = args[customerIdIdx + 1]
    if (!customerId) {
      console.error('Missing customerId value after --customerId')
      process.exit(1)
    }
    const force = args.includes('--force')
    await runServiceEnrichment(customerId, force)
    return
  }

  const [address, city, state, zip] = args
  if (!address || !city || !state) {
    console.error('Usage:')
    console.error('  Raw: pnpm tsx scripts/tracerfy/test-lookup.ts "<address>" "<city>" "<state>" "[zip]"')
    console.error('  Service: pnpm tsx scripts/tracerfy/test-lookup.ts --customerId <uuid> [--force]')
    process.exit(1)
  }

  await runRawLookup(address, city, state, zip)
}

main().catch((err) => {
  console.error('\n✗ Tracerfy smoke test failed:')
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Pick a real dev-DB customer with a complete address**

Open Drizzle Studio or query the dev DB:

```bash
pnpm tsx -e "
import('./scripts/lib/load-env').then(async () => {
  const { db } = await import('./src/shared/db')
  const { customers } = await import('./src/shared/db/schema/customers')
  const { isNotNull, and } = await import('drizzle-orm')
  const rows = await db.select({ id: customers.id, name: customers.name, address: customers.address, city: customers.city, zip: customers.zip })
    .from(customers)
    .where(and(isNotNull(customers.address), isNotNull(customers.zip)))
    .limit(5)
  console.log(rows)
})
"
```

Pick a `<uuid>` from the output where the address looks like a real residential SoCal property.

- [ ] **Step 3: Run service-level enrichment**

```bash
pnpm tsx scripts/tracerfy/test-lookup.ts --customerId <uuid>
```

Expected on first run: `status: 'enriched'`, `creditsDeducted: 10` (or 5 for non-lead-builder hit / 0 on miss), balance decreased by 10.

- [ ] **Step 4: Run a second time — cooldown should kick in**

```bash
pnpm tsx scripts/tracerfy/test-lookup.ts --customerId <uuid>
```

Expected: `status: 'skipped-fresh'`, `creditsDeducted: 0`, balance unchanged.

- [ ] **Step 5: Run with `--force` — should re-enrich**

```bash
pnpm tsx scripts/tracerfy/test-lookup.ts --customerId <uuid> --force
```

Expected: `status: 'enriched'` again, another 10 credits deducted.

- [ ] **Step 6: Verify DB state**

Inspect the customer row to confirm the JSONB profiles were updated and `tracerfy_enrichment_json` / `tracerfy_enriched_at` are populated:

```bash
pnpm tsx -e "
import('./scripts/lib/load-env').then(async () => {
  const { db } = await import('./src/shared/db')
  const { customers } = await import('./src/shared/db/schema/customers')
  const { eq } = await import('drizzle-orm')
  const [row] = await db.select().from(customers).where(eq(customers.id, '<uuid>')).limit(1)
  console.log('tracerfyEnrichedAt:', row.tracerfyEnrichedAt)
  console.log('propertyProfileJSON:', JSON.stringify(row.propertyProfileJSON, null, 2))
  console.log('financialProfileJSON:', JSON.stringify(row.financialProfileJSON, null, 2))
  console.log('customerProfileJSON:', JSON.stringify(row.customerProfileJSON, null, 2))
  console.log('tracerfyEnrichmentJSON.hit:', (row.tracerfyEnrichmentJSON as any)?.hit)
})
" | replace <uuid> with the actual ID
```

(Replace `<uuid>` manually in the command before running.)

- [ ] **Step 7: Commit the updated script**

```bash
git add scripts/tracerfy/test-lookup.ts
git commit -m "test(tracerfy): add --customerId service-level enrichment smoke mode"
```

---

## Task 11: Add `enrichFromTracerfy` tRPC procedure

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Add imports**

Add these to the existing imports at the top of `src/trpc/routers/customers.router/business.router.ts` (sort alphabetically per `perfectionist/sort-imports`):

```ts
import { buildUserContext } from '@/shared/dal/server/lib/helpers'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { enrichCustomerFromTracerfy } from '@/shared/services/customer-enrichment.service'
```

(`buildUserContext` may already be imported in the file — if so, only add the missing imports.)

- [ ] **Step 2: Add the procedure**

Inside the router-builder return object (the `createTRPCRouter({...})` block in `createCustomerBusinessRouter`), append a new procedure alongside the existing ones (`getAll`, `list`, etc.):

```ts
    enrichFromTracerfy: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        force: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const scopedCtx = buildUserContext(
          ctx.session.user.id,
          ctx.session.user.role,
          customerServerSpec,
        )
        return enrichCustomerFromTracerfy(scopedCtx, input.customerId, { force: input.force })
      }),
```

**Convention check** — this matches the pattern used in `src/trpc/routers/customers.router/index.ts` `submitCustomerAge` procedure (which constructs the same ScopedContext via `buildUserContext`). If the imports above don't resolve, search the codebase with `grep -rn "export.*buildUserContext\|export.*customerServerSpec" src/shared/` to find the actual paths.

- [ ] **Step 3: Type-check + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean. If `pnpm lint` complains about import order, the editor will sort on save — or fix manually per `perfectionist/sort-imports`.

- [ ] **Step 4: Manual tRPC invocation test**

Start the dev server:

```bash
pnpm dev
```

In a separate terminal, hit the procedure via curl OR via the in-app tRPC client. Easiest: log into the dashboard, open browser devtools, run:

```js
// In browser devtools console on a logged-in dashboard page:
await fetch('/api/trpc/customers.business.enrichFromTracerfy?batch=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 0: { json: { customerId: '<uuid>', force: true } } }),
}).then(r => r.json())
```

Expected: `{ result: { data: { json: { status: 'enriched' | 'miss' | 'skipped-fresh' | 'invalid-address', creditsDeducted: ... } } } }`.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/customers.router/business.router.ts
git commit -m "feat(trpc): add customers.business.enrichFromTracerfy mutation"
```

---

## Task 12: Dev-only "Enrich (Tracerfy)" button on customer profile

Adds a one-click test surface inside the agent dashboard so you can validate against real customers without dropping into a terminal.

**Files:**
- Modify: `src/shared/entities/customers/components/profile/customer-profile-overview.tsx` (or the closest customer-profile actions component — read the directory first to pick the best fit)

- [ ] **Step 1: Decide placement**

List the customer profile components:

```bash
ls src/shared/entities/customers/components/profile/
```

Pick the one that already renders action buttons or top-of-card admin tools (likely `customer-hero-header.tsx` or `customer-profile-overview.tsx`). Read the file first to find an existing actions row to extend.

- [ ] **Step 2: Add the button (dev-only gate)**

Insert this snippet in the actions area of the chosen component. Adjust import paths to match the file's existing import style.

```tsx
import { useTRPC } from '@/trpc/helpers'
import { useMutation } from '@tanstack/react-query'

// ... inside the component, where actions are rendered:

const trpc = useTRPC()
const enrichMutation = useMutation(
  trpc.customers.business.enrichFromTracerfy.mutationOptions({
    onSuccess: (result) => {
      console.warn('[tracerfy] enrich result:', result)
      window.alert(`Tracerfy: ${result.status} (credits: ${result.creditsDeducted})`)
    },
    onError: (err) => {
      console.error('[tracerfy] enrich failed:', err)
      window.alert(`Tracerfy enrich failed: ${err.message}`)
    },
  }),
)

// Render this button only in non-production environments.
{process.env.NODE_ENV !== 'production' && (
  <button
    type="button"
    onClick={() => enrichMutation.mutate({ customerId: customer.id, force: true })}
    disabled={enrichMutation.isPending}
    className="rounded border border-dashed border-amber-500 px-2 py-1 text-xs text-amber-700"
  >
    {enrichMutation.isPending ? 'Enriching…' : '🧪 Enrich (Tracerfy)'}
  </button>
)}
```

`customer.id` must reference the customer prop available in the chosen component — adjust accordingly.

- [ ] **Step 3: Type-check + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean.

- [ ] **Step 4: Visual test**

Start dev server (`pnpm dev`), open the dashboard, navigate to a customer profile, confirm the dashed amber button appears. Click it. Watch network tab for the tRPC call. Confirm the alert shows status.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/customers/components/profile/<file-you-edited>.tsx
git commit -m "feat(customers): add dev-only Tracerfy enrich button on customer profile"
```

---

## Task 13: Quality eval on 5+ real customers + final lint/tsc

This is the gate before we declare v1 done. The output informs v2 (data promotion, UI surfacing, RentCast/Trestle fallback).

- [ ] **Step 1: Pick 5–10 real customers across SoCal**

Run the query from Task 10 step 2 with `.limit(10)` to get a sample list. Prefer customers you have ground-truth knowledge about (recent meetings, properties you've visited).

- [ ] **Step 2: Run enrichment on each**

```bash
pnpm tsx scripts/tracerfy/test-lookup.ts --customerId <uuid> --force
```

For each customer, note (in a scratch doc):
- `status` and `creditsDeducted`
- Are property fields (year built, sqft, beds/baths) accurate vs reality?
- Are propensity scores meaningful?
- Are phone/email contacts plausible? Any clearly-wrong numbers?
- Any DNC flags on the primary phone?

- [ ] **Step 3: Document findings in a follow-up note**

Append a brief findings section to the design spec OR write a new `memory/project-tracerfy-quality-eval.md` capturing:
- Sample size
- Hit rate
- Fields with high vs low accuracy
- Recommendations for v2 (which fields to surface in UI, whether to promote phone/email)

- [ ] **Step 4: Run full lint + type-check**

```bash
pnpm lint && pnpm tsc
```

Expected: clean.

- [ ] **Step 5: Final commit (if any docs were added)**

```bash
git add memory/ docs/
git commit -m "docs(tracerfy): v1 quality eval findings"
```

---

## Self-review checklist (the engineer should re-run this before declaring done)

- [ ] All 13 tasks complete; each task ends in a green commit.
- [ ] `pnpm tsc` clean.
- [ ] `pnpm lint` clean.
- [ ] No `db:push` (production) was run; only `db:push:dev`.
- [ ] `business.router.ts` `enrichFromTracerfy` builds ScopedContext via `buildUserContext(ctx.session.user.id, ctx.session.user.role, customerServerSpec)` — no `as any` casts.
- [ ] Provider directory matches canonical shape: `client.ts`, `types.ts`, `constants.ts`, `lib/map-from-tracerfy.ts`.
- [ ] Provider has zero imports from `services/` or `dal/`.
- [ ] Service has zero imports from `@/shared/db` (only DAL).
- [ ] All new Zod fields are optional via `.partial()`.
- [ ] `tracerfyEnrichmentJSON` column is nullable.
- [ ] CASL: agents can call `enrichFromTracerfy` (uses `entity.authedProcedure`).
- [ ] Dev-only button does NOT render in production builds (`NODE_ENV !== 'production'` gate).
- [ ] Smoke script verifies cooldown behavior + force re-enrichment.

## What's intentionally NOT in this plan

These are deferred to a future v2/v3 plan once the quality eval lands:

- Auto-enrich on customer create (QStash job)
- Background sweep for legacy customers
- Promotion of `contactSuggestions.phones[0]` into `customer.phone` (and email)
- "Suggested contacts" UI showing all Tracerfy phones with rank + DNC badges
- Tracerfy autocomplete in address-entry forms
- Batch (`/trace/`, `/lead-builder/execute/`) endpoints
- DNC scrubbing for outbound dial pipelines
- Webhook handler (async batch only)
- `tracerfy-sync.service.ts` (only needed when 2+ domain ops with translation exist)
- RentCast or Trestle integration (only if Tracerfy data quality is insufficient)
