import type { z } from 'zod'
import type { JcAddContactToCampaignResponse } from './schemas/campaign-contact'
import type { JcCampaignListResponse } from './schemas/campaign-list'
import type { JcContactFieldsResponse } from './schemas/fields'
import type { JcSmsResponse } from './schemas/sms'

import { JUSTCALL_BASE_URL, JUSTCALL_MAX_RETRIES } from './constants'
import { getJustcallConfig } from './lib/config'
import { jcAddContactToCampaignResponseSchema } from './schemas/campaign-contact'
import { jcCampaignListResponseSchema } from './schemas/campaign-list'
import { jcContactFieldsResponseSchema } from './schemas/fields'
import { jcSmsResponseSchema } from './schemas/sms'

// ---------------------------------------------------------------------------
// justcallClient — the single, uniform entry point for every JustCall Sales
// Dialer interaction. Same pattern as `twilioClient` and every other
// provider: ONE factory → ONE singleton → ALL methods hanging off it.
//
//   import { justcallClient } from '@/shared/services/providers/justcall/client'
//   await justcallClient.addContactToCampaign({ campaignId, phoneE164, customFields })
//
// The provider is a leaf — methods accept primitives + scalar shapes and return
// primitives. NO app-domain types in signatures. JustCall-specific shapes never
// cross the DialerProvider line; the mapping to neutral shapes lives in
// `dialer-provider.ts`. See `DOCS.md`.
//
// Auth: `Authorization: api_key:api_secret` — raw colon-joined, NOT base64 Basic.
// Verified against developer.justcall.io/reference/authentication (2026-08-19).
// JustCall has no envelope-unwrap step (unlike CloudTalk's `responseData`);
// responses are `{ status, data }` shaped directly.
// ---------------------------------------------------------------------------

export class JustcallApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: string,
  ) {
    super(`JustCall ${status} on ${path}: ${body}`)
    this.name = 'JustcallApiError'
  }
}

export class JustcallResponseValidationError extends Error {
  constructor(
    public path: string,
    public issues: unknown,
  ) {
    super(`JustCall response failed zod validation on ${path}`)
    this.name = 'JustcallResponseValidationError'
  }
}

function buildAuthHeader(): string {
  const { apiKey, apiSecret } = getJustcallConfig()
  // Raw colon-joined, per the official v2.1 auth docs (verified 2026-08-19).
  return `${apiKey}:${apiSecret}`
}

interface RequestOptions<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  query?: Record<string, string | number | undefined>
  body?: unknown
  schema?: TSchema
}

