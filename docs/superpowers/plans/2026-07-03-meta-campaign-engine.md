# Meta Campaign Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Campaign-as-code control of the Tri Pros Meta ad account — typed specs in the repo, `pnpm meta sync` diff/apply engine, creatives from `public/funnels/<slug>/ads/`, everything born PAUSED.

**Architecture:** Typed campaign specs (`scripts/meta/campaign-specs/`) are validated with zod, compared against a committed lock file (`scripts/meta/meta.lock.json`) plus live Marketing-API state, and reconciled by a dry-run-default sync CLI. Fingerprint hashing in the lock file (not deep API diffing) decides updates. Spec: `docs/superpowers/specs/2026-07-03-meta-campaign-engine-design.md`.

**Tech Stack:** tsx CLI scripts (existing `scripts/meta/` toolkit: `metaFetch`, `MetaApiError`, `metaEnv`, formatters), zod, Meta Marketing API v23.0, `node:crypto` sha256.

## Global Constraints

- **No test runner in this repo.** Verify every task with `pnpm tsc && pnpm lint` (NEVER `pnpm build`) plus the explicit run-commands given in steps. Pure-logic checks use one-shot `pnpm tsx -e "…"` evals — not committed test files.
- **Work directly on `main`** (user convention). `git add` explicit pathspecs only — unrelated WIP may exist in the worktree.
- **Marketing-API write rules (hard):** every created campaign/ad set/ad gets `status: 'PAUSED'`; updates never include `status`; nothing is ever deleted. Activation is human-only in Ads Manager.
- **Budget ceiling:** Σ `dailyBudgetCents` across all specs ≤ `16_600` ($166/day ≈ $5K/mo). Sync refuses to run past validation otherwise.
- **Graph API version:** single source `META_GRAPH_VERSION` (`v23.0`) from `@/shared/services/providers/meta/constants`.
- **Coding conventions:** named exports only; no file-level constants in component files (N/A here — scripts); helpers in `lib/`; `@/` alias resolves `src/` (works under tsx — see `scripts/verify-long-path.ts` for precedent). Existing `scripts/meta` files import siblings with `.js` extensions (`'./env.js'`) — keep that style.
- **Ad-copy guardrails (from spec):** no pricing, no government/rebate language, no unapproved promises; copy leads to the funnel form.
- Env vars all live in `.env` (Meta section). `metaEnv` loads via `scripts/lib/load-env` (already handles `.env.local` then `.env`).

---

## Phase 0 — Measurement go-live verification (operator gate)

### Task 0: Verify prod measurement loop (Oliver + assistant, no code)

Nothing in Phases 1–3 may be **activated** until this gate passes (building the engine in parallel is fine — it only creates PAUSED objects).

**Checklist:**

