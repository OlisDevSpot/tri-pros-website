import type { VisitMessageFact } from '@/shared/modules/meetings/messages/types'

/**
 * A cancellation email removes a calendar entry, so it needs an invite that arrived.
 * A reschedule's original has a successor, whose next summary updates that same entry.
 */
export function shouldSendVisitCancellation(input: { chainMessages: readonly VisitMessageFact[], hasSuccessor: boolean }): boolean {
  return !input.hasSuccessor
    && input.chainMessages.some(message => message.kind === 'visit_summary' && message.channel === 'email' && message.status === 'sent')
}
