import type { VoipMessageStatus } from '@/shared/constants/enums/voip'

// Twilio's lifecycle has more states than the table keeps; everything before `sent` reads as queued.
const TWILIO_TO_VOIP: Record<string, VoipMessageStatus> = {
  accepted: 'queued',
  scheduled: 'queued',
  queued: 'queued',
  sending: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  read: 'delivered',
  undelivered: 'undelivered',
  failed: 'failed',
}

/** Null for a state the table has no word for; the callback is then acknowledged and ignored. */
export function mapTwilioMessageStatus(status: string): VoipMessageStatus | null {
  return TWILIO_TO_VOIP[status.toLowerCase()] ?? null
}