- [ ] **Step 1: Vercel prod env vars.** In Vercel dashboard → tri-pros-website → Settings → Environment Variables (Production), confirm: `NEXT_PUBLIC_META_PIXEL_ID=2031257387425754`, `META_DATASET_ID=2031257387425754`, `META_CAPI_TOKEN` present — and `META_TEST_EVENT_CODE` **ABSENT** (`src/shared/config` server-env hard-fails prod boot if it's set). If the `vercel` CLI is linked: `vercel env ls production | grep META`.
- [ ] **Step 2: Browser pixel fires on prod host.** Real browser (NEVER headless/Playwright — Meta BotBlocking silently drops automation beacons) + Meta Pixel Helper extension on `https://kitchens.triprosremodeling.com` → Pixel Helper shows pixel `2031257387425754` firing `PageView`. Repeat on `https://bathrooms.triprosremodeling.com`.
- [ ] **Step 3: Host gate holds.** Open the latest `*.vercel.app` preview URL → Pixel Helper shows NO pixel.
- [ ] **Step 4: Pixel-only smoke without Lead pollution.** On the prod kitchens funnel, answer the first step as **renter** (`ownership='rent'`) — `ViewContent` fires but the renter gate suppresses `Lead` (browser + CAPI). Confirms funnel-step events without teaching the live dataset anything.
- [ ] **Step 5: One deliberate full test lead (dedup + EMQ).** Submit ONE owner-path lead with real-format data, 🧪-marked name, on prod. In Events Manager → dataset `2031257387425754` → the Lead event must show **"Processed from: Browser · Server"** (one merged event = dedup works) and Event Match Quality ≥ 6. This single live-dataset event is the accepted, unavoidable verification cost (prevention-only isolation; per-event deletion impossible).
- [ ] **Step 6: Record the result** in `docs/superpowers/plans/2026-07-03-meta-campaign-engine.md` (check these boxes) and note EMQ score.

---

## Phase 1 — Campaign-as-code engine

### Task 1: Unify Graph version + retire the Equity-era init flow

**Files:**
- Modify: `scripts/meta/lib/client.ts:4`
- Delete: `scripts/meta/setup/initialize-account.ts`
- Modify: `scripts/meta/index.ts:7-12` (command registry)

**Interfaces:**
- Produces: `metaFetch<T>(endpoint, {method?, params?, body?})` (unchanged signature) now on v23.0. All later tasks call it.

- [ ] **Step 1: Point the ads client at the shared version constant.** In `scripts/meta/lib/client.ts` replace lines 1–5 with:

```ts
// scripts/meta/lib/client.ts
import { META_GRAPH_BASE_URL } from '@/shared/services/providers/meta/constants'
import { metaEnv } from './env.js'

const BASE_URL = META_GRAPH_BASE_URL
```

(Delete the local `API_VERSION` const. `META_GRAPH_BASE_URL` already embeds `v23.0`.)

- [ ] **Step 2: Delete the stale init flow.** `git rm scripts/meta/setup/initialize-account.ts`. In `scripts/meta/index.ts` remove the `'init-account'` entry from the `commands` record.

- [ ] **Step 3: Verify.**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

Run: `pnpm meta verify`
Expected: credential smoke test passes (GET-only; proves v23.0 works with the System User token).

- [ ] **Step 4: Commit.**

```bash
git add scripts/meta/lib/client.ts scripts/meta/index.ts
git rm --cached scripts/meta/setup/initialize-account.ts 2>/dev/null || true
git commit -m "chore(meta): ads CLI on shared META_GRAPH_VERSION (v23.0); retire stale init-account flow"
```

### Task 2: Spec types + `defineCampaign` builder

**Files:**
- Create: `scripts/meta/campaign-specs/lib/types.ts`
- Create: `scripts/meta/campaign-specs/lib/define-campaign.ts`

**Interfaces:**
- Produces: `CampaignSpec`, `AdSpec`, `AdSetSpec` types; `defineCampaign(input: CampaignSpecInput): CampaignSpec` (zod-validated, throws on invalid). Consumed by Tasks 3–8.

- [ ] **Step 1: Write `types.ts`.**

```ts
// scripts/meta/campaign-specs/lib/types.ts
import { z } from 'zod'

const specKey = z.string().regex(/^[a-z0-9-]+$/, 'spec keys are kebab-case slugs')

export const adSpecSchema = z.object({
  key: specKey, // stable identity — renaming a key = new ad at Meta
  headline: z.string().min(1).max(255),
  primaryText: z.string().min(1),
  description: z.string().optional(),
  /** Filename inside public/funnels/<funnelSlug>/ads/ — sync skips (warns) if missing on disk. */
  imageFile: z.string().min(1),
  ctaType: z.enum(['LEARN_MORE', 'GET_QUOTE']),
})

export const adSetSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  dailyBudgetCents: z.number().int().positive(),
  ageMin: z.number().int().min(18).max(100),
  ageMax: z.number().int().min(18).max(100),
  /** Maps to promoted_object.custom_event_type — flip LEAD→SCHEDULE to graduate optimization. */
  optimizationEvent: z.enum(['LEAD', 'SCHEDULE']),
  geoZips: z.array(z.string().regex(/^\d{5}$/)).min(1),
})

export const campaignSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  objective: z.literal('OUTCOME_LEADS'),
  funnelSlug: z.enum(['kitchens', 'bathrooms']),
  /** Funnel origin with trailing slash, e.g. https://kitchens.triprosremodeling.com/ */
  landingBaseUrl: z.string().url(),
  adSet: adSetSpecSchema, // v1: exactly one ad set per campaign
  ads: z.array(adSpecSchema).min(1),
}).refine(s => s.adSet.ageMin <= s.adSet.ageMax, { message: 'ageMin must be ≤ ageMax' })

export type AdSpec = z.infer<typeof adSpecSchema>
export type AdSetSpec = z.infer<typeof adSetSpecSchema>
export type CampaignSpec = z.infer<typeof campaignSpecSchema>
export type CampaignSpecInput = z.input<typeof campaignSpecSchema>
```

- [ ] **Step 2: Write `define-campaign.ts`.**

```ts
// scripts/meta/campaign-specs/lib/define-campaign.ts
import type { CampaignSpec, CampaignSpecInput } from './types.js'
import { campaignSpecSchema } from './types.js'

export function defineCampaign(input: CampaignSpecInput): CampaignSpec {
  return campaignSpecSchema.parse(input)
}
```

- [ ] **Step 3: Verify.**

Run: `pnpm tsx -e "import { defineCampaign } from './scripts/meta/campaign-specs/lib/define-campaign.js'; try { defineCampaign({ key: 'BAD KEY' } as never); console.log('FAIL: should have thrown') } catch { console.log('OK: invalid spec rejected') }"`
Expected: `OK: invalid spec rejected`

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 4: Commit.**

```bash
git add scripts/meta/campaign-specs/lib/types.ts scripts/meta/campaign-specs/lib/define-campaign.ts
git commit -m "feat(meta): typed campaign spec schema + defineCampaign builder"
```

### Task 3: Geo transform + budget guardrails

**Files:**
- Create: `scripts/meta/campaign-specs/lib/geo.ts`
- Create: `scripts/meta/campaign-specs/lib/guardrails.ts`

**Interfaces:**
- Produces: `toMetaZips(zips: Iterable<string>): { key: string }[]`; `MAX_TOTAL_DAILY_BUDGET_CENTS = 16_600`; `assertBudgetCeiling(specs: CampaignSpec[]): void` (throws past ceiling). Consumed by Tasks 5, 7, 8.

- [ ] **Step 1: Write `geo.ts`.**

```ts
// scripts/meta/campaign-specs/lib/geo.ts

/** Meta geo_locations.zips entries: { key: 'US:90001' }. */
export function toMetaZips(zips: Iterable<string>): { key: string }[] {
  return [...zips].sort().map(zip => ({ key: `US:${zip}` }))
}
```

(Sorted so fingerprints are order-stable regardless of source iteration order.)

- [ ] **Step 2: Write `guardrails.ts`.**

```ts
// scripts/meta/campaign-specs/lib/guardrails.ts
import type { CampaignSpec } from './types.js'

/** $166/day ≈ $5,000/mo — the hard account ceiling from the design spec. */
export const MAX_TOTAL_DAILY_BUDGET_CENTS = 16_600

export function assertBudgetCeiling(specs: CampaignSpec[]): void {
  const totalCents = specs.reduce((sum, spec) => sum + spec.adSet.dailyBudgetCents, 0)
  if (totalCents > MAX_TOTAL_DAILY_BUDGET_CENTS) {
    throw new Error(
      `Budget ceiling exceeded: specs total $${(totalCents / 100).toFixed(2)}/day, `
      + `ceiling is $${(MAX_TOTAL_DAILY_BUDGET_CENTS / 100).toFixed(2)}/day. Refusing to sync.`,
    )
  }
}
```

- [ ] **Step 3: Verify.**

Run: `pnpm tsx -e "import { toMetaZips } from './scripts/meta/campaign-specs/lib/geo.js'; const r = toMetaZips(new Set(['90210','90001'])); console.log(JSON.stringify(r) === JSON.stringify([{key:'US:90001'},{key:'US:90210'}]) ? 'OK' : 'FAIL: ' + JSON.stringify(r))"`
Expected: `OK`

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 4: Commit.**

```bash
git add scripts/meta/campaign-specs/lib/geo.ts scripts/meta/campaign-specs/lib/guardrails.ts
git commit -m "feat(meta): geo zip transform + hard budget-ceiling guardrail"
```

### Task 4: Kitchens + bathrooms campaign specs + registry

**Files:**
- Create: `scripts/meta/campaign-specs/kitchens.campaign.ts`
- Create: `scripts/meta/campaign-specs/bathrooms.campaign.ts`
- Create: `scripts/meta/campaign-specs/registry.ts`

**Interfaces:**
- Consumes: `defineCampaign`, `SERVICE_AREA_ZIPS` (from `@/shared/constants/company/service-area-zips`, a `ReadonlySet<string>` of 750 ZIPs).
- Produces: `CAMPAIGN_SPECS: CampaignSpec[]` from `registry.ts`. Consumed by Task 8's CLI entry.

- [ ] **Step 1: Write `kitchens.campaign.ts`.**

```ts
// scripts/meta/campaign-specs/kitchens.campaign.ts
import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

export const kitchensCampaign = defineCampaign({
  key: 'kitchens-leads',
  name: 'TPR — Kitchens — Leads',
  objective: 'OUTCOME_LEADS',
  funnelSlug: 'kitchens',
  landingBaseUrl: 'https://kitchens.triprosremodeling.com/',
  adSet: {
    key: 'service-area-35-70',
    name: 'Service-Area ZIPs · 35–70',
    dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
    ageMin: 35,
    ageMax: 70,
    optimizationEvent: 'LEAD', // graduate to 'SCHEDULE' once the CAPI event flows with volume
    geoZips: [...SERVICE_AREA_ZIPS],
  },
  ads: [
    {
      key: 'dream-kitchen-01',
      headline: 'Your Dream Kitchen, Built by Local Pros',
      primaryText:
        'Southern California homeowners: see what your kitchen could become. '
        + 'Tri Pros Remodeling designs and builds kitchens around how your family actually lives — '
        + 'licensed, insured, and local. Answer a few quick questions to book your free in-home design consultation.',
      imageFile: 'dream-kitchen-01.jpg',
      ctaType: 'LEARN_MORE',
    },
    {
      key: 'before-after-01',
      headline: 'Real SoCal Kitchens, Remodeled by Tri Pros',
      primaryText:
        'This is what happens when a licensed local team handles everything — design, permits, build. '
        + 'Your kitchen could be next. Tell us about your project and book a free in-home consultation.',
      imageFile: 'before-after-01.jpg',
      ctaType: 'GET_QUOTE',
    },
  ],
})
```

- [ ] **Step 2: Write `bathrooms.campaign.ts`.**

```ts
// scripts/meta/campaign-specs/bathrooms.campaign.ts
import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

export const bathroomsCampaign = defineCampaign({
  key: 'bathrooms-leads',
  name: 'TPR — Bathrooms — Leads',
  objective: 'OUTCOME_LEADS',
  funnelSlug: 'bathrooms',
  landingBaseUrl: 'https://bathrooms.triprosremodeling.com/',
  adSet: {
    key: 'service-area-35-70',
    name: 'Service-Area ZIPs · 35–70',
    dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
    ageMin: 35,
    ageMax: 70,
    optimizationEvent: 'LEAD',
    geoZips: [...SERVICE_AREA_ZIPS],
  },
  ads: [
    {
      key: 'spa-bathroom-01',
      headline: 'Turn Your Bathroom Into a Retreat',
      primaryText:
        'Outdated tub? Cramped layout? Southern California homeowners trust Tri Pros Remodeling to '
        + 'rebuild bathrooms that feel like a daily upgrade — licensed, insured, and local. '
        + 'Answer a few quick questions to book your free in-home design consultation.',
      imageFile: 'spa-bathroom-01.jpg',
      ctaType: 'LEARN_MORE',
    },
    {
      key: 'before-after-01',
      headline: 'Real SoCal Bathrooms, Remodeled by Tri Pros',
      primaryText:
        'From tired to stunning — design, permits, and build handled by one licensed local team. '
        + 'Your bathroom could be next. Tell us about your project and book a free in-home consultation.',
      imageFile: 'before-after-01.jpg',
      ctaType: 'GET_QUOTE',
    },
  ],
})
```

- [ ] **Step 3: Write `registry.ts`.**

```ts
// scripts/meta/campaign-specs/registry.ts
import type { CampaignSpec } from './lib/types.js'
import { bathroomsCampaign } from './bathrooms.campaign.js'
import { kitchensCampaign } from './kitchens.campaign.js'

export const CAMPAIGN_SPECS: CampaignSpec[] = [kitchensCampaign, bathroomsCampaign]
```

- [ ] **Step 4: Verify.**

Run: `pnpm tsx -e "import { CAMPAIGN_SPECS } from './scripts/meta/campaign-specs/registry.js'; console.log(CAMPAIGN_SPECS.length === 2 && CAMPAIGN_SPECS[0].adSet.geoZips.length === 750 ? 'OK: 2 specs, 750 zips' : 'FAIL')"`
Expected: `OK: 2 specs, 750 zips`

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add scripts/meta/campaign-specs/kitchens.campaign.ts scripts/meta/campaign-specs/bathrooms.campaign.ts scripts/meta/campaign-specs/registry.ts
git commit -m "feat(meta): kitchens + bathrooms campaign specs wired to service-area ZIPs"
```

### Task 5: Env pixel ID + Marketing-API wrappers

**Files:**
- Modify: `scripts/meta/lib/env.ts`
- Create: `scripts/meta/lib/marketing-api.ts`

**Interfaces:**
- Consumes: `metaFetch`, `metaEnv`.
- Produces (all consumed by Task 8/9 apply):
  - `metaEnv.pixelId: string` (new)
  - `fetchAccountState(): Promise<AccountState>` where `AccountState = { campaigns: RemoteObj[], adSets: RemoteObj[], ads: RemoteObj[] }`, `RemoteObj = { id: string, name: string, status: string }`
  - `createCampaign(name: string): Promise<string>` → id
  - `updateCampaignName(id: string, name: string): Promise<void>`
  - `createAdSet(input: AdSetCreateInput): Promise<string>` → id
  - `updateAdSet(id: string, input: AdSetCreateInput): Promise<void>`
  - `uploadAdImage(bytes: Buffer): Promise<string>` → Meta `image_hash`
  - `createLinkAdCreative(input: CreativeInput): Promise<string>` → creative id
  - `createAd(input: { name: string, adSetId: string, creativeId: string }): Promise<string>` → id
  - `setAdCreative(adId: string, creativeId: string): Promise<void>`

- [ ] **Step 1: Add the pixel ID to `env.ts`.** Add `'NEXT_PUBLIC_META_PIXEL_ID'` to the `REQUIRED` array and `pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID as string,` to the `metaEnv` object (with comment `// dataset/pixel — promoted_object for conversion-optimized ad sets`).

- [ ] **Step 2: Write `marketing-api.ts`.**

```ts
// scripts/meta/lib/marketing-api.ts
// Thin typed wrappers over metaFetch for the objects the sync engine manages.
// HARD RULES (design spec): creates are always PAUSED; updates never touch
// status; nothing here can delete. Activation is human-only in Ads Manager.
import { metaFetch } from './client.js'
import { metaEnv } from './env.js'

export interface RemoteObj {
  id: string
  name: string
  status: string
}

export interface AccountState {
  campaigns: RemoteObj[]
  adSets: RemoteObj[]
  ads: RemoteObj[]
}

export async function fetchAccountState(): Promise<AccountState> {
  const fields = { fields: 'id,name,status', limit: 200 }
  const [campaigns, adSets, ads] = await Promise.all([
    metaFetch<{ data: RemoteObj[] }>(`/${metaEnv.adAccountId}/campaigns`, { params: fields }),
    metaFetch<{ data: RemoteObj[] }>(`/${metaEnv.adAccountId}/adsets`, { params: fields }),
    metaFetch<{ data: RemoteObj[] }>(`/${metaEnv.adAccountId}/ads`, { params: fields }),
  ])
  return { campaigns: campaigns.data, adSets: adSets.data, ads: ads.data }
}

export async function createCampaign(name: string): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/campaigns`, {
    method: 'POST',
    body: {
      name,
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
      special_ad_categories: [], // remodeling services ≠ Meta "housing" special category (housing = sale/rental/insurance opportunities)
      is_adset_budget_sharing_enabled: false, // budget lives on the ad set — explicit CBO opt-out
    },
  })
  return res.id
}

