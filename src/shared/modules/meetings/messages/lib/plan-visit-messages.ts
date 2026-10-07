import type {
  MeetingMessageStatus,
  PausableVisitMessageKind,
  VisitMessageSequenceKind,
  VisitMessageSkipReason,
} from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageFact, VisitMessagePlanInput, VisitMessageStep } from '@/shared/modules/meetings/messages/types'

import { isProjectMeeting } from '@/shared/constants/enums/meetings'
import { addCalendarDays, businessDateTime, businessDayKey, businessHour } from '@/shared/lib/business-time'
import {
  VISIT_MESSAGE_LATE_AFTER_MS,
  VISIT_MESSAGE_PENDING_STALE_MS,
  VISIT_MESSAGE_SCHEDULE,
} from '@/shared/modules/meetings/messages/constants/schedule'

// A sent leg outranks a failed one: a summary whose text went and whose email bounced was sent.
const STATUS_RANK: Record<MeetingMessageStatus, number> = { sent: 0, pending: 1, failed: 2, skipped: 3, received: 4 }

function emptyStep(kind: VisitMessageSequenceKind, plannedFor: Date | null): VisitMessageStep {
  return {
    kind,
    plannedFor: plannedFor ? plannedFor.toISOString() : null,
    state: 'not_sent',
    reason: null,
    skipReason: null,
    late: false,
    variant: null,
    row: null,
  }
}

function recorded(kind: VisitMessageSequenceKind, rows: readonly VisitMessageFact[], now: Date): Pick<VisitMessageStep, 'state' | 'reason' | 'row'> | null {
  const [row] = rows
    .filter(candidate => candidate.kind === kind && candidate.status !== 'received')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || Date.parse(b.createdAt) - Date.parse(a.createdAt))
  if (!row) {
    return null
  }
  if (row.status === 'pending') {
    const stale = now.getTime() - new Date(row.createdAt).getTime() > VISIT_MESSAGE_PENDING_STALE_MS
    return stale ? { state: 'failed', reason: 'send_interrupted', row } : { state: 'sending', reason: null, row }
  }
  return { state: row.status === 'sent' ? 'sent' : row.status === 'failed' ? 'failed' : 'skipped', reason: row.reason, row }
}

/**
 * Each sequence step's state for one meeting time. The scheduled runs act on exactly the steps this marks `due`,
 * and every screen shows this result, so what staff read is what will happen.
 */
export function planVisitMessages(input: VisitMessagePlanInput): VisitMessageStep[] {
  const { meeting, now } = input
  const visitAt = new Date(meeting.scheduledFor)
  const visitDay = businessDayKey(visitAt)
  const dayBefore = addCalendarDays(visitDay, -1)
  const reminder = VISIT_MESSAGE_SCHEDULE.day_before_reminder
  const rep = VISIT_MESSAGE_SCHEDULE.rep_confirmation

  const forThisTime = input.messages.filter(message => new Date(message.forScheduledFor).getTime() === visitAt.getTime())
  const notApplicable = isProjectMeeting(meeting) ? 'project_meeting' : meeting.meetingOutcome !== 'not_set' ? 'outcome_decided' : null

  const summaryCutoff = businessDateTime(dayBefore, reminder.summaryCutoffHour, 0)
  const summaryAfterCutoff = forThisTime.some(message =>
    message.kind === 'visit_summary'
    && message.status === 'sent'
    && new Date(message.createdAt).getTime() > summaryCutoff.getTime())

  function skipReasonFor(kind: PausableVisitMessageKind): VisitMessageSkipReason | null {
    if (input.pausedKinds.includes(kind)) {
      return 'paused'
    }
    if (!input.contact.hasPhone) {
      return 'no_phone'
    }
    if (input.contact.doNotContact) {
      return 'dnc'
    }
    return kind === 'day_before_reminder' && summaryAfterCutoff ? 'booked_after_noon' : null
  }

  function automatic(kind: PausableVisitMessageKind, plannedFor: Date, closes: Date, ownNotApplicable: string | null): VisitMessageStep {
    const step = emptyStep(kind, plannedFor)
    if (kind === 'day_before_reminder') {
      step.variant = meeting.homeownerConfirmedAt || meeting.confirmedAt ? 'confirmed' : 'unconfirmed'
    }

    const row = recorded(kind, forThisTime, now)
    if (row) {
      return { ...step, ...row }
    }
    if (notApplicable ?? ownNotApplicable) {
      return { ...step, state: 'not_applicable', reason: notApplicable ?? ownNotApplicable }
    }
    // The run for this step had already gone when the meeting was booked, so no run will ever pick it up.
    if (new Date(meeting.createdAt).getTime() > plannedFor.getTime()) {
      return { ...step, reason: 'booked_after_run' }
    }
    if (now.getTime() >= closes.getTime()) {
      return { ...step, reason: 'no_record' }
    }
    if (now.getTime() < plannedFor.getTime()) {
      return { ...step, state: 'scheduled', skipReason: skipReasonFor(kind) }
    }
    return {
      ...step,
      state: 'due',
      skipReason: skipReasonFor(kind),
      late: now.getTime() - plannedFor.getTime() > VISIT_MESSAGE_LATE_AFTER_MS,
    }
  }

  const summary = emptyStep('visit_summary', null)
  const summaryRow = recorded('visit_summary', forThisTime, now)
  const sentForAnotherTime = input.messages.some(message => message.kind === 'visit_summary' && message.status === 'sent')

  return [
    summaryRow
      ? { ...summary, ...summaryRow }
      : notApplicable
        ? { ...summary, state: 'not_applicable', reason: notApplicable }
        : { ...summary, reason: sentForAnotherTime ? 'time_changed' : 'never_sent' },
    automatic(
      'day_before_reminder',
      businessDateTime(dayBefore, reminder.hour, reminder.minute),
      businessDateTime(visitDay, 0, 0),
      null,
    ),
    automatic(
      'rep_confirmation',
      businessDateTime(visitDay, rep.hour, rep.minute),
      visitAt,
      !meeting.hasRep ? 'no_rep' : businessHour(visitAt) < rep.earliestVisitHour ? 'before_9am' : null,
    ),
  ]
}
