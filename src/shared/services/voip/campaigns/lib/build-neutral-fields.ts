// Pure mapping (EPIC decision #13 + #16): build the neutral dialer custom-field
// list for a customer + a stable hash for delta-push skipping. No I/O. Composed
// by the enrollment service, which supplies the app_key → provider_field_id +
// label bridge (synced into voip_contact_fields).
//
// Built-in `name` goes to the provider's first-class contact field via
// dialerProvider.enroll — NOT through this list. This builds the custom fields:
//   - lead_source       : the source slug (drives dialer segmentation/templating)
//   - primary_trade     : the lead's first interested trade (human-readable)
//   - trades_interested : alpha-sorted, deduped interested trades (human-readable)
//   - lead_created_at   : when the lead was added to our system (PST date-time)
//
// Trade values come from the attribution capture snapshot
// (customer_lead_attribution.captureJSON.interestedTradesRaw) — already
// human-readable for every source (Bina: raw campaign trade strings; in-app
// form: resolved trade names). No ID→label lookup needed.

import type { JustcallContactFieldAppKey } from '@/shared/services/providers/justcall/constants'
import type { NeutralField } from '@/shared/services/voip/dialer/types'

import { createHash } from 'node:crypto'
import { pickPrimaryTrade } from './pick-primary-trade'

// Lead-created timestamp as a human-readable Pacific date-time for the dialer
// agent view (e.g. "Jun 17, 2026, 2:30 PM"). Written once at enroll and absolute
// (not relative) so it never goes stale.
function formatLeadCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  })
}

interface BuildNeutralFieldsInput {
  leadSourceSlug: string
  interestedTradesRaw?: string[]
  // Built-in fields — not written as custom fields, but folded into the hash so
  // a name/city/zip change still invalidates the delta-skip.
  name: string
  city: string
  zip: string
  // ISO timestamp of when the lead row was created (customers.createdAt).
  leadCreatedAt: string
  // The synced bridge: app_key → provider field id + label. A key missing from
  // the map yields a field with no providerFieldId — resolveFieldIds drops it,
  // so the value is simply not pushed (never a hard failure).
  providerFieldIdByKey: Partial<Record<JustcallContactFieldAppKey, string>>
  labelByKey: Partial<Record<JustcallContactFieldAppKey, string>>
}

export interface BuiltNeutralFields {
  fields: NeutralField[]
  attributeHash: string
}

export function buildNeutralFields(
  input: BuildNeutralFieldsInput,
): BuiltNeutralFields {
  const trades = (input.interestedTradesRaw ?? []).map(t => t.trim()).filter(Boolean)
  const sortedTrades = [...new Set(trades)].sort()

  const valueByKey: Record<JustcallContactFieldAppKey, string> = {
    lead_source: input.leadSourceSlug,
    primary_trade: pickPrimaryTrade(input.interestedTradesRaw),
    trades_interested: sortedTrades.join(', '),
    lead_created_at: formatLeadCreatedAt(input.leadCreatedAt),
  }

  const fields: NeutralField[] = []
  for (const [key, value] of Object.entries(valueByKey) as [JustcallContactFieldAppKey, string][]) {
    fields.push({
      appKey: key,
      value,
      providerFieldId: input.providerFieldIdByKey[key],
      label: input.labelByKey[key],
    })
  }

  // Hash the values (not provider ids) so a re-sync that only rotates ids
  // doesn't churn the delta-skip. Same composition as the pre-migration (CloudTalk) version.
  const hashSource = JSON.stringify({ name: input.name, city: input.city, zip: input.zip, values: valueByKey })
  const attributeHash = createHash('sha1').update(hashSource).digest('hex')

  return { fields, attributeHash }
}