export async function updateCampaignName(id: string, name: string): Promise<void> {
  await metaFetch(`/${id}`, { method: 'POST', body: { name } })
}

export interface AdSetCreateInput {
  name: string
  campaignId: string
  dailyBudgetCents: number
  ageMin: number
  ageMax: number
  optimizationEvent: 'LEAD' | 'SCHEDULE'
  metaZips: { key: string }[]
}

function adSetBody(input: AdSetCreateInput) {
  return {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: input.dailyBudgetCents,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS', // optimize on pixel/CAPI conversions, not form fills
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: metaEnv.pixelId, custom_event_type: input.optimizationEvent },
    targeting: {
      geo_locations: { zips: input.metaZips },
      age_min: input.ageMin,
      age_max: input.ageMax,
      // Strict demographic controls: the spec pins 35–70 as a HARD range.
      // (advantage_audience: 1 would demote age to a suggestion Meta can expand past.)
      // If the API rejects with "advantage_audience required" (Meta has been forcing
      // it on some new accounts), surface the error verbatim and decide then.
      targeting_automation: { advantage_audience: 0 },
    },
  }
}

export async function createAdSet(input: AdSetCreateInput): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adsets`, {
    method: 'POST',
    body: { ...adSetBody(input), status: 'PAUSED' },
  })
  return res.id
}

export async function updateAdSet(id: string, input: AdSetCreateInput): Promise<void> {
  // campaign_id is immutable on update — strip it; never send status.
  const { campaign_id: _omit, ...body } = adSetBody(input)
  await metaFetch(`/${id}`, { method: 'POST', body })
}

export async function uploadAdImage(bytes: Buffer): Promise<string> {
  const res = await metaFetch<{ images: Record<string, { hash: string }> }>(
    `/${metaEnv.adAccountId}/adimages`,
    { method: 'POST', body: { bytes: bytes.toString('base64') } },
  )
  const first = Object.values(res.images)[0]
  if (!first?.hash)
    throw new Error('adimages upload returned no image hash')
  return first.hash
}

export interface CreativeInput {
  name: string
  link: string
  headline: string
  primaryText: string
  description?: string
  imageHash: string
  ctaType: 'LEARN_MORE' | 'GET_QUOTE'
}

export async function createLinkAdCreative(input: CreativeInput): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: input.name,
      object_story_spec: {
        page_id: metaEnv.pageId,
        link_data: {
          link: input.link,
          message: input.primaryText,
          name: input.headline,
          ...(input.description ? { description: input.description } : {}),
          image_hash: input.imageHash,
          call_to_action: { type: input.ctaType, value: { link: input.link } },
        },
      },
    },
  })
  return res.id
}

export async function createAd(input: { name: string, adSetId: string, creativeId: string }): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/ads`, {
    method: 'POST',
    body: {
      name: input.name,
      adset_id: input.adSetId,
      creative: { creative_id: input.creativeId },
      status: 'PAUSED',
    },
  })
  return res.id
}

