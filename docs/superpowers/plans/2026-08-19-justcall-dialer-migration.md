# JustCall Dialer Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CloudTalk auto-dialer lead-push/pull integration with JustCall, behind a neutral `DialerProvider` seam, and remove CloudTalk entirely.

**Architecture:** The ingest → enroll → react pipeline stays; we swap the provider leaf and formalize the boundary. A neutral `DialerProvider` interface (in services-land) is implemented once by `providers/justcall/*`. A `WebhookAdapter` normalizes JustCall webhook bodies into the app's existing canonical events so `route.ts` and the reacting services stay provider-stable. CloudTalk's "enroll = apply tag" idiom is replaced by JustCall's explicit `POST /sales_dialer/campaigns/contact`. Provider-specific DB columns are renamed truthfully; dead tag columns are dropped; `dialer_mode` is added per-campaign.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), Zod, QStash (Upstash), TypeScript. Package manager: pnpm. Path alias `@/` → `src/`.

**Verification:** This repo has **no test suite**. Every task is verified with `pnpm tsc` + `pnpm lint` (and, where a runtime behavior needs proving, a throwaway `scripts/tmp-*.ts` probe run via `pnpm tsx`, deleted after). **NEVER `pnpm build`.**

**Spec:** `docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md`

> **⚠️ Post-verification update (2026-08-19).** All Tasks 2–16 + 18 are built and
> green; CloudTalk is deleted. The API facts were then **verified against
> developer.justcall.io**, which resolved every "confirm / provisional" flag in
> this plan and corrected four coded-from-assumption mismatches. **The current
> truth lives in [`justcall-api-research.md`](../../plans/voip-campaigns/justcall-api-research.md)
> and [`justcall-setup-runbook.md`](../../plans/voip-campaigns/justcall-setup-runbook.md)** —
> where this plan's task bodies disagree, those docs win. Specifically:
> - **Auth** is raw `api_key:api_secret` (confirmed) — **Task 1's live probe is
>   unnecessary**; no `tmp-justcall-auth-probe.ts` needed.
> - **Remove-contact** is `DELETE /sales_dialer/campaigns/contact` with query
>   params (not `POST …/contact/remove`); **custom fields** are
>   `GET /sales_dialer/contacts/custom-fields` returning `{key,label,type}`.
> - **Webhook payloads** nest under a `data` envelope; the outbound DID is
>   `data.sales_dialer_number`; the signature reads `webhook_url` + `type` from
>   the **body**. The Task 8/9 snippets below predate this — the shipped
>   `events.ts`/`adapter.ts` are the corrected versions.
> - **Task 17** (provisioning + live smoke) remains the only user-gated work; the
>   ⚠️ Dynamic-tier persistence question is the sole open commercial item.

## Global Constraints

Copied from the spec + repo conventions. Every task implicitly includes these.

- **Verification:** run `pnpm tsc` and `pnpm lint` to verify. No unit-test suite exists — do not add one. **NEVER `pnpm build`.** (memory: no-build, verification-workflow)
- **Backend layering (ADR-0003):** tRPC → Service → DAL → DB. Services orchestrate and hold **zero** raw `db.*` — every write goes through `entities/<x>/dal/server/mutations.ts`. Providers are leaves: primitives/scalar shapes in and out, **no app-domain types** (no `Customer`) in signatures.
- **Provider neutrality:** `services/voip/campaigns/*` consumes the dialer only through the neutral `dialerProvider` binding — never imports `providers/justcall/*` directly. JustCall shapes never cross the `DialerProvider` line.
- **Truthful naming:** columns/types name what they hold. No column named for CloudTalk holding a JustCall value.
- **No manual `updatedAt`:** `.$onUpdate()` handles it; never set `updatedAt` in `.set()`. (memory: no-manual-updated-at)
- **No raw `sql NOW()` for event timestamps:** use JS `new Date().toISOString()` on `mode:'string'` columns. (memory: no-raw-sql-for-event-timestamps)
- **Phone:** all phone conversion via `@/shared/lib/phone` (`toE164`); store bare 10-digit; E.164 only at the external call boundary. (memory: phone-numbers)
- **Named exports only; one primary unit per file; co-locate.** `schemas/` is a sibling of `lib/`, never `lib/schemas/`. (memory: coding-conventions, schemas-sibling-of-lib)
- **DB:** always `pnpm db:push:dev` for dev; prod push is explicit `pnpm db:push:prod` only when asked. Worktree `db:push:dev` needs `.env.local` — verify target DB after. (memory: db-push-dev-only, db-push-wt)
- **Scripts:** import `'./lib/load-env'` (not `'dotenv/config'`); target prod DB ONLY via `DRIZZLE_TARGET=prod`. (memory: scripts-load-env, runtime-db-env)
- **Git:** work on `main`, stage explicitly by path — never `git add -A`. Branch `feat/justcall-dialer-migration`. Commit only the paths a task names. (memory: work-on-main)
- **Untouched:** the Twilio in-house EPIC (`voip-calls`, `voip-messages`, `voip-dids`, `voip-link-tokens`, `providers/twilio/*`) is a separate system — do not modify it.
- **JustCall API base:** `https://api.justcall.io/v2.1`. Auth header (pending Task 1): `Authorization: api_key:api_secret`. Webhook signature: HMAC-SHA256, key = API secret.

---

## File Structure

**New:**
- `scripts/tmp-justcall-auth-probe.ts` — one-off auth verification (Task 1; deleted after).
- `src/shared/services/providers/justcall/lib/config.ts` — env fragment + config accessors.
- `src/shared/services/providers/justcall/constants/index.ts` — base URL, rate/retry, bulk cap, disposition→unenroll-reason map, field app-keys.
- `src/shared/services/providers/justcall/schemas/*.ts` — request/response Zod (campaign-contact, remove, sms, campaign-list, fields).
- `src/shared/services/providers/justcall/client.ts` — `justcallClient` REST singleton.
- `src/shared/services/providers/justcall/dialer-provider.ts` — `justcallDialerProvider` implementing `DialerProvider`.
- `src/shared/services/providers/justcall/webhooks/events.ts` — JustCall inbound Zod.
- `src/shared/services/providers/justcall/webhooks/adapter.ts` — HMAC verify + normalize → canonical events.
- `src/shared/services/providers/justcall/mappers/resolve-field-ids.ts` — appKey → numeric `custom_fields`.
- `src/shared/services/providers/justcall/DOCS.md` — provider conventions.
- `src/shared/services/voip/dialer/types.ts` — `DialerProvider` interface + neutral types + canonical webhook event union.
- `src/shared/services/voip/dialer/index.ts` — `export const dialerProvider: DialerProvider = justcallDialerProvider` (the single seam binding).
- `src/app/api/webhooks/justcall/route.ts` — inbound receiver.
- `docs/plans/voip-campaigns/justcall-api-research.md` — captured verified API facts.
- `docs/plans/voip-campaigns/justcall-setup-runbook.md` — dashboard setup steps.

**Renamed:**
- `src/shared/db/schema/voip-contact-attributes.ts` → `voip-contact-fields.ts`.
- `src/shared/entities/voip-contact-attributes/` → `src/shared/entities/voip-contact-fields/`.

**Modified:**
- `src/shared/db/schema/voip-campaigns.ts`, `voip-campaign-contacts.ts` — column renames + `dialer_mode`.
- `src/shared/entities/voip-campaigns/dal/server/{mutations,queries}.ts`, `voip-campaign-contacts/dal/server/{mutations,queries}.ts` — new columns/signatures.
- `src/shared/constants/enums/voip.ts` — add `dialerMode` enum.
- `src/shared/config/server-env.ts` — swap CloudTalk fragment → JustCall.
- `src/shared/services/voip/campaigns/enrollment.service.ts`, `campaign-sync.service.ts`, `sms-cadence.service.ts` — use `dialerProvider` + neutral shapes.
- `src/trpc/routers/voip-campaigns.router.ts` — rename `resyncFromCloudtalk` → `resyncDialer`; error copy.

**Deleted (final task):**
- `src/shared/services/providers/cloudtalk/**`, `src/app/api/webhooks/cloudtalk/**`, `src/app/api/voip/routing/**` (Phase-0 mocks), CloudTalk env vars.

---

## Task 1: Confirm JustCall auth header encoding (spike)

Resolves the highest-risk unknown before any client code. Official docs say raw `api_key:api_secret`; a third-party guide says base64 Basic. Empirically confirm against a live key. **Needs a live JustCall API key — blocked until signup.**

**Files:**
- Create: `scripts/tmp-justcall-auth-probe.ts`

