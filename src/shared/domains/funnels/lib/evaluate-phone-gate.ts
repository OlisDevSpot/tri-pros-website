import type { PhoneLookupResult } from '@/shared/services/providers/twilio/client'

export interface PhoneGateVerdict {
  ok: boolean
  status: 'verified' | 'unverified'
  lineType: string | null
  carrierName: string | null
}

/**
 * Hard gate, but fail OPEN. Pass `null` when the lookup threw / timed out.
 * - lookup === null OR errorCode set  → indeterminate → accept, status 'unverified'.
 * - valid === false                   → definitive garbage → block.
 * - valid === true                    → accept, status 'verified'.
 * Never blocks on uncertainty; never drops a lead because Twilio didn't answer.
 */
export function evaluatePhoneGate(lookup: PhoneLookupResult | null): PhoneGateVerdict {
  if (lookup === null || lookup.errorCode != null) {
    return { ok: true, status: 'unverified', lineType: lookup?.lineType ?? null, carrierName: lookup?.carrierName ?? null }
  }
  if (!lookup.valid) {
    return { ok: false, status: 'unverified', lineType: lookup.lineType, carrierName: lookup.carrierName }
  }
  return { ok: true, status: 'verified', lineType: lookup.lineType, carrierName: lookup.carrierName }
}
