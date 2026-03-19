# Meta Ads Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Meta Marketing API integration living in `scripts/meta/` that lets Claude execute campaign creation, performance reporting, and ad management via a custom Claude skill.

**Architecture:** All writes and reads go through the official Meta Marketing API (`https://graph.facebook.com/v21.0/`). Playwright MCP provides visual confirmation by opening Ads Manager after mutating operations. Credentials are loaded exclusively from `.env.meta` — never from the Next.js `.env` — so the app and the scripts are fully isolated.

**Tech Stack:** TypeScript + `tsx` (runtime), `dotenv` (env loading), `@inquirer/prompts` (interactive wizards), `fetch` (HTTP), Playwright MCP (browser confirmation). Zero new dependencies required — all already installed.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `scripts/meta/lib/env.ts` | Load + validate `.env.meta`; export typed `metaEnv` object; fail fast with clear message if any var missing |
| Create | `scripts/meta/lib/client.ts` | Typed `metaFetch(path, options)` wrapper — injects access token, sets API version, throws `MetaApiError` on non-2xx |
| Create | `scripts/meta/lib/types.ts` | TypeScript interfaces for Campaign, AdSet, Ad, Insight, ApiError |
| Create | `scripts/meta/lib/formatters.ts` | `printTable()`, `printSuccess()`, `printError()`, `printJson()` — terminal output helpers |
| Create | `scripts/meta/setup/verify-credentials.ts` | Smoke test: calls `/me` + `/act_{id}/campaigns` and prints confirmation or clear error for each credential |
| Create | `scripts/meta/reports/pull-performance.ts` | Fetches active campaigns with 7-day insights; prints formatted table of spend, impressions, clicks, CPM, CPC |
| Create | `scripts/meta/ads/manage-ad.ts` | Interactive: lists ads → user picks one → pause/activate/swap-status; opens Playwright to confirm in Ads Manager |
| Create | `scripts/meta/campaigns/create-campaign.ts` | Interactive wizard: collects campaign name, objective, daily budget, schedule, targeting, ad copy → creates campaign → ad set → ad via API; opens Playwright to confirm |
| Create | `scripts/meta/index.ts` | CLI dispatcher — routes `pnpm meta <command>` to the right script |
| Modify | `package.json` | Add `"meta": "tsx scripts/meta/index.ts"` to scripts |
| Create | `.claude/skills/meta-ads.md` | Custom Claude skill teaching me the `pnpm meta` interface so users can say "pull performance" and I know what to run |

---

## Task 1: Env loader (`scripts/meta/lib/env.ts`)

**Files:**
- Create: `scripts/meta/lib/env.ts`

- [ ] **Step 1: Create the env loader**

```typescript
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.meta from project root — NOT .env
config({ path: path.resolve(__dirname, '..', '..', '..', '.env.meta') })

const REQUIRED = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_ACCESS_TOKEN',
  'META_AD_ACCOUNT_ID',
  'META_PAGE_ID',
] as const

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌  Missing required env var: ${key}`)
    console.error(`    Add it to .env.meta at the project root.`)
    process.exit(1)
  }
}

export const metaEnv = {
  appId: process.env.META_APP_ID as string,
  appSecret: process.env.META_APP_SECRET as string,
  accessToken: process.env.META_ACCESS_TOKEN as string,
  adAccountId: process.env.META_AD_ACCOUNT_ID as string, // already act_ prefixed
  pageId: process.env.META_PAGE_ID as string,
} satisfies Record<string, string>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/meta/lib/env.ts
git commit -m "feat(meta): add env loader for .env.meta credentials"
```

---

## Task 2: API client + types + formatters (`scripts/meta/lib/`)

**Files:**
- Create: `scripts/meta/lib/types.ts`
- Create: `scripts/meta/lib/client.ts`
- Create: `scripts/meta/lib/formatters.ts`

- [ ] **Step 1: Create types**

```typescript
// scripts/meta/lib/types.ts

export interface MetaApiError {
  error: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

export interface Campaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
}

export interface AdSet {
  id: string
  name: string
  campaign_id: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  daily_budget: string
  targeting: Record<string, unknown>
  start_time: string
}

export interface Ad {
  id: string
  name: string
  adset_id: string
  campaign_id: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  created_time: string
}

export interface Insight {
  campaign_id: string
  campaign_name: string
  spend: string
  impressions: string
  clicks: string
  cpm: string
  cpc: string
  date_start: string
  date_stop: string
}

export interface MetaPaginatedResponse<T> {
  data: T[]
  paging?: {
    cursors?: { before: string; after: string }
    next?: string
  }
}
```

- [ ] **Step 2: Create API client**

```typescript
// scripts/meta/lib/client.ts
import { metaEnv } from './env.js'

