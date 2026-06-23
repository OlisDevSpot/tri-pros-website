import type { MetaServerEvent } from '@/shared/services/providers/meta/schemas/server-event'

import { createHash } from 'node:crypto'

import { META_GRAPH_BASE_URL } from '@/shared/services/providers/meta/constants'
import { getMetaConfig } from '@/shared/services/providers/meta/lib/config'

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
        signal: AbortSignal.timeout(30_000),
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
