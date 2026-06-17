// Pure mapping: CloudTalk ContactAttribute definition title → our stable app_key.
// Composed by campaign-sync when mirroring CT attribute definitions into
// voip_contact_attributes. Unknown titles map to null (skipped — not one of our
// custom attributes). No I/O.
//
// The key is the join: each entry's title (lowercased/trimmed) MUST match the
// title of a custom contact attribute created in the CloudTalk dashboard, or the
// sync silently skips it and the attribute never bridges.

import type { CloudtalkContactAttributeAppKey } from '@/shared/services/providers/cloudtalk/constants'

const TITLE_TO_APP_KEY: Record<string, CloudtalkContactAttributeAppKey> = {
  'lead source': 'lead_source',
  'primary trade': 'primary_trade',
  'trades interested': 'trades_interested',
  'lead created at': 'lead_created_at',
}

export function mapAttributeTitleToAppKey(title: string): CloudtalkContactAttributeAppKey | null {
  return TITLE_TO_APP_KEY[title.trim().toLowerCase()] ?? null
}
