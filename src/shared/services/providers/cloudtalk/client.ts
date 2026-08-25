import type { z } from 'zod'
import type { CloudtalkHost, CloudtalkTagName } from './constants'
import type { CtBulkContactOp } from './schemas/bulk'
import type {
  CloudtalkCall,
  CloudtalkContact,
  CtCampaign,
  CtContactAttributeDefinition,
} from './types'

import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

import {
  CLOUDTALK_BULK_MAX_OPS_PER_REQUEST,
  CLOUDTALK_HOSTS,
  CLOUDTALK_MAX_RETRIES,
  CLOUDTALK_RATE_LIMIT_WARN_THRESHOLD,
} from './constants'
import { getCloudtalkConfig, isCloudtalkConfigured } from './lib/config'
import { ctBulkContactsResponseSchema } from './schemas/bulk'
import { ctCallListResponseSchema, ctCallSchema } from './schemas/call'
import {
  ctCampaignEditResponseSchema,
  ctCampaignListResponseSchema,
} from './schemas/campaign'
import {
  ctAttributesListResponseSchema,
  ctContactAddResponseSchema,
  ctContactListResponseSchema,
  ctContactShowResponseSchema,
  ctContactTagsResponseSchema,
  ctNoteAddResponseSchema,
} from './schemas/contact'

// ---------------------------------------------------------------------------
// cloudtalkClient — the single, uniform entry point for every CloudTalk
// interaction.
//
// Pattern (matches `twilioClient`, `zohoSignClient`, and every other provider
// in the codebase): ONE factory → ONE singleton → ALL methods hanging off it.
// Callers do:
//
//   import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'
//   await cloudtalkClient.upsertContact({ phoneE164, name, attributes })
//   await cloudtalkClient.addTags({ contactId, tags: ['Lead', 'Campaign-MetaAds'] })
//   const ok = cloudtalkClient.verifyWebhookSecret({ url: req.url })
//
// Never `import { upsertContact } from '...../lib/contacts'`. The client is a
// "superset of the raw CT REST surface" — it exposes the REST surface we use
// AND the local CT-ecosystem helpers (webhook-secret verification) under the
// same uniform import. One mental model, one tab-complete surface per provider.
// See `DOCS.md#superset-client`.
//
// The provider is still a leaf — methods accept primitives + scalar shapes
// and return primitives + CT-domain shapes. NO app-domain types in signatures
// (no `Customer`). Mapping from CT shapes to app intent happens in
// `services/voip/campaigns/*`. (There is no local campaign-status enum — CT
// owns lifecycle; `VoipCampaignStatus` was deleted 2026-06-04.)
//
// SDK strategy: hand-typed zod schemas (LOCKED 2026-05-31). `@hey-api/openapi-ts`
// errors on CT's swagger; Probes 1–4 documented in ./README.md. Do not retry.
// ---------------------------------------------------------------------------

export class CloudtalkApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: string,
  ) {
    super(`CloudTalk ${status} on ${path}: ${body}`)
    this.name = 'CloudtalkApiError'
  }
}

export class CloudtalkResponseValidationError extends Error {
  constructor(
    public path: string,
    public issues: unknown,
  ) {
    super(`CloudTalk response failed zod validation on ${path}`)
    this.name = 'CloudtalkResponseValidationError'
  }
}

interface RequestOptions<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  host?: CloudtalkHost
  query?: Record<string, string | number | undefined>
  body?: unknown
  // Optional zod schema to validate the (post-envelope-unwrap) response body.
  // When omitted, the raw unwrapped payload is returned untyped.
  schema?: TSchema
}

interface CloudtalkEnvelope<T> {
  responseData: T
}

function buildAuthHeader(): string {
  const { accessKeyId, accessKeySecret } = getCloudtalkConfig()
  const token = Buffer
    .from(`${accessKeyId}:${accessKeySecret}`)
    .toString('base64')
  return `Basic ${token}`
}

