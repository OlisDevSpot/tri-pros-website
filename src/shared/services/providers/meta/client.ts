import type { MetaServerEvent, MetaUserData } from '@/shared/services/providers/meta/schemas/server-event'

import { createHash } from 'node:crypto'

import { toDigits } from '@/shared/lib/phone'
import { META_GRAPH_BASE_URL } from '@/shared/services/providers/meta/constants'
import { getMetaConfig } from '@/shared/services/providers/meta/lib/config'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// ─── Meta normalization — single source of truth ────────────────────────────
// Each identifier must be normalized EXACTLY as Meta normalizes its own records
// before SHA-256, or the hashes won't match and the signal is wasted. Rules per
// the customer-information-parameters doc. The whole match-key surface reduces to
// three normalizers (phone reuses the canonical `toDigits` from phone.ts):
//   • toDigits     → ph  (funnel passes E.164 → `1XXXXXXXXXX`: country code, no '+')
//   • lowerTrim    → em, st, country
//   • stripToAlnum → fn, ln, ct  (and zp = stripToAlnum + first-5)
const lowerTrim = (value: string): string => value.trim().toLowerCase()
// Lowercase + drop whitespace & punctuation, keeping Unicode letters (diacritics)
// and digits: "San Diego" → "sandiego", "O'Brien" → "obrien".
const stripToAlnum = (value: string): string => lowerTrim(value).replace(/[^\p{L}\p{N}]/gu, '')

function createMetaClient() {
  return {
    /**
     * Hash the advanced-matching identifiers Meta can match on. Returns only the
     * keys that are present (and non-empty after normalization). Each field is
     * normalized per Meta's rules so our SHA-256 matches Meta's own. Pure local
     * helper exposed as a client method per client-is-the-superset-entry-point.
     */
    hashUserData(input: {
      phone?: string | null
      email?: string | null
      firstName?: string | null
      lastName?: string | null
      city?: string | null
      state?: string | null
      zip?: string | null
      country?: string | null
    }): Pick<MetaUserData, 'ph' | 'em' | 'fn' | 'ln' | 'ct' | 'st' | 'zp' | 'country'> {
      const hash = (raw: string | null | undefined, normalize: (v: string) => string): string[] | undefined => {
        if (!raw) {
          return undefined
        }
        const value = normalize(raw)
        return value ? [sha256(value)] : undefined
      }
      return {
        ph: hash(input.phone, toDigits),
        em: hash(input.email, lowerTrim),
        fn: hash(input.firstName, stripToAlnum),
        ln: hash(input.lastName, stripToAlnum),
        ct: hash(input.city, stripToAlnum),
        st: hash(input.state, lowerTrim),
        zp: hash(input.zip, value => stripToAlnum(value).slice(0, 5)),
        country: hash(input.country, lowerTrim),
      }
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
