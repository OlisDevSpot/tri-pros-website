'use client'

import { useAbly, useChannel, useConnectionStateListener } from 'ably/react'
import { useCallback, useState } from 'react'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'

interface MeetingSyncStatus {
  status: string
}

export function useMeetingSync(meetingId: string): MeetingSyncStatus {
  const { invalidateMeeting } = useInvalidation()
  const ably = useAbly()
  const [connectionStatus, setConnectionStatus] = useState<string>(() => ably.connection.state)

  useConnectionStateListener((stateChange) => {
    setConnectionStatus(stateChange.current)
  })

  const invalidate = useCallback(() => {
    invalidateMeeting()
  }, [invalidateMeeting])

  useChannel(`meeting:${meetingId}`, invalidate)

  return { status: connectionStatus }
}