export async function setAdCreative(adId: string, creativeId: string): Promise<void> {
  await metaFetch(`/${adId}`, { method: 'POST', body: { creative: { creative_id: creativeId } } })
}
```

- [ ] **Step 3: Verify.**

Run: `pnpm tsx -e "import { fetchAccountState } from './scripts/meta/lib/marketing-api.js'; fetchAccountState().then(s => console.log('OK:', s.campaigns.length, 'campaigns,', s.adSets.length, 'adsets,', s.ads.length, 'ads'))"`
Expected: `OK: <n> campaigns, <n> adsets, <n> ads` (read-only; counts may be 0 or include old wizard-created objects).

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 4: Commit.**

```bash
git add scripts/meta/lib/env.ts scripts/meta/lib/marketing-api.ts
git commit -m "feat(meta): typed Marketing-API wrappers (PAUSED-only creates, no status updates, no deletes)"
```

### Task 6: Lock file + fingerprints

**Files:**
- Create: `scripts/meta/sync/lock.ts`
- Create: `scripts/meta/sync/fingerprint.ts`

**Interfaces:**
- Produces (consumed by Tasks 7–9):
  - `MetaLock = { campaigns: Record<string, LockEntry>, adSets: Record<string, LockEntry>, ads: Record<string, AdLockEntry>, images: Record<string, string> }` with `LockEntry = { id: string, fp: string }`, `AdLockEntry = { id: string, creativeId: string, fp: string }`. Keys: campaign → `specKey`; adSet → `${campaignKey}/${adSetKey}`; ad → `${campaignKey}/${adKey}`; images → sha256(file bytes) → Meta image_hash.
  - `readLock(): MetaLock` / `writeLock(lock: MetaLock): void` (path `scripts/meta/meta.lock.json`, committed)
  - `sha256Hex(input: Buffer | string): string`
  - `campaignFp(spec: CampaignSpec): string`, `adSetFp(spec: CampaignSpec): string`, `adFp(spec: CampaignSpec, ad: AdSpec, imageSha: string): string`

- [ ] **Step 1: Write `fingerprint.ts`.**

```ts
// scripts/meta/sync/fingerprint.ts
import type { Buffer } from 'node:buffer'
import type { AdSpec, CampaignSpec } from '../campaign-specs/lib/types.js'
import { createHash } from 'node:crypto'
import { buildAdLink } from './ad-link.js'

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function campaignFp(spec: CampaignSpec): string {
  return sha256Hex(JSON.stringify({ name: spec.name, objective: spec.objective }))
}

