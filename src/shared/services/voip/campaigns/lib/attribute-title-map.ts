// Pure mapping: CloudTalk ContactAttribute definition title → our stable app_key.
// Composed by campaign-sync when mirroring CT attribute definitions into
// voip_contact_attributes. Unknown titles map to null (skipped — not one of our
// 3 custom attributes). No I/O.

import type { CloudtalkContactAttributeAppKey } from '@/shared/services/providers/cloudtalk/constants'

const TITLE_TO_APP_KEY: Record<string, CloudtalkContactAttributeAppKey> = {
  'lead source': 'lead_source',
  'primary trade': 'primary_trade',
  'trades interested': 'trades_interested',
}

export function mapAttributeTitleToAppKey(title: string): CloudtalkContactAttributeAppKey | null {
  return TITLE_TO_APP_KEY[title.trim().toLowerCase()] ?? null
}