const API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

interface MetaErrorShape {
  message: string
  type: string
  code: number
  fbtrace_id: string
}

export class MetaApiError extends Error {
  constructor(
    public code: number,
    public type: string,
    message: string,
    public fbtrace_id: string,
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  params?: Record<string, string | number | boolean>
  body?: Record<string, unknown>
}

export async function metaFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', params = {}, body } = options

  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('access_token', metaEnv.accessToken)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json() as T | { error: MetaErrorShape }

  if (!res.ok || 'error' in (json as object)) {
    const err = (json as { error: MetaErrorShape }).error
    throw new MetaApiError(err.code, err.type, err.message, err.fbtrace_id)
  }

  return json as T
}
```

- [ ] **Step 3: Create formatters**

```typescript
// scripts/meta/lib/formatters.ts

export function printSuccess(message: string): void {
  console.log(`\n✅  ${message}`)
}

export function printError(message: string): void {
  console.error(`\n❌  ${message}`)
}

export function printInfo(message: string): void {
  console.log(`\nℹ️   ${message}`)
}

export function printTable(rows: Record<string, string | number>[]): void {
  if (rows.length === 0) {
    console.log('  (no data)')
    return
  }
  const keys = Object.keys(rows[0])
  const widths = keys.map(k =>
    Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)),
  )
  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  │  ')
  const divider = widths.map(w => '─'.repeat(w)).join('──┼──')
  console.log(`\n  ${header}`)
  console.log(`  ${divider}`)
  for (const row of rows) {
    console.log(`  ${keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i])).join('  │  ')}`)
  }
  console.log()
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/meta/lib/
git commit -m "feat(meta): add API client, types, and terminal formatters"
```

---

## Task 3: Verify credentials (`scripts/meta/setup/verify-credentials.ts`)

**Files:**
- Create: `scripts/meta/setup/verify-credentials.ts`

- [ ] **Step 1: Create the script**

```typescript
// scripts/meta/setup/verify-credentials.ts
import { metaEnv } from '../lib/env.js'
import { metaFetch } from '../lib/client.js'
import { printSuccess, printError, printInfo } from '../lib/formatters.js'

interface MeResponse {
  id: string
  name: string
}

interface CampaignsResponse {
  data: { id: string; name: string }[]
}