async function request<TResponse>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<TResponse> {
  const url = new URL(`${JUSTCALL_BASE_URL}${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) {
      url.searchParams.set(k, String(v))
    }
  }

  const init: RequestInit = {
    method,
    headers: {
      'Authorization': buildAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }

  let attempt = 0

  while (true) {
    attempt += 1
    const res = await fetch(url.toString(), init)

    if (res.status === 429 && attempt < JUSTCALL_MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '2')
      const backoffMs = Math.max(retryAfter, 1) * 1000 + 250 * attempt
      console.warn('[justcall] 429 throttled', { path, attempt, backoffMs })
      await new Promise(r => setTimeout(r, backoffMs))
      continue
    }

    if (!res.ok) {
      throw new JustcallApiError(res.status, path, await res.text())
    }

    // Some endpoints (DELETE-like removes) return an empty body.
    const text = await res.text()
    if (!text) {
      return undefined as TResponse
    }

    const parsed = JSON.parse(text)
    if (opts.schema) {
      const result = opts.schema.safeParse(parsed)
      if (!result.success) {
        console.error('[justcall] response validation failed', { path, issues: result.error.issues })
        throw new JustcallResponseValidationError(path, result.error.issues)
      }
      return result.data as TResponse
    }
    return parsed as TResponse
  }
}

// ── Method input interfaces ─────────────────────────────────────────────────

interface AddContactToCampaignInput {
  campaignId: string
  phoneE164: string
  name?: string
  email?: string
  customFields: { id: number, value: string }[]
}

interface RemoveContactFromCampaignInput {
  campaignId: string
  contactId: string
}

interface SendSmsInput {
  fromE164: string
  toE164: string
  body: string
}

function createJustcallClient() {
  return {
    /**
     * Upsert a contact into a Sales Dialer campaign (keyed on phone). This IS
     * the enrollment mechanism — replaces CloudTalk's tag idiom. Returns the
     * JustCall contact id (stringified).
     *
     * NEVER call from a route handler directly — go through the neutral
     * `dialerProvider` binding + `enrollment.service` so the compliance +
     * per-source gates fire first.
     */
    async addContactToCampaign(input: AddContactToCampaignInput): Promise<{ contactId: string }> {
      const res = await request<JcAddContactToCampaignResponse>('POST', '/sales_dialer/campaigns/contact', {
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

    /**
     * Remove a contact from a campaign (unenroll). Verified against
     * developer.justcall.io: `DELETE /v2.1/sales_dialer/campaigns/contact` with
     * `campaign_id` + `contact_id` as QUERY params (not a JSON body). Returns
     * `{ status: 'success' }`; we ignore the body.
     */
    async removeContactFromCampaign(input: RemoveContactFromCampaignInput): Promise<void> {
      await request('DELETE', '/sales_dialer/campaigns/contact', {
        query: { campaign_id: Number(input.campaignId), contact_id: Number(input.contactId) },
      })
    },

    /**
     * Send an outbound SMS. Wire fields: justcall_number = from, contact_number
     * = to, body = message. NEVER call from a route handler directly — go
     * through the cadence service so the STOP/compliance gates fire first.
     */
    async sendSms(input: SendSmsInput): Promise<{ messageId: string }> {
      const res = await request<JcSmsResponse>('POST', '/texts/new', {
        body: { justcall_number: input.fromE164, contact_number: input.toE164, body: input.body },
        schema: jcSmsResponseSchema,
      })
      return { messageId: String(res.data.id) }
    },

    /**
     * List Sales Dialer campaigns. Used by the admin Resync mutation to populate
     * `voip_campaigns`. Paginates — advances `page` until a short page returns.
     */
    async listCampaigns(): Promise<{ id: string, name: string, type: string, status?: string }[]> {
      const out: { id: string, name: string, type: string, status?: string }[] = []
      let page = 0
      while (true) {
        const res = await request<JcCampaignListResponse>('GET', '/sales_dialer/campaigns', {
          query: { page, per_page: 100 },
          schema: jcCampaignListResponseSchema,
        })
        for (const c of res.data) {
          out.push({ id: String(c.id), name: c.name, type: c.type, status: c.status })
        }
        if (res.data.length < 100) {
          break
        }
        page += 1
      }
      return out
    },

    /**
     * List Sales Dialer custom-field definitions. Verified path:
     * `GET /v2.1/sales_dialer/contacts/custom-fields`, returning
     * `data:[{ key, label, type }]`. We normalize `key`→`id` (the numeric id
     * enroll needs in `custom_fields:[{id,value}]`) and `label`→`name` so the
     * resync service's label→app_key mapping stays provider-agnostic.
     */
    async listContactFields(): Promise<{ id: number, name: string }[]> {
      const res = await request<JcContactFieldsResponse>('GET', '/sales_dialer/contacts/custom-fields', {
        schema: jcContactFieldsResponseSchema,
      })
      return res.data.map(f => ({ id: f.key, name: f.label }))
    },
  }
}

export type JustcallClient = ReturnType<typeof createJustcallClient>

/**
 * The single JustCall entry point. Import this — and only this — to interact
 * with JustCall from the provider layer. See file header + `DOCS.md`.
 */
export const justcallClient = createJustcallClient()