export function adSetFp(spec: CampaignSpec): string {
  const a = spec.adSet
  return sha256Hex(JSON.stringify({
    name: a.name,
    dailyBudgetCents: a.dailyBudgetCents,
    ageMin: a.ageMin,
    ageMax: a.ageMax,
    optimizationEvent: a.optimizationEvent,
    zips: [...a.geoZips].sort(),
  }))
}

export function adFp(spec: CampaignSpec, ad: AdSpec, imageSha: string): string {
  return sha256Hex(JSON.stringify({
    headline: ad.headline,
    primaryText: ad.primaryText,
    description: ad.description ?? null,
    ctaType: ad.ctaType,
    imageSha,
    link: buildAdLink(spec, ad),
  }))
}
```

- [ ] **Step 2: Write the ad-link helper it references.** Create `scripts/meta/sync/ad-link.ts`:

```ts
// scripts/meta/sync/ad-link.ts
import type { AdSpec, CampaignSpec } from '../campaign-specs/lib/types.js'

/** UTM convention from the design spec — funnels persist these into leadMetaJSON. */
export function buildAdLink(spec: CampaignSpec, ad: AdSpec): string {
  const url = new URL(spec.landingBaseUrl)
  url.searchParams.set('utm_source', 'meta')
  url.searchParams.set('utm_medium', 'paid')
  url.searchParams.set('utm_campaign', spec.key)
  url.searchParams.set('utm_content', ad.key)
  return url.toString()
}
```

- [ ] **Step 3: Write `lock.ts`.**

```ts
// scripts/meta/sync/lock.ts
// terraform-state-lite: maps spec keys → Meta IDs + the fingerprint each object
// was last synced with. Committed to git — the audit trail of what we manage.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export interface LockEntry {
  id: string
  fp: string
}

export interface AdLockEntry extends LockEntry {
  creativeId: string
}

export interface MetaLock {
  campaigns: Record<string, LockEntry>
  adSets: Record<string, LockEntry>
  ads: Record<string, AdLockEntry>
  /** sha256(image file bytes) → Meta image_hash (upload dedup) */
  images: Record<string, string>
}

const LOCK_PATH = join(process.cwd(), 'scripts/meta/meta.lock.json')

const EMPTY: MetaLock = { campaigns: {}, adSets: {}, ads: {}, images: {} }

export function readLock(): MetaLock {
  if (!existsSync(LOCK_PATH))
    return structuredClone(EMPTY)
  return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as MetaLock }
}

export function writeLock(lock: MetaLock): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`)
}
```

- [ ] **Step 4: Verify.**

Run: `pnpm tsx -e "import { readLock } from './scripts/meta/sync/lock.js'; const l = readLock(); console.log(Object.keys(l).sort().join(',') === 'adSets,ads,campaigns,images' ? 'OK: empty lock shape' : 'FAIL')"`
Expected: `OK: empty lock shape`

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add scripts/meta/sync/lock.ts scripts/meta/sync/fingerprint.ts scripts/meta/sync/ad-link.ts
git commit -m "feat(meta): sync lock file + fingerprint hashing + UTM ad-link builder"
```

### Task 7: Diff engine (`computePlan`)

**Files:**
- Create: `scripts/meta/sync/diff.ts`

**Interfaces:**
- Consumes: `CampaignSpec`, `MetaLock`, `AccountState`, fingerprint fns, `sha256Hex`.
- Produces (consumed by Task 8/9):

```ts
export type PlanOp =
  | { op: 'create-campaign', campaignKey: string }
  | { op: 'update-campaign', campaignKey: string, id: string }
  | { op: 'create-adset', campaignKey: string }
  | { op: 'update-adset', campaignKey: string, id: string }
  | { op: 'create-ad', campaignKey: string, adKey: string, imageSha: string }
  | { op: 'refresh-creative', campaignKey: string, adKey: string, adId: string, imageSha: string }
  | { op: 'skip-ad-missing-image', campaignKey: string, adKey: string, imagePath: string }
  | { op: 'orphan', kind: 'campaign' | 'adset' | 'ad', id: string, name: string }

export function computePlan(specs: CampaignSpec[], lock: MetaLock, state: AccountState): PlanOp[]
```

- [ ] **Step 1: Write `diff.ts`.**

```ts
// scripts/meta/sync/diff.ts
import type { AccountState } from '../lib/marketing-api.js'
import type { CampaignSpec } from '../campaign-specs/lib/types.js'
import type { MetaLock } from './lock.js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { adFp, adSetFp, campaignFp, sha256Hex } from './fingerprint.js'

export type PlanOp =
  | { op: 'create-campaign', campaignKey: string }
  | { op: 'update-campaign', campaignKey: string, id: string }
  | { op: 'create-adset', campaignKey: string }
  | { op: 'update-adset', campaignKey: string, id: string }
  | { op: 'create-ad', campaignKey: string, adKey: string, imageSha: string }
  | { op: 'refresh-creative', campaignKey: string, adKey: string, adId: string, imageSha: string }
  | { op: 'skip-ad-missing-image', campaignKey: string, adKey: string, imagePath: string }
  | { op: 'orphan', kind: 'campaign' | 'adset' | 'ad', id: string, name: string }

export function adImagePath(spec: CampaignSpec, imageFile: string): string {
  return join(process.cwd(), 'public/funnels', spec.funnelSlug, 'ads', imageFile)
}

