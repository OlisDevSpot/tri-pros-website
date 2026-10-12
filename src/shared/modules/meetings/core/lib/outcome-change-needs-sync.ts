import type { MeetingOutcome } from '@/shared/constants/enums/meetings'

/**
 * The outcome decides whether the visit has a calendar event at all, so leaving `cancelled` or `rescheduled` brings
 * it back and entering `rescheduled` takes it away. Entering `cancelled` is false: that transition deletes the event itself.
 */
export function outcomeChangeNeedsSync(previous: MeetingOutcome, next: MeetingOutcome): boolean {
  if (previous === next) {
    return false
  }
  return previous === 'cancelled' || previous === 'rescheduled' || next === 'rescheduled'
}
