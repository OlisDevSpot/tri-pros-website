'use client'

import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'

interface Props {
  onRetry: () => void
}

// Shared by the meetings and activities calendars so a failed read gets the same
// treatment as the kanban board and the meetings table: ErrorState plus a retry.
export function ScheduleCalendarErrorState({ onRetry }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border">
      <ErrorState className="border-none" title="Could not load schedule" description="Please try again." />
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}
