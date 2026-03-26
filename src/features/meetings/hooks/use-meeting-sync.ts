'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useRealtime } from '@/shared/services/upstash/realtime-client'
import { useTRPC } from '@/trpc/helpers'

interface MeetingSyncStatus {
  status: string
}

export function useMeetingSync(meetingId: string): MeetingSyncStatus {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
    })
    void queryClient.invalidateQueries({
      queryKey: trpc.meetingsRouter.getPersonaProfile.queryKey({ meetingId }),
    })
  }, [meetingId, queryClient, trpc])

  const { status } = useRealtime({
    channels: [`meeting:${meetingId}`],
    events: [
      'meeting.flowStateUpdated',
      'meeting.contextUpdated',
      'meeting.customerProfileUpdated',
      'meeting.outcomeUpdated',
      'meeting.agentNotesUpdated',
    ],
    onData: invalidate,
  })

  return { status }
}