async function main() {
  console.log('\n🔍  Verifying Meta credentials...\n')

  // 1. Verify access token
  try {
    const me = await metaFetch<MeResponse>('/me', { params: { fields: 'id,name' } })
    printSuccess(`Access token valid — authenticated as: ${me.name} (${me.id})`)
  }
  catch (err) {
    printError(`Access token invalid: ${(err as Error).message}`)
    process.exit(1)
  }

  // 2. Verify ad account access
  try {
    const campaigns = await metaFetch<CampaignsResponse>(`/${metaEnv.adAccountId}/campaigns`, {
      params: { limit: 1 },
    })
    printSuccess(`Ad account accessible — ${metaEnv.adAccountId} (${campaigns.data.length > 0 ? `found ${campaigns.data[0].name}` : 'no campaigns yet'})`)
  }
  catch (err) {
    printError(`Ad account access failed: ${(err as Error).message}`)
    process.exit(1)
  }

  // 3. Verify page access
  try {
    const page = await metaFetch<MeResponse>(`/${metaEnv.pageId}`, { params: { fields: 'id,name' } })
    printSuccess(`Page accessible — ${page.name} (${page.id})`)
  }
  catch (err) {
    printError(`Page access failed: ${(err as Error).message}`)
    process.exit(1)
  }

  printInfo('All credentials verified. Ready to run meta scripts.')
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Run it to verify credentials work**

```bash
pnpm tsx scripts/meta/setup/verify-credentials.ts
```

Expected output:
```
✅  Access token valid — authenticated as: [your name]
✅  Ad account accessible — act_910648081744451
✅  Page accessible — Tri Pros Remodeling
ℹ️   All credentials verified. Ready to run meta scripts.
```

If any step fails, check `.env.meta` and fix before proceeding.

- [ ] **Step 3: Commit**

```bash
git add scripts/meta/setup/verify-credentials.ts
git commit -m "feat(meta): add verify-credentials smoke test"
```

---

## Task 4: Pull performance report (`scripts/meta/reports/pull-performance.ts`)

**Files:**
- Create: `scripts/meta/reports/pull-performance.ts`

- [ ] **Step 1: Create the script**

```typescript
// scripts/meta/reports/pull-performance.ts
import { metaEnv } from '../lib/env.js'
import { metaFetch } from '../lib/client.js'
import { printTable, printInfo, printError } from '../lib/formatters.js'
import type { Insight, MetaPaginatedResponse } from '../lib/types.js'

const DATE_PRESET = process.argv[2] ?? 'last_7d'
// Supported: today, yesterday, last_7d, last_14d, last_28d, last_30d, last_month, this_month

async function main() {
  printInfo(`Fetching campaign performance (${DATE_PRESET})...`)

  const res = await metaFetch<MetaPaginatedResponse<Insight>>(
    `/${metaEnv.adAccountId}/insights`,
    {
      params: {
        level: 'campaign',
        date_preset: DATE_PRESET,
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,cpm,cpc',
        limit: 50,
      },
    },
  )

  if (res.data.length === 0) {
    printInfo('No campaign data found for this period.')
    return
  }

  printTable(
    res.data.map(row => ({
      Campaign: row.campaign_name,
      Spend: `$${Number(row.spend).toFixed(2)}`,
      Impressions: Number(row.impressions).toLocaleString(),
      Clicks: row.clicks,
      CPM: `$${Number(row.cpm).toFixed(2)}`,
      CPC: `$${Number(row.cpc).toFixed(2)}`,
    })),
  )
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Run it**

```bash
pnpm tsx scripts/meta/reports/pull-performance.ts last_7d
```

Expected: a formatted table of campaigns with spend/impressions/clicks/CPM/CPC. If account has no spend data, "No campaign data found" is correct.

- [ ] **Step 3: Commit**

```bash
git add scripts/meta/reports/pull-performance.ts
git commit -m "feat(meta): add pull-performance report script"
```

---

## Task 5: Manage ad (`scripts/meta/ads/manage-ad.ts`)

**Files:**
- Create: `scripts/meta/ads/manage-ad.ts`

- [ ] **Step 1: Create the script**

```typescript
// scripts/meta/ads/manage-ad.ts
import { select } from '@inquirer/prompts'
import { metaEnv } from '../lib/env.js'
import { metaFetch } from '../lib/client.js'
import { printSuccess, printError, printInfo } from '../lib/formatters.js'
import type { Ad, MetaPaginatedResponse } from '../lib/types.js'

async function main() {
  printInfo('Fetching ads from your account...')

  const res = await metaFetch<MetaPaginatedResponse<Ad>>(
    `/${metaEnv.adAccountId}/ads`,
    {
      params: {
        fields: 'id,name,status,adset_id,campaign_id',
        limit: 50,
      },
    },
  )

  if (res.data.length === 0) {
    printInfo('No ads found in this account.')
    return
  }

  const adId = await select({
    message: 'Select an ad to manage:',
    choices: res.data.map(ad => ({
      value: ad.id,
      name: `${ad.name} [${ad.status}] (${ad.id})`,
    })),
  })

  const action = await select({
    message: 'What do you want to do?',
    choices: [
      { value: 'ACTIVE', name: '▶  Activate this ad' },
      { value: 'PAUSED', name: '⏸  Pause this ad' },
    ],
  })

  await metaFetch<{ success: boolean }>(`/${adId}`, {
    method: 'POST',
    body: { status: action },
  })

  const label = action === 'ACTIVE' ? 'activated' : 'paused'
  printSuccess(`Ad ${adId} ${label} successfully.`)
  printInfo(`Opening Ads Manager to confirm — check the browser window.`)

  // Playwright visual confirmation hint (Claude will open browser via MCP after this runs)
  console.log(`\n  ADS MANAGER URL: https://adsmanager.facebook.com/adsmanager/manage/ads?act=${metaEnv.adAccountId.replace('act_', '')}`)
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Run it (interactive)**

```bash
pnpm tsx scripts/meta/ads/manage-ad.ts
```

Expected: interactive prompt listing your ads. Select one and choose to pause or activate. Confirm in Ads Manager URL printed at the end.

- [ ] **Step 3: Commit**

```bash
git add scripts/meta/ads/manage-ad.ts
git commit -m "feat(meta): add interactive manage-ad script (pause/activate)"
```

---

## Task 6: Create campaign wizard (`scripts/meta/campaigns/create-campaign.ts`)

**Files:**
- Create: `scripts/meta/campaigns/create-campaign.ts`

This is the most complex script — it walks through a multi-step wizard to create a full Campaign → Ad Set → Ad chain.

- [ ] **Step 1: Create the script**

```typescript
// scripts/meta/campaigns/create-campaign.ts
import { input, select, number } from '@inquirer/prompts'
import { metaEnv } from '../lib/env.js'
import { metaFetch } from '../lib/client.js'
import { printSuccess, printError, printInfo } from '../lib/formatters.js'

const OBJECTIVES = [
  { value: 'OUTCOME_LEADS', name: 'Lead Generation — collect contact info (recommended for Tri Pros)' },
  { value: 'OUTCOME_AWARENESS', name: 'Awareness — maximize reach and brand visibility' },
  { value: 'OUTCOME_TRAFFIC', name: 'Traffic — drive clicks to your website' },
  { value: 'OUTCOME_ENGAGEMENT', name: 'Engagement — boost post likes, comments, shares' },
] as const

async function main() {
  console.log('\n🚀  Meta Campaign Creator — Tri Pros Remodeling\n')

  // ── Step 1: Campaign ──────────────────────────────────────────────
  const campaignName = await input({
    message: 'Campaign name:',
    default: `Tri Pros — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
  })

  const objective = await select({
    message: 'Campaign objective:',
    choices: OBJECTIVES,
  })

  const dailyBudgetDollars = (await number({
    message: 'Daily budget (USD):',
    default: 50,
    min: 1,
    required: true,
  })) as number

  printInfo('Creating campaign...')
  const campaign = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/campaigns`, {
    method: 'POST',
    body: {
      name: campaignName,
      objective,
      status: 'PAUSED', // Always start paused — activate manually after review
      special_ad_categories: [],
    },
  })
  printSuccess(`Campaign created: ${campaign.id}`)

  // ── Step 2: Ad Set ────────────────────────────────────────────────
  const adSetName = await input({
    message: 'Ad set name:',
    default: `${campaignName} — Ad Set 1`,
  })

  const ageMin = (await number({ message: 'Minimum age:', default: 35, min: 18, max: 65, required: true })) as number
  const ageMax = (await number({ message: 'Maximum age:', default: 65, min: ageMin, max: 65, required: true })) as number

  printInfo('Creating ad set...')
  const adSet = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adsets`, {
    method: 'POST',
    body: {
      name: adSetName,
      campaign_id: campaign.id,
      daily_budget: Math.round(dailyBudgetDollars * 100), // Meta uses cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'REACH',
      targeting: {
        geo_locations: {
          regions: [{ key: '3847', name: 'California', country: 'US' }], // Southern California
        },
        age_min: ageMin,
        age_max: ageMax,
      },
      status: 'PAUSED',
      start_time: new Date(Date.now() + 60_000).toISOString(), // 1 min from now
    },
  })
  printSuccess(`Ad set created: ${adSet.id}`)

  // ── Step 3: Ad Creative + Ad ──────────────────────────────────────
  const adName = await input({
    message: 'Ad name:',
    default: `${campaignName} — Ad 1`,
  })

  const headline = await input({
    message: 'Ad headline (max 40 chars):',
    default: 'Transform Your Home with Tri Pros',
  })

  const primaryText = await input({
    message: 'Primary text (the body copy):',
    default: 'Southern California\'s trusted remodeling experts. Kitchen, bath, whole-home. Get a free in-home estimate today.',
  })

  const ctaType = await select({
    message: 'Call to action:',
    choices: [
      { value: 'LEARN_MORE', name: 'Learn More' },
      { value: 'GET_QUOTE', name: 'Get Quote' },
      { value: 'CONTACT_US', name: 'Contact Us' },
      { value: 'SIGN_UP', name: 'Sign Up' },
    ],
  })

  const websiteUrl = await input({
    message: 'Destination URL:',
    default: 'https://tripros.com',
  })

  printInfo('Creating ad creative...')
  const creative = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: `${adName} Creative`,
      object_story_spec: {
        page_id: metaEnv.pageId,
        link_data: {
          link: websiteUrl,
          message: primaryText,
          name: headline,
          call_to_action: { type: ctaType, value: { link: websiteUrl } },
        },
      },
    },
  })
  printSuccess(`Creative created: ${creative.id}`)

  printInfo('Creating ad...')
  const ad = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/ads`, {
    method: 'POST',
    body: {
      name: adName,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    },
  })
  printSuccess(`Ad created: ${ad.id}`)

  // ── Summary ───────────────────────────────────────────────────────
  console.log('\n📋  Campaign created (all PAUSED — review before activating):')
  console.log(`    Campaign:  ${campaign.id}  →  ${campaignName}`)
  console.log(`    Ad Set:    ${adSet.id}`)
  console.log(`    Ad:        ${ad.id}`)
  console.log(`\n  ADS MANAGER URL: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaEnv.adAccountId.replace('act_', '')}`)
  console.log('\n  ⚠️   Campaign is PAUSED. Review in Ads Manager and activate when ready.\n')
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Run it (interactive)**

```bash
pnpm tsx scripts/meta/campaigns/create-campaign.ts
```

Walk through the wizard. Campaign will be created in PAUSED state — review in Ads Manager before activating.

- [ ] **Step 3: Commit**

```bash
git add scripts/meta/campaigns/create-campaign.ts
git commit -m "feat(meta): add interactive create-campaign wizard"
```

---

## Task 7: CLI dispatcher + package.json script

**Files:**
- Create: `scripts/meta/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Create dispatcher**

