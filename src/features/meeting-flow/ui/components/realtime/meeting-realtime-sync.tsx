'use client'

import { AblyProvider, ChannelProvider } from 'ably/react'
import { MeetingSyncReporter } from '@/features/meeting-flow/ui/components/realtime/meeting-sync-reporter'
import { ablyClient } from '@/shared/services/providers/upstash/realtime-client'

interface MeetingRealtimeSyncProps {
  meetingId: string
  onStatusChange: (status: string) => void
}

/**
 * The only realtime surface in the app. It must stay browser-only (the meeting
 * flow loads it with `ssr: false`): the Ably client opens a socket on import,
 * and Ably's Node build cannot be bundled into server rendering.
 */
export function MeetingRealtimeSync({ meetingId, onStatusChange }: MeetingRealtimeSyncProps) {
  return (
    <AblyProvider client={ablyClient}>
      <ChannelProvider channelName={`meeting:${meetingId}`}>
        <MeetingSyncReporter meetingId={meetingId} onStatusChange={onStatusChange} />
      </ChannelProvider>
    </AblyProvider>
  )
}
