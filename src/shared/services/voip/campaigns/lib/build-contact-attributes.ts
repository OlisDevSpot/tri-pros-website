// Pure mapping (EPIC decision #13 + #16): build the CloudTalk custom-attribute
// write list for a customer + a stable hash for delta-push skipping. No I/O.
// Composed by the enrollment service, which supplies the app_key → ct_attribute_id
// bridge (synced into voip_contact_attributes).
//
// Built-in `name` + `city` go to CT's first-class Contact fields via
// upsertContact — NOT through this list. This builds the 3 custom attributes:
//   - lead_source       : the source slug (drives CT segmentation/templating)
//   - primary_trade     : the lead's first interested trade (human-readable)
//   - trades_interested : alpha-sorted, deduped interested trades (human-readable)
//
// Values come from leadMetaJSON.interestedTradesRaw — already human-readable for
// every source (Bina: raw campaign trade strings; in-app form: resolved trade
// names). No ID→label lookup needed.

import type { CloudtalkContactAttributeAppKey } from '@/shared/services/providers/cloudtalk/constants'

import { createHash } from 'node:crypto'

export interface ContactAttributeWrite {
  attributeId: string
  value: string
}

interface BuildContactAttributesInput {
  leadSourceSlug: string
  interestedTradesRaw?: string[]
  // Built-in fields — not written as custom attributes, but folded into the
  // hash so a name/city change still invalidates the delta-skip.
  name: string
  city: string
  attributeIdByKey: Partial<Record<CloudtalkContactAttributeAppKey, string>>
}

export interface BuiltContactAttributes {
  attributes: ContactAttributeWrite[]
  attributeHash: string
}

export function buildContactAttributes(
  input: BuildContactAttributesInput,
): BuiltContactAttributes {
  const trades = (input.interestedTradesRaw ?? []).map(t => t.trim()).filter(Boolean)
  const sortedTrades = [...new Set(trades)].sort()

  const valueByKey: Record<CloudtalkContactAttributeAppKey, string> = {
    lead_source: input.leadSourceSlug,
    primary_trade: trades[0] ?? '',
    trades_interested: sortedTrades.join(', '),
  }

  const attributes: ContactAttributeWrite[] = []
  for (const [key, value] of Object.entries(valueByKey) as [CloudtalkContactAttributeAppKey, string][]) {
    const attributeId = input.attributeIdByKey[key]
    if (attributeId) {
      attributes.push({ attributeId, value })
    }
  }

  const hashSource = JSON.stringify({ name: input.name, city: input.city, values: valueByKey })
  const attributeHash = createHash('sha1').update(hashSource).digest('hex')

  return { attributes, attributeHash }
}
