import type { LinePolicy, PhoneLineVerdict } from './phone-line-gate'
import { Ratelimit } from '@upstash/ratelimit'

import { Redis } from '@upstash/redis'
import env from '@/shared/config/server-env'
import { isPlausibleUsPhone, toE164 } from '@/shared/lib/phone'
import { twilioClient } from '@/shared/services/providers/twilio/client'

import { evaluatePhoneLineGate } from './phone-line-gate'

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })

// Global paid-lookup ceiling — caps Twilio spend across ALL surfaces. Fail-open
// on exceed (skip the paid call → null → gate fails open → lead never dropped).
const lookupCeiling = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '1 h'),
  prefix: 'phone:lookup-ceiling',
  ephemeralCache: new Map(),
})

const LOOKUP_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('phone lookup timed out')), ms)
    }),
  ])
}

/**
 * The single phone line-type validation entry point for every surface. Cheap
 * free pre-filter (no paid call on junk) → global ceiling → Twilio lookup (5s
 * timeout) → policy gate. Any error/timeout/ceiling/indeterminate fails open
 * (unverified-line, ok:true). Accepts raw or E.164 input.
 */
export async function validatePhoneLine(rawPhone: string, policy: LinePolicy): Promise<PhoneLineVerdict> {
  const e164 = toE164(rawPhone)
  if (!e164 || !isPlausibleUsPhone(rawPhone)) {
    return { ok: false, status: 'unverified-line', lineType: null, carrierName: null, blockedReason: 'invalid' }
  }

  let lookup = null
  const ceiling = await lookupCeiling.limit('global')
  if (ceiling.success) {
    try {
      lookup = await withTimeout(twilioClient.lookupPhoneNumber(e164), LOOKUP_TIMEOUT_MS)
    }
    catch {
      lookup = null
    }
  }
  return evaluatePhoneLineGate(lookup, policy)
}