export function computePlan(specs: CampaignSpec[], lock: MetaLock, state: AccountState): PlanOp[] {
  const ops: PlanOp[] = []
  const remoteIds = new Set([
    ...state.campaigns.map(c => c.id),
    ...state.adSets.map(a => a.id),
    ...state.ads.map(a => a.id),
  ])

  for (const spec of specs) {
    // ── campaign ──
    const cLock = lock.campaigns[spec.key]
    if (!cLock || !remoteIds.has(cLock.id))
      ops.push({ op: 'create-campaign', campaignKey: spec.key })
    else if (cLock.fp !== campaignFp(spec))
      ops.push({ op: 'update-campaign', campaignKey: spec.key, id: cLock.id })

    // ── ad set (v1: exactly one per campaign) ──
    const asKey = `${spec.key}/${spec.adSet.key}`
    const asLock = lock.adSets[asKey]
    if (!asLock || !remoteIds.has(asLock.id))
      ops.push({ op: 'create-adset', campaignKey: spec.key })
    else if (asLock.fp !== adSetFp(spec))
      ops.push({ op: 'update-adset', campaignKey: spec.key, id: asLock.id })

    // ── ads ──
    for (const ad of spec.ads) {
      const imagePath = adImagePath(spec, ad.imageFile)
      if (!existsSync(imagePath)) {
        ops.push({ op: 'skip-ad-missing-image', campaignKey: spec.key, adKey: ad.key, imagePath })
        continue
      }
      const imageSha = sha256Hex(readFileSync(imagePath))
      const adLockKey = `${spec.key}/${ad.key}`
      const aLock = lock.ads[adLockKey]
      if (!aLock || !remoteIds.has(aLock.id))
        ops.push({ op: 'create-ad', campaignKey: spec.key, adKey: ad.key, imageSha })
      else if (aLock.fp !== adFp(spec, ad, imageSha))
        ops.push({ op: 'refresh-creative', campaignKey: spec.key, adKey: ad.key, adId: aLock.id, imageSha })
    }
  }

  // ── orphans: live account objects the lock manages… nothing else is ours to touch.
  // Anything in the account that is NOT in the lock AND NOT just created by specs is
  // reported (never modified) so old wizard-era objects stay visible.
  const managedIds = new Set([
    ...Object.values(lock.campaigns).map(e => e.id),
    ...Object.values(lock.adSets).map(e => e.id),
    ...Object.values(lock.ads).map(e => e.id),
  ])
  for (const c of state.campaigns) {
    if (!managedIds.has(c.id))
      ops.push({ op: 'orphan', kind: 'campaign', id: c.id, name: c.name })
  }
  for (const a of state.adSets) {
    if (!managedIds.has(a.id))
      ops.push({ op: 'orphan', kind: 'adset', id: a.id, name: a.name })
  }
  for (const a of state.ads) {
    if (!managedIds.has(a.id))
      ops.push({ op: 'orphan', kind: 'ad', id: a.id, name: a.name })
  }

  return ops
}
```

- [ ] **Step 2: Verify pure-logic behavior (empty lock + empty account → creates + skips).**

Run:
```bash
pnpm tsx -e "
import { computePlan } from './scripts/meta/sync/diff.js'
import { CAMPAIGN_SPECS } from './scripts/meta/campaign-specs/registry.js'
const plan = computePlan(CAMPAIGN_SPECS, { campaigns: {}, adSets: {}, ads: {}, images: {} }, { campaigns: [], adSets: [], ads: [] })
const counts = plan.reduce((m, o) => ({ ...m, [o.op]: (m[o.op] ?? 0) + 1 }), {})
console.log(JSON.stringify(counts))
"
```
Expected: `{"create-campaign":2,"create-adset":2,"skip-ad-missing-image":4}` (no images on disk yet → all 4 ads skip).

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 3: Commit.**

```bash
git add scripts/meta/sync/diff.ts
git commit -m "feat(meta): sync diff engine — lock-fingerprint reconciliation, orphan reporting"
```

### Task 8: Apply engine + sync CLI entry + audit log

**Files:**
- Create: `scripts/meta/sync/apply.ts`
- Create: `scripts/meta/sync/run.ts` (CLI entry)
- Modify: `scripts/meta/index.ts` (register `sync`)
- Modify: `.gitignore` (add `scripts/meta/logs/` and `public/funnels/*/ads/videos/`)

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces: `applyPlan(plan: PlanOp[], specs: CampaignSpec[], lock: MetaLock): Promise<void>` (mutates + persists lock after every successful op; appends JSONL audit lines to `scripts/meta/logs/sync-history.jsonl`). CLI: `pnpm meta sync` (dry-run default) / `pnpm meta sync --apply`.

- [ ] **Step 1: Write `apply.ts`.**

```ts
// scripts/meta/sync/apply.ts
import type { CampaignSpec } from '../campaign-specs/lib/types.js'
import type { MetaLock } from './lock.js'
import type { PlanOp } from './diff.js'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { toMetaZips } from '../campaign-specs/lib/geo.js'
import {
  createAd,
  createAdSet,
  createCampaign,
  createLinkAdCreative,
  setAdCreative,
  updateAdSet,
  updateCampaignName,
  uploadAdImage,
} from '../lib/marketing-api.js'
import { printInfo, printSuccess } from '../lib/formatters.js'
import { buildAdLink } from './ad-link.js'
import { adImagePath } from './diff.js'
import { adFp, adSetFp, campaignFp } from './fingerprint.js'
import { writeLock } from './lock.js'

const AUDIT_PATH = join(process.cwd(), 'scripts/meta/logs/sync-history.jsonl')

function audit(entry: Record<string, unknown>): void {
  mkdirSync(dirname(AUDIT_PATH), { recursive: true })
  appendFileSync(AUDIT_PATH, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
}

function specByKey(specs: CampaignSpec[], key: string): CampaignSpec {
  const spec = specs.find(s => s.key === key)
  if (!spec)
    throw new Error(`No spec for campaign key ${key}`)
  return spec
}

/** Upload image if its sha isn't in the lock yet; returns Meta image_hash. */
async function ensureImage(lock: MetaLock, path: string, imageSha: string): Promise<string> {
  const existing = lock.images[imageSha]
  if (existing)
    return existing
  const hash = await uploadAdImage(readFileSync(path))
  lock.images[imageSha] = hash
  writeLock(lock)
  return hash
}