```typescript
// scripts/meta/index.ts
import { spawn } from 'node:child_process'

const command = process.argv[2]

const commands: Record<string, string> = {
  verify: 'scripts/meta/setup/verify-credentials.ts',
  performance: 'scripts/meta/reports/pull-performance.ts',
  'manage-ad': 'scripts/meta/ads/manage-ad.ts',
  'create-campaign': 'scripts/meta/campaigns/create-campaign.ts',
}

if (!command || !commands[command]) {
  console.log('\nUsage: pnpm meta <command>\n')
  console.log('Commands:')
  for (const [name, file] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(20)} ${file}`)
  }
  console.log()
  process.exit(command ? 1 : 0)
}

// Re-run tsx with the target file, forwarding remaining args
const child = spawn(
  'node_modules/.bin/tsx',
  [commands[command], ...process.argv.slice(3)],
  { stdio: 'inherit', cwd: process.cwd() },
)
child.on('exit', code => process.exit(code ?? 0))
```

- [ ] **Step 2: Add package.json script**

In `package.json`, add to the `"scripts"` object:
```json
"meta": "tsx scripts/meta/index.ts"
```

- [ ] **Step 3: Test the dispatcher**

```bash
pnpm meta
# Expected: prints usage/help

pnpm meta verify
# Expected: runs verify-credentials and confirms all creds
```

- [ ] **Step 4: Commit**

```bash
git add scripts/meta/index.ts package.json
git commit -m "feat(meta): add CLI dispatcher and pnpm meta script"
```

---

## Task 8: Custom Claude skill (`.claude/skills/meta-ads.md`)

**Files:**
- Create: `.claude/skills/meta-ads.md`

- [ ] **Step 1: Create the skill file**

```markdown
---
name: meta-ads
description: Run Meta Marketing API scripts for Tri Pros Remodeling. Use when the user asks to create a campaign, pull ad performance, pause or activate an ad, or manage Meta ads in any way.
---

