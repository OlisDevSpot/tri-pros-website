'use client'

import type { JSX } from 'react'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useOutcomeReason } from '@/shared/hooks/use-outcome-reason'

/**
 * Single entry point for changing a meeting's outcome from any surface. If the
 * outcome requires a reason (negative or follow-up), opens the reason modal and
 * routes through setOutcomeWithReason; otherwise does a plain outcome update.
 * `meetingId` is passed per call so one instance serves rows, cards, and
 * calendar events. Render <OutcomeReasonDialog /> once wherever this hook is used.
 */
export function useOutcomeChange(): {
  changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>
  OutcomeReasonDialog: () => JSX.Element
} {
  const { updateOutcome, setOutcomeWithReason } = useMeetingActions()
  const [OutcomeReasonDialog, requestReason] = useOutcomeReason()

  const changeOutcome = async (meetingId: string, outcome: MeetingOutcome) => {
    if (outcomeRequiresReason(outcome)) {
      const { confirmed, reason } = await requestReason(outcome)
      if (!confirmed) {
        return
      }
      setOutcomeWithReason.mutate({ meetingId, outcome, reason })
      return
    }
    updateOutcome.mutate({ id: meetingId, data: { meetingOutcome: outcome } })
  }

  return { changeOutcome, OutcomeReasonDialog }
}