export async function applyPlan(plan: PlanOp[], specs: CampaignSpec[], lock: MetaLock): Promise<void> {
  // Order matters: campaigns → ad sets → ads (creations reference parent ids).
  const order: Record<PlanOp['op'], number> = {
    'create-campaign': 0,
    'update-campaign': 0,
    'create-adset': 1,
    'update-adset': 1,
    'create-ad': 2,
    'refresh-creative': 2,
    'skip-ad-missing-image': 3,
    'orphan': 3,
  }
  const sorted = [...plan].sort((a, b) => order[a.op] - order[b.op])

  for (const op of sorted) {
    if (op.op === 'skip-ad-missing-image' || op.op === 'orphan')
      continue // reported by the printer; never acted on here

    const spec = specByKey(specs, op.campaignKey)

    if (op.op === 'create-campaign') {
      const id = await createCampaign(spec.name)
      lock.campaigns[spec.key] = { id, fp: campaignFp(spec) }
      writeLock(lock)
      printSuccess(`campaign created (PAUSED): ${spec.name} → ${id}`)
      audit({ op: op.op, key: spec.key, id })
      continue
    }

    if (op.op === 'update-campaign') {
      await updateCampaignName(op.id, spec.name)
      lock.campaigns[spec.key] = { id: op.id, fp: campaignFp(spec) }
      writeLock(lock)
      printSuccess(`campaign updated: ${spec.name}`)
      audit({ op: op.op, key: spec.key, id: op.id })
      continue
    }

    const adSetInput = {
      name: spec.adSet.name,
      campaignId: lock.campaigns[spec.key]?.id ?? '',
      dailyBudgetCents: spec.adSet.dailyBudgetCents,
      ageMin: spec.adSet.ageMin,
      ageMax: spec.adSet.ageMax,
      optimizationEvent: spec.adSet.optimizationEvent,
      metaZips: toMetaZips(spec.adSet.geoZips),
    }
    const asKey = `${spec.key}/${spec.adSet.key}`

    if (op.op === 'create-adset') {
      if (!adSetInput.campaignId)
        throw new Error(`Cannot create ad set for ${spec.key}: campaign id missing from lock`)
      const id = await createAdSet(adSetInput)
      lock.adSets[asKey] = { id, fp: adSetFp(spec) }
      writeLock(lock)
      printSuccess(`ad set created (PAUSED): ${spec.adSet.name} → ${id}`)
      audit({ op: op.op, key: asKey, id })
      continue
    }

    if (op.op === 'update-adset') {
      await updateAdSet(op.id, adSetInput)
      lock.adSets[asKey] = { id: op.id, fp: adSetFp(spec) }
      writeLock(lock)
      printSuccess(`ad set updated: ${spec.adSet.name}`)
      audit({ op: op.op, key: asKey, id: op.id })
      continue
    }

    // create-ad | refresh-creative
    const ad = spec.ads.find(a => a.key === op.adKey)
    if (!ad)
      throw new Error(`No ad spec ${op.adKey} in campaign ${spec.key}`)
    const imagePath = adImagePath(spec, ad.imageFile)
    const imageHash = await ensureImage(lock, imagePath, op.imageSha)
    const creativeId = await createLinkAdCreative({
      name: `${spec.key}/${ad.key}`,
      link: buildAdLink(spec, ad),
      headline: ad.headline,
      primaryText: ad.primaryText,
      description: ad.description,
      imageHash,
      ctaType: ad.ctaType,
    })
    const adLockKey = `${spec.key}/${ad.key}`

    if (op.op === 'create-ad') {
      const adSetId = lock.adSets[asKey]?.id
      if (!adSetId)
        throw new Error(`Cannot create ad ${adLockKey}: ad set id missing from lock`)
      const id = await createAd({ name: `${spec.key} — ${ad.key}`, adSetId, creativeId })
      lock.ads[adLockKey] = { id, creativeId, fp: adFp(spec, ad, op.imageSha) }
      writeLock(lock)
      printSuccess(`ad created (PAUSED): ${adLockKey} → ${id}`)
      audit({ op: op.op, key: adLockKey, id, creativeId })
    }
    else {
      await setAdCreative(op.adId, creativeId)
      lock.ads[adLockKey] = { id: op.adId, creativeId, fp: adFp(spec, ad, op.imageSha) }
      writeLock(lock)
      printSuccess(`creative refreshed: ${adLockKey}`)
      audit({ op: op.op, key: adLockKey, id: op.adId, creativeId })
    }
  }
  printInfo('Apply complete. Lock file updated — commit scripts/meta/meta.lock.json.')
}
```

- [ ] **Step 2: Write `run.ts` (CLI entry, dry-run default).**

```ts
// scripts/meta/sync/run.ts
// Campaign-as-code sync. DRY-RUN BY DEFAULT — prints the plan and exits.
// `--apply` executes. Never activates, never deletes; see design spec.
import process from 'node:process'
import { CAMPAIGN_SPECS } from '../campaign-specs/registry.js'
import { assertBudgetCeiling } from '../campaign-specs/lib/guardrails.js'
import { fetchAccountState } from '../lib/marketing-api.js'
import { printError, printInfo } from '../lib/formatters.js'
import { applyPlan } from './apply.js'
import { computePlan } from './diff.js'
import { readLock } from './lock.js'

const OP_LABEL: Record<string, string> = {
  'create-campaign': '+ create campaign',
  'update-campaign': '~ update campaign',
  'create-adset': '+ create ad set',
  'update-adset': '~ update ad set',
  'create-ad': '+ create ad (PAUSED)',
  'refresh-creative': '~ refresh creative',
  'skip-ad-missing-image': '⚠ skip ad (image missing)',
  'orphan': '⏸ unmanaged (reported only)',
}

async function main() {
  const apply = process.argv.includes('--apply')

  assertBudgetCeiling(CAMPAIGN_SPECS) // hard guardrail — throws before any API call

  printInfo(`Loaded ${CAMPAIGN_SPECS.length} campaign specs. Fetching account state…`)
  const lock = readLock()
  const state = await fetchAccountState()
  const plan = computePlan(CAMPAIGN_SPECS, lock, state)

  if (plan.length === 0) {
    printInfo('In sync — nothing to do.')
    return
  }

  console.log('\nPlan:')
  for (const op of plan) {
    const detail = 'adKey' in op
      ? `${op.campaignKey}/${op.adKey}`
      : 'campaignKey' in op
        ? op.campaignKey
        : `${op.kind} ${op.name} (${op.id})`
    console.log(`  ${OP_LABEL[op.op]}  ${detail}${'imagePath' in op ? `\n      missing: ${op.imagePath}` : ''}`)
  }

  const actionable = plan.filter(op => op.op !== 'orphan' && op.op !== 'skip-ad-missing-image')
  if (!apply) {
    printInfo(`Dry run — ${actionable.length} actionable op(s). Re-run with --apply to execute.`)
    return
  }
  if (actionable.length === 0) {
    printInfo('Nothing actionable to apply.')
    return
  }
  await applyPlan(plan, CAMPAIGN_SPECS, lock)
}