**Interfaces:**
- Produces: a confirmed fact — which `Authorization` header value JustCall v2.1 accepts. Recorded in `docs/plans/voip-campaigns/justcall-api-research.md` (Task 16) and applied in `client.ts` (Task 6).

- [ ] **Step 1: Write the probe script**

```ts
import './lib/load-env'

// One-off: confirm JustCall v2.1 auth header encoding. Delete after.
// Requires JUSTCALL_API_KEY + JUSTCALL_API_SECRET in .env.local.
const key = process.env.JUSTCALL_API_KEY!
const secret = process.env.JUSTCALL_API_SECRET!
const base = 'https://api.justcall.io/v2.1'

async function probe(label: string, authValue: string) {
  const res = await fetch(`${base}/users?per_page=1`, {
    headers: { Authorization: authValue, Accept: 'application/json' },
  })
  console.log(`[${label}] status=${res.status} ${res.ok ? 'OK' : await res.text()}`)
}

async function main() {
  await probe('plain', `${key}:${secret}`)
  await probe('basic', `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`)
}

void main()
```

- [ ] **Step 2: Run the probe**

Run: `pnpm tsx scripts/tmp-justcall-auth-probe.ts`
Expected: exactly one of `[plain]` / `[basic]` prints `status=200 OK`; the other prints 401. Record the winner.

- [ ] **Step 3: Delete the probe + record the fact**

Delete `scripts/tmp-justcall-auth-probe.ts`. The recorded auth method is applied in Task 6 and written into the research doc in Task 16. No code commit here (script is throwaway); note the result in the task tracker.

> If BOTH fail with 401, stop — the key lacks API access (needs Team+ plan) or is mis-copied; resolve with JustCall before proceeding.

---

## Task 2: JustCall provider config (env fragment + accessors)

**Files:**
- Create: `src/shared/services/providers/justcall/lib/config.ts`
- Modify: `src/shared/config/server-env.ts:8,144,222`

**Interfaces:**
- Produces: `justcallEnvFragment`, `getJustcallConfig(): JustcallRuntimeConfig`, `isJustcallConfigured(): boolean`, `justcallConfigMeta`. `JustcallRuntimeConfig = { apiKey: string; apiSecret: string }`.

- [ ] **Step 1: Write the config** (mirror `providers/cloudtalk/lib/config.ts` exactly, no webhook-secret — HMAC uses the API secret)

```ts
import { z } from 'zod'
import { createProviderConfig } from '@/shared/config/create-provider-config'

// JustCall env fragment + runtime-config builder + accessor.
// Auth: Authorization: api_key:api_secret (Task 1 confirmed encoding).
// Webhook signature: HMAC-SHA256 keyed with JUSTCALL_API_SECRET — no separate
// webhook secret (unlike CloudTalk's ?secret= query param).
// see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
export const justcallEnvFragment = z.object({
  JUSTCALL_API_KEY: z.string().optional(),
  JUSTCALL_API_SECRET: z.string().optional(),
})

export type ParsedJustcallEnv = z.infer<typeof justcallEnvFragment>

export interface JustcallRuntimeConfig {
  apiKey: string
  apiSecret: string
}

const helpers = createProviderConfig({
  provider: 'justcall',
  fragment: justcallEnvFragment,
  requiredKeys: ['JUSTCALL_API_KEY', 'JUSTCALL_API_SECRET'],
  toConfig: (parsed): JustcallRuntimeConfig => ({
    apiKey: parsed.JUSTCALL_API_KEY!,
    apiSecret: parsed.JUSTCALL_API_SECRET!,
  }),
})

export const buildJustcallConfig = helpers.build
export const getJustcallConfig = helpers.get
export const isJustcallConfigured = helpers.isConfigured
export const justcallConfigMeta = helpers.configMeta
```

- [ ] **Step 2: Register the fragment in server-env** (add alongside — CloudTalk removal happens in Task 18)

In `src/shared/config/server-env.ts`: add import next to line 8, spread `...justcallEnvFragment.shape` next to line 144, and add `justcallConfigMeta` to the config-meta list near line 222.

```ts
// line ~8
import { justcallConfigMeta, justcallEnvFragment } from '@/shared/services/providers/justcall/lib/config'
// line ~144 (inside the env object)
...justcallEnvFragment.shape,
// line ~222 (config-meta list)
justcallConfigMeta,
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean typecheck + lint.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/justcall/lib/config.ts src/shared/config/server-env.ts
git commit -m "feat(justcall): provider env config fragment + accessors"
```

---

## Task 3: JustCall constants

**Files:**
- Create: `src/shared/services/providers/justcall/constants/index.ts`

**Interfaces:**
- Produces: `JUSTCALL_BASE_URL`, `JUSTCALL_MAX_RETRIES`, `JUSTCALL_BULK_MAX_CONTACTS` (250), `justcallContactFieldAppKeys` (the 4 app keys), `JustcallContactFieldAppKey`, `justcallDispositionToUnenrollReason(disposition: string): VoipUnenrollReason | null`.

- [ ] **Step 1: Write constants** (disposition labels are the JustCall dashboard's disposition names configured on the campaign — the Task 16 runbook fixes the exact strings; the map keys below are the agreed set)

```ts
import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'

// JustCall provider constants — HTTP wiring + domain vocabulary.
// see ../DOCS.md · see docs/plans/voip-campaigns/justcall-api-research.md
export const JUSTCALL_BASE_URL = 'https://api.justcall.io/v2.1' as const

// Retry attempts on HTTP 429. Ceiling confirmed against live headers (Task 6/16).
export const JUSTCALL_MAX_RETRIES = 3 as const

// Sales Dialer bulk_import cap (contacts per request).
export const JUSTCALL_BULK_MAX_CONTACTS = 250 as const

// App-side keys for the 4 synced custom fields (unchanged from CloudTalk).
export const justcallContactFieldAppKeys = [
  'lead_source',
  'primary_trade',
  'trades_interested',
  'lead_created_at',
] as const
export type JustcallContactFieldAppKey = (typeof justcallContactFieldAppKeys)[number]

// Terminal dispositions exit the campaign. Keys = JustCall disposition names
// configured on the campaign (see runbook). Non-terminal → null (keep dialing).
const DISPOSITION_UNENROLL_MAP: Record<string, VoipUnenrollReason> = {
  'DNC': 'opted_out',
  'Do Not Call': 'opted_out',
  'Not Interested': 'disqualified',
  'Wrong Number': 'disqualified',
  'Meeting Booked': 'graduated',
}

export function justcallDispositionToUnenrollReason(disposition: string): VoipUnenrollReason | null {
  return DISPOSITION_UNENROLL_MAP[disposition] ?? null
}
```

> Confirm `VoipUnenrollReason`'s exact members (`opted_out` / `disqualified` / `graduated`) against `src/shared/constants/enums/voip.ts` before finalizing the map values — use the real enum literals.

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/justcall/constants/
git commit -m "feat(justcall): provider constants + disposition map"
```

---

## Task 4: `DialerProvider` interface + neutral types

The neutral contract, owned by services-land. No JustCall types.

**Files:**
- Create: `src/shared/services/voip/dialer/types.ts`

**Interfaces:**
- Produces:
  - `NeutralField = { appKey: string; value?: string; providerFieldId?: string; label?: string }`
  - `DialerMode = 'autodial' | 'dynamic' | 'predictive'`
  - `NeutralCampaign = { providerCampaignId: string; name: string; dialerMode: DialerMode; status: 'active' | 'inactive' }`
  - `CanonicalDialerEvent` — discriminated union: `{ type: 'call.ended'; ... }` | `{ type: 'call.disposition_set'; ... }` | `{ type: 'sms.received'; ... }` (shapes below).
  - `interface DialerProvider` with `enroll`, `unenroll`, `switchCampaign`, `sendSms`, `listCampaigns`, `listContactFields`.

- [ ] **Step 1: Write the interface file**

```ts
import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'

// Neutral dialer-provider contract. Shaped around operations we perform, not any
// vendor's endpoints. JustCall (or a future provider) implements this; consumers
// in services/voip/campaigns/* depend ONLY on this interface (via ../dialer).
// see docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md

export type DialerMode = 'autodial' | 'dynamic' | 'predictive'

export interface NeutralField {
  appKey: string
  value?: string
  providerFieldId?: string
  label?: string
}

export interface NeutralCampaign {
  providerCampaignId: string
  name: string
  dialerMode: DialerMode
  status: 'active' | 'inactive'
}

// ── Canonical inbound events (adapter output; provider-agnostic) ─────────────
export type CanonicalDialerEvent =
  | {
      type: 'call.ended'
      callUuid: string
      providerContactId?: string
      direction?: 'inbound' | 'outbound'
      fromNumberE164?: string // the dialed DID → SMS `from`
    }
  | {
      type: 'call.disposition_set'
      callUuid: string
      providerContactId?: string
      disposition: string
    }
  | {
      type: 'sms.received'
      fromE164: string
      toE164: string
      text: string
      providerContactId?: string
    }

export interface EnrollInput {
  providerCampaignId: string
  phoneE164: string
  name?: string
  email?: string
  fields: NeutralField[]
}

export interface SwitchCampaignInput {
  phoneE164: string
  providerContactId: string
  fromCampaignId: string
  toCampaignId: string
  name?: string
  email?: string
  fields: NeutralField[]
}

export interface DialerProvider {
  enroll(input: EnrollInput): Promise<{ providerContactId: string }>
  unenroll(input: { providerCampaignId: string; providerContactId: string }): Promise<void>
  switchCampaign(input: SwitchCampaignInput): Promise<{ providerContactId: string }>
  sendSms(input: { fromNumberE164: string; toE164: string; body: string }): Promise<{ providerMessageId: string }>
  listCampaigns(): Promise<NeutralCampaign[]>
  listContactFields(): Promise<NeutralField[]>
}

// Re-export for handlers mapping a terminal disposition to an exit reason.
export type { VoipUnenrollReason }
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean (no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/voip/dialer/types.ts
git commit -m "feat(dialer): neutral DialerProvider interface + canonical event types"
```

---

## Task 5: JustCall request/response schemas

**Files:**
- Create: `src/shared/services/providers/justcall/schemas/campaign-contact.ts`, `campaign-list.ts`, `fields.ts`, `sms.ts`

**Interfaces:**
- Produces: Zod schemas + inferred types for each SD endpoint response used in Task 6/7. Key: `jcAddContactToCampaignResponseSchema` → `{ status: string; data: { id: number; phone_number: string } }`; `jcCampaignListResponseSchema` → `{ data: Array<{ id: number; name: string; type: string; status?: string }> }`; `jcContactFieldsResponseSchema` → `{ data: Array<{ id: number; name: string }> }`; `jcSmsResponseSchema` → `{ status: string; data: { id: number } }`.

- [ ] **Step 1: Write the schemas** (`campaign-contact.ts` shown; create the other three analogously)

```ts
// schemas/campaign-contact.ts
import { z } from 'zod'

export const jcAddContactToCampaignResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    id: z.number(),
    name: z.string().optional(),
    phone_number: z.string(),
    status: z.string().optional(),
  }),
})
export type JcAddContactToCampaignResponse = z.infer<typeof jcAddContactToCampaignResponseSchema>
```

```ts
// schemas/campaign-list.ts
import { z } from 'zod'

