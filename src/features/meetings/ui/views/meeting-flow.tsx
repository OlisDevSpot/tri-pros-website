'use client'

interface MeetingFlowViewProps {
  meetingId: string
}

export function MeetingFlowView({ meetingId }: MeetingFlowViewProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">
        {`Meeting flow — rebuilding (ID: ${meetingId})`}
      </p>
    </div>
  )
}