main().catch((err) => {
  printError(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
```

- [ ] **Step 3: Register the command.** In `scripts/meta/index.ts`, add to `commands`:

```ts
'sync': { file: 'scripts/meta/sync/run.ts', description: 'Campaign-as-code: diff specs vs Meta (dry-run default; --apply executes)' },
```

- [ ] **Step 4: Gitignore log dir + creative videos.** Append to `.gitignore`:

```gitignore
# Meta sync audit log (committed lock file lives at scripts/meta/meta.lock.json)
scripts/meta/logs/
# Ad creative videos — uploaded to Meta from disk, never served/deployed
public/funnels/*/ads/videos/
```

- [ ] **Step 5: Verify dry run end-to-end (read-only).**

Run: `pnpm meta sync`
Expected output shape:

```
ℹ️   Loaded 2 campaign specs. Fetching account state…

Plan:
  + create campaign  kitchens-leads
  + create ad set  kitchens-leads
  ⚠ skip ad (image missing)  kitchens-leads/dream-kitchen-01
      missing: …/public/funnels/kitchens/ads/dream-kitchen-01.jpg
  … (bathrooms mirror) …
  ⏸ unmanaged (reported only)  campaign Tri Pros - SoCal Homeowners - … (…)

ℹ️   Dry run — 4 actionable op(s). Re-run with --apply to execute.
```

(Orphan lines appear for any old wizard-era objects — expected and untouched.)

Run: `pnpm tsc && pnpm lint`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```bash
git add scripts/meta/sync/apply.ts scripts/meta/sync/run.ts scripts/meta/index.ts .gitignore
git commit -m "feat(meta): pnpm meta sync — dry-run-default apply engine with lock + JSONL audit"
```

---

## Phase 2 — Creatives on disk + first real apply

### Task 9: Creative images + structure apply (operator-assisted)

**Files:**
- Create: `public/funnels/kitchens/ads/dream-kitchen-01.jpg`, `public/funnels/kitchens/ads/before-after-01.jpg` (from Oliver / portfolio)
- Create: `public/funnels/bathrooms/ads/spa-bathroom-01.jpg`, `public/funnels/bathrooms/ads/before-after-01.jpg`
- Create (generated by apply): `scripts/meta/meta.lock.json`

**Interfaces:**
- Consumes: the full sync CLI from Task 8.
- Produces: live (PAUSED) campaign structure at Meta + committed lock file.

- [ ] **Step 1: Oliver drops 4 images.** High-res JPG/PNG, ≥1080px wide (1200×628 or 1080×1080), real Tri Pros project photos (before/after composites where named so). NOT the compressed funnel webps. Place at the exact paths above.
- [ ] **Step 2: Dry run confirms ads unskipped.** Run `pnpm meta sync` — the 4 `skip-ad-missing-image` lines become `+ create ad (PAUSED)`.
- [ ] **Step 3: Apply.** Run `pnpm meta sync --apply`. Expected: 2 campaigns, 2 ad sets, 4 image uploads, 4 creatives, 4 ads — all PAUSED, ids printed, lock file written.
- [ ] **Step 4: Verify in Ads Manager** (`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1552723459154642`): structure matches spec exactly; every object PAUSED; ad previews render image + copy; ad links carry `utm_source=meta&utm_medium=paid&utm_campaign=<key>&utm_content=<adKey>`.
- [ ] **Step 5: Idempotency check.** Run `pnpm meta sync` again → `In sync — nothing to do.` (plus orphan report lines).
- [ ] **Step 6: Commit assets + lock.**

```bash
git add public/funnels/kitchens/ads/*.jpg public/funnels/bathrooms/ads/*.jpg scripts/meta/meta.lock.json
git commit -m "feat(meta): launch creatives + first synced campaign structure (all PAUSED)"
```

---

## Phase 3 — Docs, memory, launch runbook

### Task 10: DOCS.md + supersession banner + memory

**Files:**
- Create: `scripts/meta/DOCS.md`
- Modify: `docs/plans/meta-ads-compound-intelligence.md` (top-of-file banner)
- Modify: memory `project-meta-ads-strategy.md` + `MEMORY.md` (assistant memory dir)

- [ ] **Step 1: Write `scripts/meta/DOCS.md`** covering (slug-anchored sections): `#campaign-as-code` (specs are the source of truth; Ads Manager edits to managed objects get overwritten on next apply — except `status`, which sync never touches), `#hard-guardrails` (PAUSED creates / no status updates / no deletes / $166-per-day ceiling / activation human-only), `#lock-file` (committed; treat conflicts by re-running sync — it self-heals from fingerprints), `#optimization-ladder` (LEAD now; flip `optimizationEvent: 'SCHEDULE'` per ad set when the CAPI Schedule event flows with ~50 conv/week volume).
- [ ] **Step 2: Banner the superseded plan.** At the top of `docs/plans/meta-ads-compound-intelligence.md` add:

```markdown
> ⚠️ **PARTIALLY SUPERSEDED (2026-07-03).** Campaign architecture, programs
> (Equity Reset / StormGuard), landing pages, and creative-engine sections are
> superseded by `docs/superpowers/specs/2026-07-03-meta-campaign-engine-design.md`
> (campaign-as-code for the live kitchens/bathrooms funnels). Guardrail tiers,
> KPI ranking, and budget projections remain valid reference.
```

- [ ] **Step 3: Update assistant memory** (`project-meta-ads-strategy.md`: as-built campaign structure + engine pointer; `MEMORY.md` index line).
- [ ] **Step 4: Commit repo files** (memory files live outside the repo — no git):

```bash
git add scripts/meta/DOCS.md docs/plans/meta-ads-compound-intelligence.md
git commit -m "docs(meta): campaign-engine DOCS.md + supersede stale compound-intelligence sections"
```

### Launch runbook (operator — Oliver + assistant, after Task 0 gate passes)

1. `pnpm meta sync` → confirm `In sync`.
2. Review both campaigns end-to-end in Ads Manager (copy, image, link, ZIP targeting count ≈750, age 35–70, $58/day each).
3. **Oliver activates** campaigns/ad sets/ads in Ads Manager (the engine never will).
4. Day 1–3: `pnpm meta performance today` daily; watch Events Manager for Lead events attributed to the campaigns; spot-check new CRM leads carry `utm_campaign=kitchens-leads|bathrooms-leads` in `leadMetaJSON`.
5. Schedule CAPI slice (separate plan from `docs/plans/meta-capi-phase2-handoff.md`, `Schedule` promoted first per spec) ships as fast-follow; graduation = edit `optimizationEvent` to `'SCHEDULE'` in the spec + `pnpm meta sync --apply`.

---

## Self-review notes (done at plan-writing time)

- **Spec coverage:** Phase 0 → Task 0; version bump + retire init → Task 1; engine → Tasks 2–8; creatives → Task 9; docs/supersession → Task 10; launch → runbook. `Schedule` CAPI slice is deliberately a **separate plan** (per spec's companion-handoff and scope-check).
- **Type consistency:** `PlanOp` shape identical in Tasks 7/8; `AdSetCreateInput` produced in Task 5 = consumed in Task 8; lock shapes from Task 6 used verbatim in 7/8.
- **Known risk, surfaced not hidden:** Meta may force `advantage_audience: 1` on new ad sets for some accounts — the wrapper comments the fallback decision point; the error surfaces verbatim (`MetaApiError`).
