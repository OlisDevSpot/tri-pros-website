'use client'

import type { JSX } from 'react'

import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useReschedule } from '@/shared/hooks/use-reschedule'

/**
 * Single entry point for the Reschedule action from any surface. Opens the
 * datetime+note modal, then calls business.rescheduleMeeting. `meetingId` is
 * passed per call so one instance serves rows, cards, and calendar events.
 * Render <RescheduleDialog /> once wherever this hook is used.
 */
export function useRescheduleChange(): {
  reschedule: (meetingId: string) => Promise<void>
  RescheduleDialog: () => JSX.Element
} {
  const { rescheduleMeeting } = useMeetingActions()
  const [RescheduleDialog, requestReschedule] = useReschedule()

  const reschedule = async (meetingId: string) => {
    const { confirmed, newScheduledFor, reason } = await requestReschedule(meetingId)
    if (!confirmed) {
      return
    }
    rescheduleMeeting.mutate({ meetingId, newScheduledFor, reason })
  }

  return { reschedule, RescheduleDialog }
}
