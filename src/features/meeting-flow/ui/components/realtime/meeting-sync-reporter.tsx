'use client'

import { useEffect } from 'react'
import { useMeetingSync } from '@/features/meeting-flow/hooks/use-meeting-sync'

interface MeetingSyncReporterProps {
  meetingId: string
  onStatusChange: (status: string) => void
}

export function MeetingSyncReporter({ meetingId, onStatusChange }: MeetingSyncReporterProps) {
  const { status } = useMeetingSync(meetingId)

  useEffect(() => {
    onStatusChange(status)
  }, [status, onStatusChange])

  return null
}