export const jcCampaignListResponseSchema = z.object({
  data: z.array(z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(), // 'Autodial' | 'Predictive' | 'Dynamic'
    status: z.string().optional(),
  })),
})
export type JcCampaignListResponse = z.infer<typeof jcCampaignListResponseSchema>
```

```ts
// schemas/fields.ts  (Sales Dialer custom-fields list; exact path confirmed in Task 6)
import { z } from 'zod'

export const jcContactFieldsResponseSchema = z.object({
  data: z.array(z.object({ id: z.number(), name: z.string() })),
})
export type JcContactFieldsResponse = z.infer<typeof jcContactFieldsResponseSchema>
```

```ts
// schemas/sms.ts
import { z } from 'zod'

export const jcSmsResponseSchema = z.object({
  status: z.string(),
  data: z.object({ id: z.number() }),
})
export type JcSmsResponse = z.infer<typeof jcSmsResponseSchema>
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/justcall/schemas/
git commit -m "feat(justcall): sales-dialer request/response schemas"
```

---

## Task 6: JustCall REST client

**Files:**
- Create: `src/shared/services/providers/justcall/client.ts`

**Interfaces:**
- Produces: `justcallClient` singleton (`export type JustcallClient = ReturnType<typeof createJustcallClient>`) with low-level methods:
  - `addContactToCampaign(input: { campaignId: string; phoneE164: string; name?: string; email?: string; customFields: { id: number; value: string }[] }): Promise<{ contactId: string }>`
  - `removeContactFromCampaign(input: { campaignId: string; contactId: string }): Promise<void>`
  - `sendSms(input: { fromE164: string; toE164: string; body: string }): Promise<{ messageId: string }>`
  - `listCampaigns(): Promise<{ id: string; name: string; type: string; status?: string }[]>`
  - `listContactFields(): Promise<{ id: number; name: string }[]>`
  - `JustcallApiError`, `JustcallResponseValidationError` classes.

- [ ] **Step 1: Write the client** (auth value = Task 1 result; structure mirrors `cloudtalkClient` — factory → singleton; 429 retry; page pagination in `listCampaigns`/`listContactFields`)

```ts
import type { z } from 'zod'
import { JUSTCALL_BASE_URL, JUSTCALL_MAX_RETRIES } from './constants'
import { getJustcallConfig } from './lib/config'
import { jcAddContactToCampaignResponseSchema } from './schemas/campaign-contact'
import { jcCampaignListResponseSchema } from './schemas/campaign-list'
import { jcContactFieldsResponseSchema } from './schemas/fields'
import { jcSmsResponseSchema } from './schemas/sms'

export class JustcallApiError extends Error {
  constructor(public status: number, public path: string, public body: string) {
    super(`JustCall ${status} on ${path}: ${body}`)
    this.name = 'JustcallApiError'
  }
}
export class JustcallResponseValidationError extends Error {
  constructor(public path: string, public issues: unknown) {
    super(`JustCall response failed zod validation on ${path}`)
    this.name = 'JustcallResponseValidationError'
  }
}

function buildAuthHeader(): string {
  const { apiKey, apiSecret } = getJustcallConfig()
  // Task 1 confirmed: raw colon-joined (NOT base64 Basic). If Task 1 found Basic,
  // swap to `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`.
  return `${apiKey}:${apiSecret}`
}

interface RequestOptions<T extends z.ZodTypeAny = z.ZodTypeAny> {
  query?: Record<string, string | number | undefined>
  body?: unknown
  schema?: T
}