function buildUrl(host: CloudtalkHost, path: string, query?: RequestOptions['query']): string {
  const base = CLOUDTALK_HOSTS[host]
  // We don't auto-append `.json` — caller's responsibility (since one
  // endpoint, `GET /calls/{callId}`, intentionally omits it).
  const url = new URL(`${base}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) {
        url.searchParams.set(k, String(v))
      }
    }
  }
  return url.toString()
}

async function request<TResponse>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<TResponse> {
  const host = opts.host ?? 'default'
  const url = buildUrl(host, path, opts.query)
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
    const res = await fetch(url, init)

    const remaining = res.headers.get('X-CloudTalkAPI-Remaining')
    if (remaining !== null && Number(remaining) <= CLOUDTALK_RATE_LIMIT_WARN_THRESHOLD) {
      console.warn('[cloudtalk] rate-limit window low', { path, remaining })
    }

    if (res.status === 429 && attempt < CLOUDTALK_MAX_RETRIES) {
      const resetSec = Number(res.headers.get('X-CloudTalkAPI-ResetTime') ?? '5')
      const backoffMs = Math.max(resetSec, 1) * 1000 + 250 * attempt
      console.warn('[cloudtalk] 429 throttled', { path, attempt, backoffMs })
      await new Promise(r => setTimeout(r, backoffMs))
      continue
    }

    if (!res.ok) {
      const body = await res.text()
      throw new CloudtalkApiError(res.status, path, body)
    }

    // Some endpoints (DELETE, certain PUTs) return empty body.
    const text = await res.text()
    if (!text) {
      return undefined as TResponse
    }

    const parsed = JSON.parse(text) as CloudtalkEnvelope<unknown> | unknown
    const unwrapped
      = parsed !== null
        && typeof parsed === 'object'
        && 'responseData' in parsed
        && (parsed as CloudtalkEnvelope<unknown>).responseData !== undefined
        ? (parsed as CloudtalkEnvelope<unknown>).responseData
        : parsed

    if (opts.schema) {
      const result = opts.schema.safeParse(unwrapped)
      if (!result.success) {
        console.error('[cloudtalk] response validation failed', {
          path,
          issues: result.error.issues,
        })
        throw new CloudtalkResponseValidationError(path, result.error.issues)
      }
      return result.data as TResponse
    }

    return unwrapped as TResponse
  }
}

// ── Method input + output interfaces ────────────────────────────────────────

interface UpsertContactInput {
  phoneE164: string
  name: string
  city?: string
  zip?: string
  attributes?: { attributeId: string, value: string }[]
}

interface EditContactInput {
  contactId: string
  name: string
  city?: string
  zip?: string
  attributes?: { attributeId: string, value: string }[]
}

interface UpdateContactAttributesInput {
  contactId: string
  // Edit requires `name` per swagger — caller passes current name to satisfy
  // the required field. If unknown, fetch first via getContact.
  name: string
  attributes: { attributeId: string, value: string }[]
}

interface TagOpInput {
  contactId: string
  tags: string[]
}

interface SetCampaignStatusInput {
  campaignId: string
  status: 'active' | 'inactive'
}

interface SendSmsInput {
  fromE164: string
  toE164: string
  text: string
}

interface ListCallsInput {
  since?: Date
  limit?: number
}

interface ListContactsInput {
  // Free-text search (CT matches phone / email / name).
  keyword?: string
  page?: number
  limit?: number
}

interface BulkContactsInput {
  ops: CtBulkContactOp[]
}

interface VerifyWebhookSecretInput {
  // Full request URL including ?secret=... query. Reconstruct from req.url
  // at the route boundary.
  url: string
}

interface CampaignListRow {
  campaign: CtCampaign
  membershipTagName?: string
}

// ── Method bodies via internal helpers ──────────────────────────────────────

function createCloudtalkClient() {
  return {
    // -----------------------------------------------------------------------
    // REST — Contacts
    // -----------------------------------------------------------------------

    /**
     * Create or update a contact, keyed by phone. Pre-finds via
     * `findContactByPhone` — CT's `/contacts/add.json` does NOT de-dupe.
     *
     * NEVER call from a route handler directly — go through
     * `services/voip/campaigns/enrollment.service.ts` which runs the
     * compliance + per-source gates first.
     */
    async upsertContact(input: UpsertContactInput): Promise<{ contactId: string }> {
      const existing = await this.findContactByPhone(input.phoneE164)
      if (existing) {
        await this.editContact({
          contactId: existing.contactId,
          name: input.name,
          city: input.city,
          zip: input.zip,
          attributes: input.attributes,
        })
        return existing
      }

      const body = {
        name: input.name,
        city: input.city,
        zip: input.zip,
        ContactNumber: [{ public_number: input.phoneE164 }],
        ContactAttribute: (input.attributes ?? []).map(a => ({
          attribute_id: a.attributeId,
          value: a.value,
        })),
      }
      const res = await request<unknown>('PUT', '/contacts/add.json', {
        body,
        schema: ctContactAddResponseSchema,
      }) as { data: { id: string } }
      return { contactId: res.data.id }
    },

    /** Find a contact by phone number (E.164). Returns null if no match. */
    async findContactByPhone(phoneE164: string): Promise<{ contactId: string } | null> {
      const res = await request<unknown>('GET', '/contacts/index.json', {
        query: { keyword: phoneE164 },
        schema: ctContactListResponseSchema,
      }) as { data: { Contact: { id: string } }[] }
      const first = res.data[0]
      return first ? { contactId: first.Contact.id } : null
    },

    /** Fetch a contact by CT id. Returns null on 404. */
    async getContact(contactId: string): Promise<CloudtalkContact | null> {
      try {
        const res = await request<unknown>(
          'GET',
          `/contacts/show/${encodeURIComponent(contactId)}.json`,
          { schema: ctContactShowResponseSchema },
        ) as {
          Contact: { id: string, name?: string, city?: string }
          ContactNumber?: { public_number: string }[]
          ContactsTag?: { name: string }[]
          ContactAttribute?: { attribute_id: string, value: string }[]
        }
        const attributes: Record<string, string> = {}
        for (const a of res.ContactAttribute ?? []) {
          attributes[a.attribute_id] = a.value
        }
        return {
          contactId: res.Contact.id,
          phoneE164: res.ContactNumber?.[0]?.public_number ?? '',
          name: res.Contact.name ?? '',
          city: res.Contact.city,
          tags: (res.ContactsTag ?? []).map(t => t.name) as CloudtalkTagName[],
          attributes,
          updatedAt: new Date().toISOString(),
        }
      }
      catch (err) {
        if (err instanceof Error && err.message.includes('404')) {
          return null
        }
        throw err
      }
    },

    /**
     * Edit an existing contact (name + city + attributes). Caller supplies
     * `name` because CT's `/contacts/edit.json` requires it even on partial
     * edits.
     */
    async editContact(input: EditContactInput): Promise<void> {
      const body = {
        name: input.name,
        city: input.city,
        zip: input.zip,
        ContactAttribute: (input.attributes ?? []).map(a => ({
          attribute_id: a.attributeId,
          value: a.value,
        })),
      }
      await request(
        'POST',
        `/contacts/edit/${encodeURIComponent(input.contactId)}.json`,
        { body },
      )
    },

    /**
     * Update only contact attributes (no name/city change). Used by the
     * per-source delta-pusher when one of the 3 custom attributes drifts.
     */
    async updateContactAttributes(input: UpdateContactAttributesInput): Promise<void> {
      const body = {
        name: input.name,
        ContactAttribute: input.attributes.map(a => ({
          attribute_id: a.attributeId,
          value: a.value,
        })),
      }
      await request(
        'POST',
        `/contacts/edit/${encodeURIComponent(input.contactId)}.json`,
        { body },
      )
    },

    /**
     * Attach a Note to a contact — the "Notes" surface agents read on the CT
     * contact card (distinct from the Activities timeline). Used by enrollment
     * to push the lead-detail summary (trades + kitchen/bath detail).
     * Fire-and-forget: caller treats failure as non-fatal.
     * PUT /notes/add/{contactId}.json (swagger-verified).
     *
     * NOTE: CloudTalk flattens whitespace (newlines → spaces) and strips emoji
     * on store, so callers should pre-flatten multi-line text to an inline
     * single-line form before passing it here.
     */
    async addContactNote(
      input: { contactId: string, note: string },
    ): Promise<{ noteId: string | null }> {
      const res = await request<unknown>(
        'PUT',
        `/notes/add/${encodeURIComponent(input.contactId)}.json`,
        { body: { note: input.note }, schema: ctNoteAddResponseSchema },
      ) as { data?: { id?: string } }
      return { noteId: res.data?.id ?? null }
    },

    /**
     * Add tag(s) to a contact. Per 2026-05-31 corrections this IS the
     * enrollment mechanism — `addTags({contactId, tags: ['Lead', 'Campaign-X']})`
     * puts the contact into the Meta Ads campaign because that campaign filters
     * by the `Campaign-MetaAds` tag.
     */
    async addTags(input: TagOpInput): Promise<void> {
      await request(
        'PUT',
        `/contacts/addTags/${encodeURIComponent(input.contactId)}.json`,
        {
          body: { tags: input.tags },
          schema: ctContactTagsResponseSchema,
        },
      )
    },

    /**
     * Remove tag(s) from a contact. Used by:
     *   - lifecycle transitions (e.g. swap Lead → Engaged on first answer)
     *   - terminal-state defense (remove Campaign-X on Booked / DoNotCall)
     *   - admin unenrollment
     */
    async removeTags(input: TagOpInput): Promise<void> {
      await request(
        'DELETE',
        `/contacts/removeTags/${encodeURIComponent(input.contactId)}.json`,
        {
          body: { tags: input.tags },
          schema: ctContactTagsResponseSchema,
        },
      )
    },

    /**
     * List contacts. Used by the reconciliation cron + admin tooling. CT
     * paginates — caller advances `page` until `data.length === 0`.
     */
    async listContacts(input: ListContactsInput = {}): Promise<{
      data: { Contact: { id: string }, ContactsTag?: { name: string }[], ContactNumber?: { public_number: string }[] }[]
      itemsCount?: number
    }> {
      return await request<unknown>('GET', '/contacts/index.json', {
        query: {
          keyword: input.keyword,
          page: input.page,
          limit: input.limit ?? 100,
        },
        schema: ctContactListResponseSchema,
      }) as {
        data: { Contact: { id: string }, ContactsTag?: { name: string }[], ContactNumber?: { public_number: string }[] }[]
        itemsCount?: number
      }
    },

    // -----------------------------------------------------------------------
    // REST — Contact attributes (CT-defined; used by admin Resync)
    // -----------------------------------------------------------------------

    /**
     * List pre-defined ContactAttribute definitions configured in CT's
     * dashboard at Settings → Contacts → Custom Attributes. Used by the
     * admin Resync mutation to populate the `voip_contact_attributes` table.
     */
    async listContactAttributes(): Promise<CtContactAttributeDefinition[]> {
      const res = await request<unknown>('GET', '/contacts/attributes.json', {
        schema: ctAttributesListResponseSchema,
      }) as { ContactAttribute: CtContactAttributeDefinition }[]
      return res.map(row => row.ContactAttribute)
    },

    // -----------------------------------------------------------------------
    // REST — Campaigns (list + status toggle; membership is tag-driven)
    // -----------------------------------------------------------------------

    /**
     * List configured campaigns. Returns campaign + its membership tag.
     * Used by the admin Resync mutation to populate `voip_campaigns`.
     */
    async listCampaigns(): Promise<CampaignListRow[]> {
      const res = await request<unknown>('GET', '/campaigns/index.json', {
        schema: ctCampaignListResponseSchema,
      }) as { data: { Campaign: CtCampaign, ContactsTag?: { name?: string }[] }[] }
      return res.data.map(row => ({
        campaign: row.Campaign,
        // One tag per campaign (app model); CT returns an array — take the first.
        membershipTagName: row.ContactsTag?.[0]?.name,
      }))
    },

    /**
     * Pause / resume a campaign. CT uses 'inactive' as the pause state (no
     * separate 'paused' enum value). Holiday cron flips to 'inactive' on
     * observed holidays; resume cron flips back to 'active'.
     */
    async setCampaignStatus(input: SetCampaignStatusInput): Promise<void> {
      await request(
        'POST',
        `/campaigns/edit/${encodeURIComponent(input.campaignId)}.json`,
        {
          body: { status: input.status },
          schema: ctCampaignEditResponseSchema,
        },
      )
    },

    // -----------------------------------------------------------------------
    // REST — Calls (read-only; CT owns call records, we don't shadow)
    // -----------------------------------------------------------------------

    /**
     * List calls. Used by admin tooling that wants to surface CT-side call
     * history alongside in-house `voip_calls`. We do NOT shadow CT calls into
     * our DB (INTEGRATION-SEAM §8).
     */
    async listCalls(input: ListCallsInput = {}): Promise<CloudtalkCall[]> {
      const res = await request<unknown>('GET', '/calls/index.json', {
        query: {
          date_from: input.since?.toISOString(),
          limit: input.limit ?? 100,
        },
        schema: ctCallListResponseSchema,
      }) as { data: CtCallListRowShape[] }
      return res.data.map(rowToCall)
    },

    /**
     * Get a single call by id. NOTE the URL: `/calls/{callId}` does NOT
     * have a `.json` suffix or a `/show/` segment — the ONE audited path-
     * convention exception.
     */
    async getCall(callId: string): Promise<CloudtalkCall | null> {
      try {
        const res = await request<unknown>(
          'GET',
          `/calls/${encodeURIComponent(callId)}`,
          { schema: ctCallSchema },
        ) as {
          id?: string
          uuid?: string
          started_at?: string
          answered_at?: string
          ended_at?: string
          talking_time?: number
          is_voicemail?: boolean
          recording_url?: string
          public_external?: string
          public_internal?: string
        }
        return {
          callId: res.id ?? callId,
          callUuid: res.uuid ?? res.id ?? callId,
          callerE164: res.public_external ?? '',
          didE164: res.public_internal,
          startedAt: res.started_at ?? new Date().toISOString(),
          answeredAt: res.answered_at,
          endedAt: res.ended_at,
          durationSec: res.talking_time,
          isVoicemail: res.is_voicemail,
          recordingUrl: res.recording_url,
        }
      }
      catch (err) {
        if (err instanceof Error && err.message.includes('404')) {
          return null
        }
        throw err
      }
    },

    /**
     * Path helper for the recording download endpoint. Returns the path,
     * not the file — caller streams it through fetch with our auth header.
     */
    recordingPath(callId: string): string {
      return `/calls/recording/${encodeURIComponent(callId)}.json`
    },

    // -----------------------------------------------------------------------
    // REST — SMS (send only; no list endpoint)
    // -----------------------------------------------------------------------

    /**
     * Send an SMS. Field-naming on the wire (per swagger):
     *   recipient = to_e164, sender = from_e164, message = body.
     *
     * SMS deliverability is gated on A2P 10DLC registration — until that
     * completes, sends from US 10DLC numbers fail at the carrier layer.
     * NEVER call from a route handler directly — go through
     * `services/voip/campaigns/*` so the compliance + STOP gates fire first.
     */
    async sendSms(input: SendSmsInput): Promise<{ success: boolean }> {
      const res = await request<unknown>('POST', '/sms/send.json', {
        body: {
          recipient: input.toE164,
          sender: input.fromE164,
          message: input.text,
        },
      }) as { success: boolean }
      return { success: res.success }
    },

    // -----------------------------------------------------------------------
    // REST — Bulks (≤10 ops per request, top-level array body)
    // -----------------------------------------------------------------------

    /**
     * Batch contact operations. CT cap: ≤10 ops per request. Each op carries
     * `action` discriminator + caller-side `command_id` for correlation.
     * Throws if the cap is exceeded so a bad caller can't silently drop ops.
     */
    async bulkContacts(input: BulkContactsInput): Promise<{ status?: number, data?: unknown }> {
      if (input.ops.length === 0) {
        return {}
      }
      if (input.ops.length > CLOUDTALK_BULK_MAX_OPS_PER_REQUEST) {
        throw new Error(
          `[cloudtalk bulkContacts] CT cap = ${CLOUDTALK_BULK_MAX_OPS_PER_REQUEST} ops/request; got ${input.ops.length}. Chunk caller-side.`,
        )
      }

      return await request<unknown>('POST', '/bulk/contacts.json', {
        body: input.ops,
        schema: ctBulkContactsResponseSchema,
      }) as { status?: number, data?: unknown }
    },

    // -----------------------------------------------------------------------
    // Webhook secret verification (replaces standalone webhooks/verify.ts)
    // -----------------------------------------------------------------------

    /**
     * Verify an inbound webhook came from CloudTalk by checking the shared
     * secret query-param. CloudTalk does NOT sign webhooks (no HMAC); the
     * secret is the integrity check. Constant-time compared to avoid
     * timing-channel leaks.
     *
     * Returns `false` on missing / mismatch — route handlers should respond 401.
     */
    verifyWebhookSecret(input: VerifyWebhookSecretInput): boolean {
      // Pre-check via isCloudtalkConfigured() so a missing secret returns
      // false (caller responds 401) instead of throwing NotConfiguredError.
      if (!isCloudtalkConfigured()) {
        return false
      }
      const url = new URL(input.url)
      const provided = url.searchParams.get('secret')
      if (!provided) {
        return false
      }
      const { webhookSecret } = getCloudtalkConfig()
      const a = Buffer.from(provided)
      const b = Buffer.from(webhookSecret)
      if (a.length !== b.length) {
        return false
      }
      try {
        return timingSafeEqual(a, b)
      }
      catch {
        return false
      }
    },
  }
}

