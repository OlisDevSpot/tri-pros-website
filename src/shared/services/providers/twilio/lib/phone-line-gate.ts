import type { PhoneLookupResult } from '@/shared/services/providers/twilio/client'

export type LinePolicy = 'mobile-only' | 'mobile-or-landline'

export interface PhoneLineVerdict {
  ok: boolean
  status: 'verified-mobile' | 'verified-landline' | 'unverified-line'
  lineType: string | null
  carrierName: string | null
  blockedReason?: 'invalid' | 'non-mobile' | 'line-type'
}

const ALLOWED: Record<LinePolicy, ReadonlySet<string>> = {
  'mobile-only': new Set(['mobile']),
  'mobile-or-landline': new Set(['mobile', 'landline']),
}

/**
 * Interprets a Twilio line-type lookup against a surface's policy. Fail-open on
 * uncertainty (null lookup / errorCode / null|'unknown' lineType) → ok:true,
 * status 'unverified-line'. Definitive non-allowed line type → ok:false.
 */
export function evaluatePhoneLineGate(lookup: PhoneLookupResult | null, policy: LinePolicy): PhoneLineVerdict {
  if (lookup === null || lookup.errorCode != null || lookup.lineType == null || lookup.lineType === 'unknown') {
    return { ok: true, status: 'unverified-line', lineType: lookup?.lineType ?? null, carrierName: lookup?.carrierName ?? null }
  }
  if (!lookup.valid) {
    return { ok: false, status: 'unverified-line', lineType: lookup.lineType, carrierName: lookup.carrierName, blockedReason: 'invalid' }
  }
  if (ALLOWED[policy].has(lookup.lineType)) {
    return {
      ok: true,
      status: lookup.lineType === 'mobile' ? 'verified-mobile' : 'verified-landline',
      lineType: lookup.lineType,
      carrierName: lookup.carrierName,
    }
  }
  return {
    ok: false,
    status: 'unverified-line',
    lineType: lookup.lineType,
    carrierName: lookup.carrierName,
    blockedReason: policy === 'mobile-only' ? 'non-mobile' : 'line-type',
  }
}
