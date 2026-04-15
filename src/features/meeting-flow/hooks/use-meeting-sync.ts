'use client'

import { useChannel, useConnectionStateListener } from 'ably/react'
import { useCallback, useState } from 'react'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'

interface MeetingSyncStatus {
  status: string
}

export function useMeetingSync(meetingId: string): MeetingSyncStatus {
  const { invalidateMeeting } = useInvalidation()
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  useConnectionStateListener((stateChange) => {
    setConnectionStatus(stateChange.current)
  })

  const invalidate = useCallback(() => {
    invalidateMeeting()
  }, [invalidateMeeting])

  useChannel(`meeting:${meetingId}`, invalidate)

  return { status: connectionStatus }
}