// ── Call mapping helper ─────────────────────────────────────────────────────

interface CtCallListRowShape {
  Cdr: {
    id: string
    uuid?: string
    public_external?: string
    public_internal?: string
    talking_time?: number
    is_voicemail?: boolean
    recording_url?: string
    started_at?: string
    answered_at?: string
    ended_at?: string
  }
  Agent?: { id: string }
  Number?: { public_number: string }
  ContactNumber?: { public_number: string }
  Disposition?: { name: string }
}

function rowToCall(row: CtCallListRowShape): CloudtalkCall {
  return {
    callId: row.Cdr.id,
    callUuid: row.Cdr.uuid ?? row.Cdr.id,
    agentId: row.Agent?.id,
    callerE164: row.ContactNumber?.public_number ?? row.Cdr.public_external ?? '',
    didE164: row.Number?.public_number ?? row.Cdr.public_internal,
    startedAt: row.Cdr.started_at ?? new Date().toISOString(),
    answeredAt: row.Cdr.answered_at,
    endedAt: row.Cdr.ended_at,
    durationSec: row.Cdr.talking_time,
    isVoicemail: row.Cdr.is_voicemail,
    recordingUrl: row.Cdr.recording_url,
  }
}

export type CloudtalkClient = ReturnType<typeof createCloudtalkClient>

/**
 * The single CloudTalk entry point. Import this — and only this — to interact
 * with CloudTalk from any service. See file header comment + `DOCS.md`.
 */
export const cloudtalkClient = createCloudtalkClient()
