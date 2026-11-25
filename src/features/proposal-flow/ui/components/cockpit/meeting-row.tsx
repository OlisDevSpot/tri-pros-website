'use client'

import { useQuery } from '@tanstack/react-query'

import { COCKPIT_MEETING_HIDDEN } from '@/features/proposal-flow/constants/cockpit-actions'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { useTRPC } from '@/trpc/helpers'

export function MeetingRow({ customerId, meetingId }: { customerId: string, meetingId: string }) {
  const trpc = useTRPC()
  const profile = useQuery(trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }))

  if (profile.isPending) {
    return <Skeleton className="h-16 rounded-xl" />
  }
  const meeting = profile.data?.meetings.find(m => m.id === meetingId)
  if (!meeting) {
    return null
  }
  const hasOutcome = meeting.meetingOutcome !== 'not_set'

  return (
    <MeetingOverviewCard meeting={meeting} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-base font-semibold">In-home visit</p>
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <MeetingOverviewCard.Fields
            fields={[{ field: 'scheduledDate', format: 'date-only' }, { field: 'type' }, ...(hasOutcome ? [{ field: 'outcome', variant: 'badge' } as const] : [])]}
            className="flex-none"
          />
          {!hasOutcome && <span className="truncate">outcome not set</span>}
        </div>
      </div>
      <MeetingOverviewCard.Actions mode="compact" hide={COCKPIT_MEETING_HIDDEN} className="size-10 border border-control-border bg-control pointer-coarse:size-11" />
    </MeetingOverviewCard>
  )
}
