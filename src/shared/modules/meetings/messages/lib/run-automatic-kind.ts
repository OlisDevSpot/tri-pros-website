import type { ScopedContext } from '@/shared/dal/server/types'
import type { PausableVisitMessageKind, VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { getRescheduleChain } from '@/shared/entities/meetings/dal/server/queries'
import { claimAutomaticSend, recordAutomaticSkip, setMeetingMessageOutcome } from '@/shared/modules/meetings/messages/dal/server/mutations'
import { listChainMessages, listVisitMessageContexts } from '@/shared/modules/meetings/messages/dal/server/queries'
import { getTemplateBodies, listPausedKinds } from '@/shared/modules/meetings/messages/dal/server/settings'
import { deliverVisitText } from '@/shared/modules/meetings/messages/lib/deliver-visit-text'
import { planVisitMessages } from '@/shared/modules/meetings/messages/lib/plan-visit-messages'
import { resolveRunInstant } from '@/shared/modules/meetings/messages/lib/resolve-run-instant'
import { runWindowFor } from '@/shared/modules/meetings/messages/lib/run-window'

export interface VisitMessageRunReport {
  kind: PausableVisitMessageKind
  /** Null when this delivery was not the kind's run: too early, after midnight, or past the send ceiling. */
  runAt: string | null
  candidates: number
  sent: string[]
  skipped: { meetingId: string, reason: string }[]
  failed: { meetingId: string, reason: string }[]
}

function templateKeyFor(kind: PausableVisitMessageKind, variant: 'confirmed' | 'unconfirmed' | null): VisitMessageTemplateKey {
  if (kind === 'rep_confirmation') {
    return 'rep_confirmation'
  }
  return variant === 'confirmed' ? 'day_before_reminder_confirmed' : 'day_before_reminder_unconfirmed'
}

/**
 * Both runs are this loop: load the day's meetings, compute each plan at the run's instant, and act only on
 * the step the plan marks due. One failing meeting never stops the run.
 */
export async function runAutomaticKind(ctx: ScopedContext, kind: PausableVisitMessageKind, now: Date): Promise<VisitMessageRunReport> {
  const report: VisitMessageRunReport = { kind, runAt: null, candidates: 0, sent: [], skipped: [], failed: [] }
  const runAt = resolveRunInstant(kind, now)
  if (!runAt) {
    return report
  }
  report.runAt = runAt.toISOString()

  const contexts = await listVisitMessageContexts(runWindowFor(kind, runAt))
  report.candidates = contexts.length
  if (contexts.length === 0) {
    return report
  }

  const [bodies, pausedKinds] = await Promise.all([getTemplateBodies(), listPausedKinds()])

  for (const context of contexts) {
    const { meeting, customer } = context
    try {
      const chain = await getRescheduleChain(SYSTEM_CONTEXT, { meetingId: meeting.id })
      const messages = await listChainMessages(chain.success ? chain.data : [meeting.id])
      const step = planVisitMessages({
        meeting: { ...meeting, hasRep: context.rep != null },
        messages,
        contact: { hasPhone: customer?.phone != null, doNotContact: customer?.doNotContact ?? false },
        pausedKinds,
        now: runAt,
      }).find(candidate => candidate.kind === kind)
      if (!step || step.state !== 'due') {
        continue
      }

      const row = { meetingId: meeting.id, kind, channel: 'sms' as const, forScheduledFor: meeting.scheduledFor }
      if (step.skipReason) {
        if (await recordAutomaticSkip({ ...row, reason: step.skipReason })) {
          report.skipped.push({ meetingId: meeting.id, reason: step.skipReason })
        }
        continue
      }

      const claim = await claimAutomaticSend(row)
      if (!claim) {
        continue
      }
      const outcome = await deliverVisitText(ctx, { context, templateKey: templateKeyFor(kind, step.variant), bodies })
      await setMeetingMessageOutcome(claim.id, outcome)
      if (outcome.status === 'sent') {
        report.sent.push(meeting.id)
      }
      else if (outcome.status === 'skipped') {
        report.skipped.push({ meetingId: meeting.id, reason: outcome.reason ?? 'skipped' })
      }
      else {
        report.failed.push({ meetingId: meeting.id, reason: outcome.reason ?? 'send_error' })
      }
    }
    catch (error) {
      console.error(`[${kind}] failed for meeting`, { meetingId: meeting.id, error })
      report.failed.push({ meetingId: meeting.id, reason: 'run_error' })
    }
  }
  return report
}
