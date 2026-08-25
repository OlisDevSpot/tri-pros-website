import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'

// JustCall provider constants — HTTP wiring + domain vocabulary.
// see ../DOCS.md · see docs/plans/voip-campaigns/justcall-api-research.md
export const JUSTCALL_BASE_URL = 'https://api.justcall.io/v2.1' as const

// Retry attempts on HTTP 429. Ceiling confirmed against live headers during
// the migration plan's client build + live smoke (Tasks 6/16/17).
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
// configured on the campaign (the setup runbook fixes the exact dashboard
// strings). Non-terminal dispositions → null (keep dialing). Values are the
// canonical VoipUnenrollReason literals (graduated | opted_out | disqualified).
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
