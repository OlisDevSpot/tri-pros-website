// Pure mapping: dialer custom-field definition label → our stable app_key.
// Composed by campaign-sync when mirroring the provider's custom-field
// definitions into voip_contact_fields. Unknown labels map to null (skipped —
// not one of our custom fields). No I/O.
//
// The key is the join: each entry's label (lowercased/trimmed) MUST match the
// label of a custom field created in the dialer (JustCall) dashboard, or the
// sync silently skips it and the field never bridges.

import type { JustcallContactFieldAppKey } from '@/shared/services/providers/justcall/constants'

const LABEL_TO_APP_KEY: Record<string, JustcallContactFieldAppKey> = {
  'lead source': 'lead_source',
  'primary trade': 'primary_trade',
  'trades interested': 'trades_interested',
  'lead created at': 'lead_created_at',
}

export function mapFieldLabelToAppKey(label: string): JustcallContactFieldAppKey | null {
  return LABEL_TO_APP_KEY[label.trim().toLowerCase()] ?? null
}
