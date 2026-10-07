import type { HomeownerConfirmation } from '@/shared/constants/enums/meetings'
import type { ConfirmationTrack, VisitMessageFact } from '@/shared/modules/meetings/messages/types'

function isFor(message: VisitMessageFact, scheduledFor: string): boolean {
  return new Date(message.forScheduledFor).getTime() === new Date(scheduledFor).getTime()
}

export function deriveConfirmationTrack(
  meeting: {
    scheduledFor: string
    confirmedAt: string | null
    homeownerConfirmedAt: string | null
    homeownerConfirmedVia: HomeownerConfirmation | null
  },
  chainMessages: readonly VisitMessageFact[],
): ConfirmationTrack {
  const sent = chainMessages.filter(message => message.status === 'sent')
  const summaries = sent.filter(message => message.kind === 'visit_summary')

  const nudge = summaries.length === 0
    ? 'summary_not_sent'
    : summaries.some(message => isFor(message, meeting.scheduledFor)) ? null : 'time_changed'

  const via = meeting.homeownerConfirmedAt
    ? (meeting.homeownerConfirmedVia ?? 'in_app')
    : meeting.confirmedAt ? 'office' : null

  return {
    office: { done: sent.length > 0, nudge },
    homeowner: { done: via != null, via },
    rep: { done: sent.some(message => message.kind === 'rep_confirmation' && isFor(message, meeting.scheduledFor)) },
  }
}
