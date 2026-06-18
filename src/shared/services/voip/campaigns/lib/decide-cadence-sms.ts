import type { SmsCadence, SmsCadenceMessage } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'

// Pure decision (no I/O): given the campaign cadence + this lead's progress
// after a counted dial, return the message to send now, or "don't send".
// Gates: enabled, < maxMessages, next message exists, attempt threshold met,
// and (if oneSmsPerDay) nothing already sent today in the lead-local tz.
// see docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md §6

const CADENCE_TZ = 'America/Los_Angeles'

export interface DecideCadenceSmsInput {
  cadence: SmsCadence | null
  dialAttempts: number
  autoSmsSentCount: number
  lastAutoSmsAt: string | null
  now: Date
}

export type DecideCadenceSmsResult
  = { send: true, message: SmsCadenceMessage } | { send: false }

function localDay(date: Date): string {
  // en-CA → YYYY-MM-DD; tz-pinned so "today" means the lead's SoCal calendar day.
  return date.toLocaleDateString('en-CA', { timeZone: CADENCE_TZ })
}

export function decideCadenceSms(input: DecideCadenceSmsInput): DecideCadenceSmsResult {
  const { cadence, dialAttempts, autoSmsSentCount, lastAutoSmsAt, now } = input

  if (!cadence || !cadence.enabled) {
    return { send: false }
  }
  if (autoSmsSentCount >= cadence.maxMessages) {
    return { send: false }
  }
  const message = cadence.messages[autoSmsSentCount]
  if (!message) {
    return { send: false }
  }
  if (dialAttempts < message.afterAttempts) {
    return { send: false }
  }
  if (cadence.oneSmsPerDay && lastAutoSmsAt && localDay(new Date(lastAutoSmsAt)) === localDay(now)) {
    return { send: false }
  }
  return { send: true, message }
}
