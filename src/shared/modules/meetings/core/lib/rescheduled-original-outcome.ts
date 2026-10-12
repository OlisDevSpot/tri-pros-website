import type { MeetingOutcome } from '@/shared/constants/enums/meetings'

/** A visit moved before it happened reads `rescheduled`; a no-show or cancellation being rebooked keeps what really happened. */
export function rescheduledOriginalOutcome(outcome: MeetingOutcome): 'rescheduled' | null {
  return outcome === 'not_set' || outcome === 'reschedule_needed' ? 'rescheduled' : null
}
