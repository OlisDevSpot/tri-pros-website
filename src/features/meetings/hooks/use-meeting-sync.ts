'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useChannel, useConnectionStateListener } from 'ably/react'
import { useCallback, useState } from 'react'
import { useTRPC } from '@/trpc/helpers'

interface MeetingSyncStatus {
  status: string
}

export function useMeetingSync(meetingId: string): MeetingSyncStatus {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  useConnectionStateListener((stateChange) => {
    setConnectionStatus(stateChange.current)
  })

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
    })
    void queryClient.invalidateQueries({
      queryKey: trpc.meetingsRouter.getPersonaProfile.queryKey({ meetingId }),
    })
  }, [meetingId, queryClient, trpc])

  useChannel(`meeting:${meetingId}`, invalidate)

  return { status: connectionStatus }
}
