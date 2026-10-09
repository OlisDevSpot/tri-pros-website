import type { VisitMessageFact } from '@/shared/modules/meetings/messages/types'

/**
 * A cancellation email removes a calendar entry, so it needs an invite that arrived.
 * A reschedule's original has a successor, whose next summary updates that same entry.
 * A visit already under way or past has nothing left to remove from the homeowner's day.
 */
export function shouldSendVisitCancellation(input: { chainMessages: readonly VisitMessageFact[], hasSuccessor: boolean, scheduledFor: string, now: Date }): boolean {
  return new Date(input.scheduledFor).getTime() > input.now.getTime()
    && !input.hasSuccessor
    && input.chainMessages.some(message => message.kind === 'visit_summary' && message.channel === 'email' && message.status === 'sent')
}