# Meta Ads Skill — Tri Pros Remodeling

You are operating the Meta Ads CLI for Tri Pros Remodeling.
All commands run via: `pnpm meta <command>` from the project root.

## Available Commands

| Command | What it does | How to invoke |
|---|---|---|
| `pnpm meta verify` | Smoke test all credentials | "verify meta credentials" |
| `pnpm meta performance [preset]` | Pull campaign stats (default: last_7d) | "pull performance", "show me this month's stats" |
| `pnpm meta manage-ad` | Interactive: pause or activate an ad | "pause ad X", "activate my ads" |
| `pnpm meta create-campaign` | Interactive wizard: full campaign creation | "create a campaign", "set up a new ad" |

## Date Presets for Performance

`today`, `yesterday`, `last_7d`, `last_14d`, `last_28d`, `last_30d`, `last_month`, `this_month`

Example: `pnpm meta performance this_month`

## Credentials

Stored in `.env.meta` at project root. Never committed (covered by `.gitignore`).
If credentials fail, run `pnpm meta verify` first to diagnose.

## After Mutating Operations

After create-campaign or manage-ad runs, open Ads Manager in the browser using Playwright to visually confirm the change:
`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=910648081744451`

## Rules

- All campaigns are created PAUSED — never activate without explicit user instruction
- Always run `pnpm meta verify` if an API call throws an auth error before retrying
- Never expose credentials in output — they stay in `.env.meta`
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/meta-ads.md
git commit -m "feat(meta): add meta-ads Claude skill"
```

---

## Execution Order

Run tasks in order — each depends on the previous:

```
Task 1 (env)  →  Task 2 (client/types/formatters)  →  Task 3 (verify) ← RUN THIS before continuing
     ↓
Task 4 (performance)  →  Task 5 (manage-ad)  →  Task 6 (create-campaign)
     ↓
Task 7 (dispatcher + package.json)  →  Task 8 (Claude skill)
```

**Gate:** Do not proceed past Task 3 unless `pnpm tsx scripts/meta/setup/verify-credentials.ts` shows all three green checkmarks.