async function request<TResponse>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<TResponse> {
  const url = new URL(`${JUSTCALL_BASE_URL}${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const init: RequestInit = {
    method,
    headers: { Authorization: buildAuthHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }
  let attempt = 0
  while (true) {
    attempt += 1
    const res = await fetch(url.toString(), init)
    if (res.status === 429 && attempt < JUSTCALL_MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '2')
      await new Promise(r => setTimeout(r, Math.max(retryAfter, 1) * 1000 + 250 * attempt))
      continue
    }
    if (!res.ok) throw new JustcallApiError(res.status, path, await res.text())
    const text = await res.text()
    if (!text) return undefined as TResponse
    const parsed = JSON.parse(text)
    if (opts.schema) {
      const result = opts.schema.safeParse(parsed)
      if (!result.success) throw new JustcallResponseValidationError(path, result.error.issues)
      return result.data as TResponse
    }
    return parsed as TResponse
  }
}

function createJustcallClient() {
  return {
    async addContactToCampaign(input: { campaignId: string; phoneE164: string; name?: string; email?: string; customFields: { id: number; value: string }[] }): Promise<{ contactId: string }> {
      const res = await request('POST', '/sales_dialer/campaigns/contact', {
        body: {
          campaign_id: Number(input.campaignId),
          phone_number: input.phoneE164,
          name: input.name,
          email: input.email,
          custom_fields: input.customFields,
        },
        schema: jcAddContactToCampaignResponseSchema,
      })
      return { contactId: String(res.data.id) }
    },

    async removeContactFromCampaign(input: { campaignId: string; contactId: string }): Promise<void> {
      // Exact path confirmed against developer.justcall.io (remove-contact-from-campaign).
      await request('POST', '/sales_dialer/campaigns/contact/remove', {
        body: { campaign_id: Number(input.campaignId), contact_id: Number(input.contactId) },
      })
    },

    async sendSms(input: { fromE164: string; toE164: string; body: string }): Promise<{ messageId: string }> {
      const res = await request('POST', '/texts/new', {
        body: { justcall_number: input.fromE164, contact_number: input.toE164, body: input.body },
        schema: jcSmsResponseSchema,
      })
      return { messageId: String(res.data.id) }
    },

    async listCampaigns(): Promise<{ id: string; name: string; type: string; status?: string }[]> {
      const out: { id: string; name: string; type: string; status?: string }[] = []
      let page = 0
      while (true) {
        const res = await request('GET', '/sales_dialer/campaigns', { query: { page, per_page: 100 }, schema: jcCampaignListResponseSchema })
        for (const c of res.data) out.push({ id: String(c.id), name: c.name, type: c.type, status: c.status })
        if (res.data.length < 100) break
        page += 1
      }
      return out
    },

    async listContactFields(): Promise<{ id: number; name: string }[]> {
      const res = await request('GET', '/sales_dialer/contacts/fields', { schema: jcContactFieldsResponseSchema })
      return res.data
    },
  }
}

export type JustcallClient = ReturnType<typeof createJustcallClient>
export const justcallClient = createJustcallClient()
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/justcall/client.ts
git commit -m "feat(justcall): REST client (campaign-contact, sms, campaign/field lists)"
```

> During Step 1 development, confirm the exact paths for `removeContactFromCampaign`, `/texts/new`, and `/sales_dialer/contacts/fields` against developer.justcall.io; adjust if the live API differs and note in the research doc (Task 16). Runtime request-shape validation happens in the Task 17 live smoke (a throwaway `scripts/tmp-*.ts` probe against a real key is fine to sanity-check a single endpoint before then).

---

## Task 7: field-id resolver + `justcallDialerProvider`

**Files:**
- Create: `src/shared/services/providers/justcall/mappers/resolve-field-ids.ts`
- Create: `src/shared/services/providers/justcall/dialer-provider.ts`
- Create: `src/shared/services/voip/dialer/index.ts`

**Interfaces:**
- Consumes: `justcallClient` (Task 6), `DialerProvider`/`NeutralField`/`NeutralCampaign` (Task 4).
- Produces: `resolveFieldIds(fields: NeutralField[]): { id: number; value: string }[]` (drops fields lacking a resolved `providerFieldId` or `value`); `justcallDialerProvider: DialerProvider`; the binding `export const dialerProvider: DialerProvider = justcallDialerProvider`.

- [ ] **Step 1: Write the resolver**

```ts
import type { NeutralField } from '@/shared/services/voip/dialer/types'

// Translate neutral fields → JustCall's numeric custom_fields:[{id,value}].
// Fields without a resolved provider id OR without a value are enrichment we
// can't push — drop them (enrollment.service logs the gap, never hard-fails).
export function resolveFieldIds(fields: NeutralField[]): { id: number; value: string }[] {
  const out: { id: number; value: string }[] = []
  for (const f of fields) {
    if (!f.providerFieldId || f.value === undefined) continue
    out.push({ id: Number(f.providerFieldId), value: f.value })
  }
  return out
}
```

- [ ] **Step 2: Write the provider + binding**

```ts
// providers/justcall/dialer-provider.ts
import type { DialerMode, DialerProvider, NeutralCampaign } from '@/shared/services/voip/dialer/types'
import { justcallClient } from './client'
import { resolveFieldIds } from './mappers/resolve-field-ids'

function toDialerMode(jcType: string): DialerMode {
  switch (jcType.toLowerCase()) {
    case 'dynamic': return 'dynamic'
    case 'predictive': return 'predictive'
    default: return 'autodial'
  }
}

export const justcallDialerProvider: DialerProvider = {
  async enroll(input) {
    return justcallClient.addContactToCampaign({
      campaignId: input.providerCampaignId,
      phoneE164: input.phoneE164,
      name: input.name,
      email: input.email,
      customFields: resolveFieldIds(input.fields),
    })
  },
  async unenroll(input) {
    await justcallClient.removeContactFromCampaign({ campaignId: input.providerCampaignId, contactId: input.providerContactId })
  },
  async switchCampaign(input) {
    await justcallClient.removeContactFromCampaign({ campaignId: input.fromCampaignId, contactId: input.providerContactId })
    return justcallClient.addContactToCampaign({
      campaignId: input.toCampaignId, phoneE164: input.phoneE164, name: input.name, email: input.email, customFields: resolveFieldIds(input.fields),
    })
  },
  async sendSms(input) {
    const res = await justcallClient.sendSms({ fromE164: input.fromNumberE164, toE164: input.toE164, body: input.body })
    return { providerMessageId: res.messageId }
  },
  async listCampaigns(): Promise<NeutralCampaign[]> {
    const rows = await justcallClient.listCampaigns()
    return rows.map(r => ({
      providerCampaignId: r.id,
      name: r.name,
      dialerMode: toDialerMode(r.type),
      status: (r.status ?? 'inactive').toLowerCase() === 'active' ? 'active' : 'inactive',
    }))
  },
  async listContactFields() {
    const rows = await justcallClient.listContactFields()
    return rows.map(r => ({ appKey: r.name, providerFieldId: String(r.id), label: r.name }))
  },
}
```

```ts
// services/voip/dialer/index.ts — the SINGLE seam binding.
import type { DialerProvider } from './types'
import { justcallDialerProvider } from '@/shared/services/providers/justcall/dialer-provider'

// The one place the app names its live dialer provider. Consumers import
// `dialerProvider` from here.
export const dialerProvider: DialerProvider = justcallDialerProvider
export * from './types'
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/justcall/mappers/ src/shared/services/providers/justcall/dialer-provider.ts src/shared/services/voip/dialer/index.ts
git commit -m "feat(justcall): DialerProvider implementation + seam binding"
```

---

## Task 8: JustCall webhook event schemas + HMAC verify

**Files:**
- Create: `src/shared/services/providers/justcall/webhooks/events.ts`

**Interfaces:**
- Produces: `jcWebhookEventSchema` (discriminated on JustCall's event field) covering `sd.call_completed`, `sd.call_updated`, `sms.received`; `verifyJustcallSignature(input: { secret: string; webhookUrl: string; eventType: string; timestamp: string; signature: string }): boolean`.

- [ ] **Step 1: Write events + verifier** (field names per JustCall payloads — confirm exact keys against developer.justcall.io call-events during Task 17 live validation)

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { z } from 'zod'

// JustCall inbound webhook shapes (subset consumed at go-live). Payload keys
// per developer.justcall.io/docs/call-events + sms-events.
const jcCallInfoSchema = z.object({ direction: z.string().optional(), disposition: z.string().nullable().optional() }).optional()

export const jcCallCompletedSchema = z.object({
  type: z.literal('sd.call_completed'),
  call_sid: z.string(),
  contact_id: z.union([z.string(), z.number()]).transform(String).optional(),
  agent_id: z.union([z.string(), z.number()]).transform(String).optional(),
  justcall_number: z.string().optional(),
  call_info: jcCallInfoSchema,
})

export const jcCallUpdatedSchema = z.object({
  type: z.literal('sd.call_updated'),
  call_sid: z.string(),
  contact_id: z.union([z.string(), z.number()]).transform(String).optional(),
  call_info: jcCallInfoSchema,
})

export const jcSmsReceivedSchema = z.object({
  type: z.literal('sms.received'),
  contact_number: z.string(),
  justcall_number: z.string(),
  body: z.string(),
  contact_id: z.union([z.string(), z.number()]).transform(String).optional(),
})

export const jcWebhookEventSchema = z.discriminatedUnion('type', [
  jcCallCompletedSchema, jcCallUpdatedSchema, jcSmsReceivedSchema,
])
export type JcWebhookEvent = z.infer<typeof jcWebhookEventSchema>

// HMAC-SHA256 over `{secret}|{urlencoded-url}|{event-type}|{timestamp}` (hex),
// keyed with the API secret; constant-time compared.
export function verifyJustcallSignature(input: {
  secret: string; webhookUrl: string; eventType: string; timestamp: string; signature: string
}): boolean {
  const signed = `${input.secret}|${encodeURIComponent(input.webhookUrl)}|${input.eventType}|${input.timestamp}`
  const expected = createHmac('sha256', input.secret).update(signed).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(input.signature)
  if (a.length !== b.length) return false
  try { return timingSafeEqual(a, b) } catch { return false }
}
```

> The exact signed-string recipe and header names are JustCall-specific and must be confirmed against the JustCall webhook docs at Task 16/17. The formula above is the current best understanding — treat it as provisional until the live signed test in Task 17 passes.

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/justcall/webhooks/events.ts
git commit -m "feat(justcall): webhook event schemas + HMAC signature verify"
```

---

## Task 9: WebhookAdapter (normalize → canonical events)

**Files:**
- Create: `src/shared/services/providers/justcall/webhooks/adapter.ts`

**Interfaces:**
- Consumes: `jcWebhookEventSchema`, `verifyJustcallSignature` (Task 8), `getJustcallConfig` (Task 2), `CanonicalDialerEvent` (Task 4).
- Produces: `justcallWebhookAdapter` with `verify(req: Request, rawBody: string): boolean` and `parse(rawBody: string): CanonicalDialerEvent | null`.

- [ ] **Step 1: Write the adapter**

```ts
import type { CanonicalDialerEvent } from '@/shared/services/voip/dialer/types'
import { getJustcallConfig } from '../lib/config'
import { jcWebhookEventSchema, verifyJustcallSignature } from './events'

// Normalizes JustCall inbound → the app's canonical events, so route.ts and the
// reacting services never learn the provider changed.
export const justcallWebhookAdapter = {
  verify(req: Request, _rawBody: string): boolean {
    const { apiSecret } = getJustcallConfig()
    const signature = req.headers.get('x-justcall-signature') ?? ''
    const timestamp = req.headers.get('x-justcall-request-timestamp') ?? ''
    // JustCall signs against the configured webhook URL. Use the request URL
    // (must match the URL registered in JustCall exactly — see runbook).
    const eventType = req.headers.get('x-justcall-event-type') ?? ''
    return verifyJustcallSignature({ secret: apiSecret, webhookUrl: req.url, eventType, timestamp, signature })
  },

  parse(rawBody: string): CanonicalDialerEvent | null {
    const result = jcWebhookEventSchema.safeParse(JSON.parse(rawBody))
    if (!result.success) return null
    const e = result.data
    switch (e.type) {
      case 'sd.call_completed':
        return {
          type: 'call.ended',
          callUuid: e.call_sid,
          providerContactId: e.contact_id,
          direction: e.call_info?.direction === 'inbound' ? 'inbound' : 'outbound',
          fromNumberE164: e.justcall_number,
        }
      case 'sd.call_updated': {
        const disposition = e.call_info?.disposition
        if (!disposition) return null // no disposition yet → nothing to act on
        return { type: 'call.disposition_set', callUuid: e.call_sid, providerContactId: e.contact_id, disposition }
      }
      case 'sms.received':
        return { type: 'sms.received', fromE164: e.contact_number, toE164: e.justcall_number, text: e.body, providerContactId: e.contact_id }
    }
  },
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/justcall/webhooks/adapter.ts
git commit -m "feat(justcall): webhook adapter normalizing to canonical events"
```

---

## Task 10: Schema reshape migration

Do the DB shape change before rewiring services so the new columns exist.

**Files:**
- Modify: `src/shared/db/schema/voip-campaigns.ts`
- Modify: `src/shared/db/schema/voip-campaign-contacts.ts`
- Rename: `src/shared/db/schema/voip-contact-attributes.ts` → `voip-contact-fields.ts`
- Modify: `src/shared/constants/enums/voip.ts` (add `dialerModes`)

**Interfaces:**
- Produces: `voipCampaigns` with `providerCampaignId`, `providerCampaignName`, `status`, `dialerMode` (no `ct*` cols); `voipCampaignContacts.providerContactId`; new table `voipContactFields` (`appKey`, `providerFieldId`, `providerFieldLabel`). Enum `dialerModes = ['autodial','dynamic','predictive']`, type `DialerMode`.

- [ ] **Step 1: Add the `dialerModes` enum**

In `src/shared/constants/enums/voip.ts` add both the dialer-mode and the
provider-status tuples (schema columns use the canonical `text(col, { enum })`
form — NOT `text().$type<...>()`):

```ts
export const dialerModes = ['autodial', 'dynamic', 'predictive'] as const
export type DialerMode = (typeof dialerModes)[number]

export const voipCampaignStatuses = ['active', 'inactive'] as const
export type VoipCampaignStatus = (typeof voipCampaignStatuses)[number]
```

- [ ] **Step 2: Reshape `voip-campaigns.ts`** (replace the `ct*` columns; keep cadence/config cols)

```ts
// replace ctCampaignId/ctCampaignName/ctMembershipTag/ctTagId/ctStatus with:
providerCampaignId: text('provider_campaign_id').notNull().unique(),
providerCampaignName: text('provider_campaign_name').notNull(),
status: text('status', { enum: voipCampaignStatuses }).notNull(),
dialerMode: text('dialer_mode', { enum: dialerModes }).notNull().default('autodial'),
// (drop ctMembershipTag + ctTagId entirely — JustCall has no tags)
```

Add `import { dialerModes, voipCampaignStatuses } from '@/shared/constants/enums/voip'` (value imports — the `{ enum }` form infers the column union, so no `$type` and no `DialerMode` type import) and update the header comment to describe the JustCall identity bridge (no tags).

- [ ] **Step 3: Reshape `voip-campaign-contacts.ts`**

```ts
// rename the column:
providerContactId: text('provider_contact_id').notNull().unique(),
// (everything else unchanged)
```

Update the header comment: enrollment = `dialerProvider.enroll` (explicit campaign id), unenroll = `dialerProvider.unenroll`; drop the tag language.

- [ ] **Step 4: Rename + reshape the fields table**

`git mv src/shared/db/schema/voip-contact-attributes.ts src/shared/db/schema/voip-contact-fields.ts`, then:

```ts
export const voipContactFields = pgTable('voip_contact_fields', {
  id,
  appKey: text('app_key').notNull().unique(),
  providerFieldId: text('provider_field_id').notNull().unique(),
  providerFieldLabel: text('provider_field_label').notNull(),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'string', withTimezone: true }).defaultNow().notNull(),
  createdAt,
  updatedAt,
})
export const selectVoipContactFieldSchema = createSelectSchema(voipContactFields)
export type VoipContactField = z.infer<typeof selectVoipContactFieldSchema>
export const insertVoipContactFieldSchema = createInsertSchema(voipContactFields).omit({ id: true, createdAt: true, updatedAt: true })
export type InsertVoipContactField = z.infer<typeof insertVoipContactFieldSchema>
```

Update the schema barrel/index that exports `voipContactAttributes` to export `voipContactFields` (search: `grep -rn "voipContactAttributes\|voip-contact-attributes" src/shared/db`).

- [ ] **Step 5: Push schema to dev + verify target DB**

Run: `pnpm db:push:dev`
Expected: Drizzle applies the rename/drop/add. Confirm it targeted the dev branch (memory: db-push-wt — verify after worktree pushes).

- [ ] **Step 6: Typecheck (expect downstream errors — fixed in Tasks 11–15)**

Run: `pnpm tsc`
Expected: errors ONLY in the DAL/services/router files that reference old columns (fixed next). No errors in the schema files themselves.

- [ ] **Step 7: Commit**

```bash
git add src/shared/db/schema/voip-campaigns.ts src/shared/db/schema/voip-campaign-contacts.ts src/shared/db/schema/voip-contact-fields.ts src/shared/constants/enums/voip.ts
git commit -m "feat(voip): provider-neutral schema reshape (drop tags, add dialer_mode)"
```

---

## Task 11: Update entity DAL to the reshaped schema

**Files:**
- Rename dir: `src/shared/entities/voip-contact-attributes/` → `src/shared/entities/voip-contact-fields/`
- Modify: `voip-campaigns/dal/server/{mutations,queries}.ts`, `voip-campaign-contacts/dal/server/{mutations,queries}.ts`, the renamed `voip-contact-fields/dal/server/{mutations,queries}.ts`

**Interfaces:**
- Produces (renamed/retyped, keep call-sites minimal):
  - `upsertCampaignByProviderId(input: { providerCampaignId: string; providerCampaignName: string; status: 'active'|'inactive'; dialerMode: DialerMode }): Promise<DalReturn<...>>` (was `upsertCampaignByCtId`).
  - `upsertEnrolled(input: { customerId: string; providerContactId: string; voipCampaignId: string; attributeHash: string })` (field rename `cloudtalkContactId` → `providerContactId`).
  - `listVoipContactFields()` (was `listVoipContactAttributes`) → rows `{ appKey, providerFieldId, providerFieldLabel }`.
  - `upsertContactFieldByAppKey(input: { appKey: string; providerFieldId: string; providerFieldLabel: string })` (was `upsertAttributeByAppKey`).
  - `findActiveEnrollment` / `findSmsCadenceContextByProviderContactId` / `resolveCustomerByProviderContactId` return `providerContactId` (rename the `cloudtalkContactId`/`ctMembershipTag` fields they projected).

- [ ] **Step 1: Rename the entity directory**

`git mv src/shared/entities/voip-contact-attributes src/shared/entities/voip-contact-fields`

- [ ] **Step 2: Update column references (mechanical)**

In the three DAL folders, replace every reference:
- `voipContactAttributes` → `voipContactFields`; `ctAttributeId` → `providerFieldId`; `ctTitle` → `providerFieldLabel`.
- `cloudtalkContactId` → `providerContactId`.
- `ctCampaignId`→`providerCampaignId`, `ctCampaignName`→`providerCampaignName`, `ctStatus`→`status`; **remove** any select of `ctMembershipTag`/`ctTagId`; add `dialerMode` to campaign selects/upserts.
- Rename exported fns: `upsertCampaignByCtId`→`upsertCampaignByProviderId`, `upsertAttributeByAppKey`→`upsertContactFieldByAppKey`, `listVoipContactAttributes`→`listVoipContactFields`, `findSmsCadenceContextByCtContactId`→`findSmsCadenceContextByProviderContactId`, `resolveCustomerByCtContactId`→`resolveCustomerByProviderContactId`.

Discover all references first:
```bash
grep -rn "cloudtalkContactId\|ctAttributeId\|ctTitle\|ctCampaignId\|ctMembershipTag\|ctStatus\|voipContactAttributes\|upsertCampaignByCtId\|upsertAttributeByAppKey\|listVoipContactAttributes\|ByCtContactId" src/shared/entities
```

- [ ] **Step 3: Typecheck the entities**

Run: `pnpm tsc`
Expected: entity DAL errors resolved; remaining errors now only in services/router (Tasks 12–15) and the `resolve-customer`/`unenroll-reason` libs (Task 12).

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/voip-contact-fields src/shared/entities/voip-campaigns src/shared/entities/voip-campaign-contacts
git commit -m "refactor(voip): entity DAL to provider-neutral columns + field rename"
```

---

## Task 12: Rewire `enrollment.service` to the neutral provider

**Files:**
- Modify: `src/shared/services/voip/campaigns/enrollment.service.ts`
- Modify: `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts` (rename → build neutral fields) and `lib/resolve-customer.ts`, `lib/unenroll-reason.ts` if they reference `ct*`

**Interfaces:**
- Consumes: `dialerProvider` (Task 7), `listVoipContactFields`, reshaped campaign row (`providerCampaignId`, `dialerMode`), `upsertEnrolled({ providerContactId })`.
- Produces: `campaignEnrollmentService.enroll` returns `{ enrolled: true, providerContactId: string }`.

- [ ] **Step 1: Edit `enrollment.service.ts`**

Replace the CloudTalk block (lines ~166–189 in the current file) and imports:

```ts
// imports: drop cloudtalkClient + CloudtalkContactAttributeAppKey; add:
import { dialerProvider } from '@/shared/services/voip/dialer'
import { listVoipContactFields } from '@/shared/entities/voip-contact-fields/dal/server/queries'
// buildContactAttributes → buildNeutralFields (returns { fields: NeutralField[], attributeHash })

// build the field-id map from the synced bridge:
const fieldsResult = await listVoipContactFields()
if (!fieldsResult.success) return fieldsResult
const providerFieldIdByKey: Record<string, string> = {}
const labelByKey: Record<string, string> = {}
for (const row of fieldsResult.data) { providerFieldIdByKey[row.appKey] = row.providerFieldId; labelByKey[row.appKey] = row.providerFieldLabel }
const { fields, attributeHash } = buildNeutralFields({
  leadSourceSlug: leadSource.slug,
  interestedTradesRaw: customer.attribution?.captureJSON?.interestedTradesRaw,
  name: customer.name, city: customer.city, zip: customer.zip,
  leadCreatedAt: customer.createdAt,
  providerFieldIdByKey,
})

// provider push (replaces upsertContact + addTags):
let providerContactId: string
try {
  const enrolled = await dialerProvider.enroll({
    providerCampaignId: campaign!.providerCampaignId,
    phoneE164, name: customer.name, fields,
  })
  providerContactId = enrolled.providerContactId
}
catch (err) {
  console.error('[enrollment] JustCall enroll failed', { customerId: input.customerId, err: err instanceof Error ? err.message : String(err) })
  return reject('provider_api_failure') // enum literal renamed in Task 13
}

// persist:
const written = await upsertEnrolled({ customerId: input.customerId, providerContactId, voipCampaignId: campaign!.id, attributeHash })
// ...
return dalSuccess({ enrolled: true, providerContactId })
```

Update `unenroll` + `switchCampaign` to call `dialerProvider.unenroll({ providerCampaignId: <campaign.providerCampaignId>, providerContactId: active.providerContactId })` and `dialerProvider.switchCampaign(...)` — the membership-tag reads are gone; read `providerCampaignId` off the campaign row instead. (The lead-note push is dropped — JustCall has no contact-note API at go-live; note this in the research doc.)

> Note the ordering wrinkle: this task's `catch` block already emits `reject('provider_api_failure')`, but the enum literal isn't renamed until Task 13. If you run `pnpm tsc` at the end of this task in isolation it will flag the unknown reject reason. Either (a) do Task 13 Step 3's enum rename first, or (b) accept the single known tsc error here and clear it in Task 13. The batch checkpoint (Tasks 12–13 together) resolves it either way.

- [ ] **Step 2: Rename `build-contact-attributes.ts` → neutral-field builder**

`git mv .../lib/build-contact-attributes.ts .../lib/build-neutral-fields.ts`; change its output from `{ attributeId, value }[]` to `NeutralField[]` (attach `providerFieldId` from `providerFieldIdByKey[appKey]` and `label`), keep the `attributeHash` computation identical.

- [ ] **Step 3: Verify (batched with Task 13 — see note above)**

Run: `pnpm tsc`
Expected: enrollment wired; the only remaining errors are the reject-reason enum (Task 13 Step 3) and the sync/cadence/router/webhook files (Tasks 13–15).

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/voip/campaigns/enrollment.service.ts src/shared/services/voip/campaigns/lib/build-neutral-fields.ts
git commit -m "refactor(enrollment): push leads via neutral dialerProvider"
```

---

## Task 13: Rewire `campaign-sync` + `sms-cadence` + rename the exit-reason enum literal

**Files:**
- Modify: `src/shared/services/voip/campaigns/campaign-sync.service.ts`
- Modify: `src/shared/services/voip/campaigns/sms-cadence.service.ts`
- Modify: `src/shared/services/voip/campaigns/lib/eligibility.ts` (rename the `ct_api_failure` reject reason → `provider_api_failure`)

**Interfaces:**
- Consumes: `dialerProvider.listCampaigns()`, `dialerProvider.listContactFields()`, `dialerProvider.sendSms(...)`, `CanonicalDialerEvent` (`call.ended` shape), `findSmsCadenceContextByProviderContactId`.
- Produces: `campaignSyncService.resyncDialer(ctx)` (renamed) → `ResyncResult { campaignsSynced; campaignsSkipped; fieldsSynced; fieldsSkipped }`; `smsCadenceService.handleCallEnded(event: Extract<CanonicalDialerEvent, { type: 'call.ended' }>)`.

- [ ] **Step 1: Rewrite `campaign-sync.service.ts`**

```ts
import { dalSuccess } from '@/shared/dal/server/types'
import { upsertCampaignByProviderId } from '@/shared/entities/voip-campaigns/dal/server/mutations'
import { upsertContactFieldByAppKey } from '@/shared/entities/voip-contact-fields/dal/server/mutations'
import { dialerProvider } from '@/shared/services/voip/dialer'
// map JustCall field label → our app_key (Lead Source → lead_source, etc.)
import { mapFieldLabelToAppKey } from './lib/field-label-map' // renamed from attribute-title-map

// resyncDialer: pull campaigns + custom fields, upsert the identity bridges.
// Campaigns sync with their dialer_mode + status; fields map label→app_key→id.
async resyncDialer(_ctx) {
  let campaignsSynced = 0, campaignsSkipped = 0, fieldsSynced = 0, fieldsSkipped = 0
  for (const c of await dialerProvider.listCampaigns()) {
    const r = await upsertCampaignByProviderId({
      providerCampaignId: c.providerCampaignId, providerCampaignName: c.name,
      status: c.status, dialerMode: c.dialerMode,
    })
    r.success ? campaignsSynced++ : campaignsSkipped++
  }
  for (const f of await dialerProvider.listContactFields()) {
    const appKey = mapFieldLabelToAppKey(f.label ?? f.appKey)
    if (!appKey || !f.providerFieldId) { fieldsSkipped++; continue }
    const r = await upsertContactFieldByAppKey({ appKey, providerFieldId: f.providerFieldId, providerFieldLabel: f.label ?? appKey })
    r.success ? fieldsSynced++ : fieldsSkipped++
  }
  return dalSuccess({ campaignsSynced, campaignsSkipped, fieldsSynced, fieldsSkipped })
}
```

Rename `lib/attribute-title-map.ts` → `lib/field-label-map.ts` (`mapAttributeTitleToAppKey` → `mapFieldLabelToAppKey`), same body.

- [ ] **Step 2: Rewrite `sms-cadence.service.ts` signature + provider call**

```ts
import type { CanonicalDialerEvent } from '@/shared/services/voip/dialer/types'
import { dialerProvider } from '@/shared/services/voip/dialer'
import { findSmsCadenceContextByProviderContactId } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

async handleCallEnded(event: Extract<CanonicalDialerEvent, { type: 'call.ended' }>): Promise<void> {
  if (event.direction && event.direction !== 'outbound') return
  const providerContactId = event.providerContactId
  if (!providerContactId) return
  const ctxResult = await findSmsCadenceContextByProviderContactId(providerContactId)
  // ...unchanged gates + decideCadenceSms + renderSmsTemplate...
  const fromE164 = event.fromNumberE164
  if (!fromE164) { /* warn + return */ }
  const sent = await dialerProvider.sendSms({ fromNumberE164: fromE164, toE164: toE164Number, body: text })
  if (sent.providerMessageId) await recordAutoSmsSent(ctx.customerId)
}
```

Replace `event.call_uuid` → `event.callUuid` and `event.internal_number_e164` → `event.fromNumberE164` throughout. `claimAndIncrementDialAttempt(ctx.customerId, event.callUuid)`.

- [ ] **Step 3: Rename the reject-reason literal**

In `lib/eligibility.ts` `EnrollmentRejectReason`, rename `ct_api_failure` → `provider_api_failure`; confirm the two `reject('provider_api_failure')` sites in `enrollment.service.ts` (Task 12) now typecheck.

- [ ] **Step 4: Verify**

Run: `pnpm tsc`
Expected: enrollment + sync + cadence clean; remaining errors only in the old CloudTalk webhook route (deleted in Task 18) and the new route (Task 14) + router (Task 15).

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/voip/campaigns/campaign-sync.service.ts src/shared/services/voip/campaigns/sms-cadence.service.ts src/shared/services/voip/campaigns/lib/field-label-map.ts src/shared/services/voip/campaigns/lib/eligibility.ts
git commit -m "refactor(voip): sync + cadence services on neutral dialerProvider"
```

---

## Task 14: New JustCall webhook route

**Files:**
- Create: `src/app/api/webhooks/justcall/route.ts`

**Interfaces:**
- Consumes: `justcallWebhookAdapter` (Task 9), `justcallDispositionToUnenrollReason` (Task 3), the reacting services (`campaignEnrollmentService`, `complianceService`, `smsCadenceService`), `resolveCustomerByProviderContactId`, `resolveCustomerByPhone`, `isStopKeyword`.

- [ ] **Step 1: Write the route** (mirrors the CloudTalk route's control flow; canonical events)

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { justcallDispositionToUnenrollReason } from '@/shared/services/providers/justcall/constants'
import { justcallWebhookAdapter } from '@/shared/services/providers/justcall/webhooks/adapter'
import { notifyLastInteractingAgentJob } from '@/shared/services/providers/upstash/jobs/notify-last-interacting-agent'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'
import { isStopKeyword } from '@/shared/services/voip/campaigns/lib/is-stop-keyword'
import { resolveCustomerByPhone, resolveCustomerByProviderContactId } from '@/shared/services/voip/campaigns/lib/resolve-customer'
import { smsCadenceService } from '@/shared/services/voip/campaigns/sms-cadence.service'
import { complianceService } from '@/shared/services/voip/compliance.service'

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text()
  if (!justcallWebhookAdapter.verify(req, rawBody)) return new Response('unauthorized', { status: 401 })
  const event = justcallWebhookAdapter.parse(rawBody)
  if (!event) return new Response('bad request', { status: 400 })

  try {
    switch (event.type) {
      case 'sms.received': {
        if (isStopKeyword(event.text)) {
          const customer = await resolveCustomerByPhone(event.fromE164)
          if (customer) {
            await complianceService.addToDnc({ customerId: customer.id, reason: 'stop_keyword', addedByUserId: null })
            await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, { customerId: customer.id, reason: 'opted_out' })
          }
        } else {
          void notifyLastInteractingAgentJob.dispatch({ customerPhoneE164: event.fromE164, body: event.text })
        }
        break
      }
      case 'call.disposition_set': {
        const reason = justcallDispositionToUnenrollReason(event.disposition)
        if (reason) {
          const customer = await resolveCustomerByProviderContactId(event.providerContactId ?? '')
          if (customer) {
            if (reason === 'opted_out') await complianceService.addToDnc({ customerId: customer.id, reason: 'stop_keyword', addedByUserId: null })
            await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, { customerId: customer.id, reason })
          }
        }
        break
      }
      case 'call.ended': {
        await smsCadenceService.handleCallEnded(event)
        break
      }
    }
  } catch (err) {
    console.error('[justcall webhook] handler error — 200 to avoid retry storm', { type: event.type, err: err instanceof Error ? err.message : String(err) })
  }
  return Response.json({ ok: true })
}
```

> Confirm the exact import paths/signatures of `resolveCustomerByPhone`, `resolveCustomerByProviderContactId`, `isStopKeyword`, `complianceService.addToDnc`, and `notifyLastInteractingAgentJob` against the current CloudTalk route (`src/app/api/webhooks/cloudtalk/route.ts`) before writing — this route is a like-for-like port of its control flow onto canonical events.

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean (the old CloudTalk route may still typecheck against its own symbols — it is deleted in Task 18).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/justcall/
git commit -m "feat(justcall): inbound webhook route (disposition/DNC/cadence)"
```

---

## Task 15: Update the tRPC admin router

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts`
- Modify: `src/features/campaigns-admin/**` (if it references the renamed procedure)

**Interfaces:**
- Consumes: `campaignSyncService.resyncDialer`, `listVoipContactFields`, reshaped campaign fields.

- [ ] **Step 1: Rename the procedure + calls**

- `resyncFromCloudtalk: superAdminProcedure...` → `resyncDialer: superAdminProcedure.mutation(async ({ ctx }) => dalToTrpc(await campaignSyncService.resyncDialer(ctx)))`.
- Replace `listVoipContactAttributes` import + call → `listVoipContactFields`.
- Update the not-active error copy (line ~30) from `"...not active in CloudTalk..."` → `"That campaign is not active — resync or pick another."`
- Any campaign field reads (`ctStatus`, `ctMembershipTag`) → `status` / (drop tag).

Discover call-sites: `grep -rn "resyncFromCloudtalk\|listVoipContactAttributes\|ctStatus\|ctMembershipTag\|CloudTalk" src/trpc src/features`

- [ ] **Step 2: Update the frontend caller** (if `resyncFromCloudtalk` is referenced)

In `src/features/campaigns-admin/**`, rename the tRPC call `resyncFromCloudtalk` → `resyncDialer` and any user-facing "CloudTalk" copy → "dialer"/"JustCall". Confirm with the grep above.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean **except** the still-present old CloudTalk files (removed in Task 18). If the old CloudTalk webhook route imports now-renamed symbols, that's expected — it's deleted next task.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts src/features/campaigns-admin
git commit -m "refactor(voip): rename resync procedure + neutral admin copy"
```

---

## Task 16: Docs — research capture + setup runbook + DOCS.md

**Files:**
- Create: `docs/plans/voip-campaigns/justcall-api-research.md`
- Create: `docs/plans/voip-campaigns/justcall-setup-runbook.md`
- Create: `src/shared/services/providers/justcall/DOCS.md`
- Modify: `docs/plans/voip/INTEGRATION-SEAM.md`, `docs/plans/voip-campaigns/EPIC.md`

**Interfaces:** none (docs).

- [ ] **Step 1: Write `justcall-api-research.md`** — the verified facts: base URL, confirmed auth encoding (Task 1 result), Sales Dialer endpoints used (`campaigns/contact`, remove, `texts/new`, `campaigns`, contact fields), tiers/dialer-mode matrix, webhook events + HMAC formula, rate limits (confirmed value), and the **known gaps** (no contact-note API; disposition on `*_updated`; custom-field IDs are numeric/pre-created; predictive/dynamic tier gating; Pro trial-persistence question).

- [ ] **Step 2: Write `justcall-setup-runbook.md`** — dashboard steps: create API key; create Bina's **Dynamic** campaign + assign dispatcher agents; create Autodial campaigns for other sources; create the 4 custom fields (`Lead Source`, `Primary Trade`, `Trades Interested`, `Lead Created At`); register the webhook URL `https://voip.triprosremodeling.com/api/webhooks/justcall` for `sd.call_completed` + `sd.call_updated` + `sms.received`; run `resyncDialer`; verify `voip_campaigns` + `voip_contact_fields` populated; bind each campaign to its lead source (`lead_sources.default_campaign_id`). Include the **trial-persistence check** as a required confirmation step.

- [ ] **Step 3: Write `providers/justcall/DOCS.md`** — the superset-client convention, seam rules, HMAC verification, and the "enroll = explicit campaign_id" model.

- [ ] **Step 4: Update INTEGRATION-SEAM.md + EPIC.md** — repoint the provider-swap section + webhook table to JustCall; mark CloudTalk retired; note the stale `source='cloudtalk'` discriminator section was already superseded 2026-06-04.

- [ ] **Step 5: Commit**

```bash
git add docs/plans/voip-campaigns/justcall-api-research.md docs/plans/voip-campaigns/justcall-setup-runbook.md src/shared/services/providers/justcall/DOCS.md docs/plans/voip/INTEGRATION-SEAM.md docs/plans/voip-campaigns/EPIC.md
git commit -m "docs(justcall): API research, setup runbook, provider DOCS, seam update"
```

---

## Task 17: Enable Bina + live validation

**Files:** none (config + validation via existing admin surface). **Needs the live JustCall account.**

**Interfaces:** none.

- [ ] **Step 1: Provision JustCall per the runbook** (dashboard: key, Bina Dynamic campaign + agents, 4 fields, webhook URL). Set `JUSTCALL_API_KEY` + `JUSTCALL_API_SECRET` in the deploy env + local `.env.local`.

- [ ] **Step 2: Run `resyncDialer`** from the admin UI; verify `voip_campaigns` has Bina with `dialer_mode='dynamic'`, `status='active'`, and `voip_contact_fields` has all 4 rows with `provider_field_id` set.

- [ ] **Step 3: Bind + enable Bina only** — set `lead_sources.default_campaign_id` to Bina's campaign and flip its policy (`voipCampaignsEnabled` + `voipAutoEnroll`). Leave other sources disabled.

- [ ] **Step 4: Live smoke** — with `pnpm dev:mobile` (QStash needs the tunnel — memory: qstash-hooks-need-tunnel), ingest a Bina test lead; confirm: (a) `voip_campaign_contacts` row written with `provider_contact_id`; (b) the contact appears in the JustCall campaign; (c) a signed test webhook to `/api/webhooks/justcall` drives unenroll + cadence. This is where the provisional webhook signature recipe (Task 8) and payload key names (Task 8/9) get confirmed against the real API — adjust and re-commit those files if the live request differs, and record the confirmed shapes in `justcall-api-research.md`.

- [ ] **Step 5: Roll remaining sources** one at a time (Autodial campaigns), repeating Steps 2–4 per source.

---

## Task 18: Delete CloudTalk

Final step — tree stays green throughout because nothing references CloudTalk after Task 15.

**Files:**
- Delete: `src/shared/services/providers/cloudtalk/**`
- Delete: `src/app/api/webhooks/cloudtalk/**`
- Delete: `src/app/api/voip/routing/**` (Phase-0 mid-call mocks)
- Modify: `src/shared/config/server-env.ts` (remove CloudTalk fragment/meta + `CLOUDTALK_*`), remove any CloudTalk `.env` keys

**Interfaces:** none.

- [ ] **Step 1: Confirm zero references**

Run: `grep -rn "cloudtalk\|Cloudtalk\|CloudTalk\|CLOUDTALK" src/ | grep -v "docs/"`
Expected: only matches inside the files about to be deleted. If anything else matches, fix it before deleting.

- [ ] **Step 2: Delete the CloudTalk files + env**

```bash
git rm -r src/shared/services/providers/cloudtalk src/app/api/webhooks/cloudtalk src/app/api/voip/routing
```
Remove from `server-env.ts`: the `cloudtalk*` import (line ~8), the `...cloudtalkEnvFragment.shape` spread (~144), `cloudtalkConfigMeta` (~222), and the `CLOUDTALK_*` comment lines (~108–115).

- [ ] **Step 3: Full verify**

Run: `pnpm tsc && pnpm lint`
Expected: fully clean.

- [ ] **Step 4: Commit**

```bash
git add -u && git add src/shared/config/server-env.ts
git commit -m "chore(cloudtalk): remove provider, webhook route, mid-call mocks + env"
```

> Optional prod cleanup: after JustCall is live on all sources, truncate the inert legacy rows in `voip_campaign_contacts` (CloudTalk contact ids) and drop the removed `CLOUDTALK_*` env vars from the deploy environment.

---

## Self-Review

**Spec coverage:**
- §2 architecture (interface + provider + adapter) → Tasks 4, 7, 9. ✅
- §3 `DialerProvider` contract → Task 4; JustCall impl → Tasks 5–7. ✅
- §3 WebhookAdapter + disposition-split → Tasks 8–9 (`call.disposition_set` only emitted when `sd.call_updated` carries a disposition; `sd.call_completed` → `call.ended`). ✅
- §4 schema reshape (rename/drop/add, table rename) → Tasks 10–11. ✅
- §5 flows A/B/C → enroll (Task 12), cadence (Task 13), sync (Task 13). ✅
- §6 config/secrets → Task 2; §7 error handling → carried in Tasks 6/12/14 (429 retry, 200-on-error, unresolved-field non-fatal). ✅
- §8 risks → Task 1 (auth), Task 6/16 (rate limit), Task 17/16 (trial persistence). ✅
- §9 verification → `pnpm tsc` + `pnpm lint` per task (no test suite in this repo); runtime behavior proven by the Task 17 live smoke + throwaway `scripts/tmp-*.ts` probes where needed. ✅
- §10 rollout → Tasks 17–18. §11 docs → Task 16. ✅

**Verification model:** This repo has no unit-test framework; the original TDD steps were removed. Each task ends with `pnpm tsc` + `pnpm lint`. The two behaviors that can't be typechecked — the auth-header encoding and the webhook HMAC/payload shapes — are proven by live probes (Task 1) and the live smoke (Task 17), which is the correct and only place they can be confirmed against JustCall.

**Placeholder scan:** endpoint paths for remove-contact / texts / fields carry an explicit "confirm against developer.justcall.io" note (Task 6) rather than an unverified assertion; disposition label strings are flagged to fix in the runbook (Task 3/16); the webhook signature recipe is flagged provisional until Task 17. No "TBD/implement later" left.

**Type consistency:** `providerContactId` (string), `providerCampaignId` (string), `dialerMode` (`DialerMode`), `NeutralField.providerFieldId` (string) used consistently across client → provider → services → schema. `resyncDialer`, `listVoipContactFields`, `upsertCampaignByProviderId`, `findSmsCadenceContextByProviderContactId` names match between producing task and consuming task. Canonical event field names (`callUuid`, `fromNumberE164`, `providerContactId`) consistent between Task 4, Task 9, Task 13. The `provider_api_failure` reject literal is emitted in Task 12 and defined in Task 13 — flagged as a cross-task ordering note in Task 12.

---

## Execution — Inline, Batched with Checkpoints

Per user direction (2026-08-19): **inline execution, HITL checkpoints.** No test suite — verify with `pnpm tsc` + `pnpm lint`. At each checkpoint, report the files touched (`git diff --name-status`) and pause for review before continuing.

**Batches:**
1. **Provider foundation (Tasks 2–4)** — config, constants, neutral interface. *(Task 1 auth spike deferred: needs live key.)* → checkpoint.
2. **JustCall client stack (Tasks 5–7)** — schemas, REST client, provider impl + seam binding. → checkpoint.
3. **Webhook stack (Tasks 8–9)** — event schemas/HMAC, adapter. → checkpoint.
4. **Schema + DAL (Tasks 10–11)** — reshape migration, entity DAL renames, `db:push:dev`. → checkpoint.
5. **Service rewire (Tasks 12–13)** — enrollment, sync, cadence, enum rename. → checkpoint.
6. **Route + router (Tasks 14–15)** — new webhook route, tRPC admin rename. → checkpoint.
7. **Docs (Task 16)** — research, runbook, DOCS, seam update. → checkpoint.
8. **Go-live (Tasks 17) + cleanup (Task 18)** — user-driven provisioning + live smoke, then CloudTalk deletion. → final checkpoint.

**Blocked-on-user:** Task 1 (auth encoding — needs a live JustCall key) and Task 17 (provisioning + live smoke). Everything else is buildable now; the client's auth header defaults to the documented `api_key:api_secret` and is a one-line swap if Task 1 later shows Basic.
