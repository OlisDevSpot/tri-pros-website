'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'

export function CockpitMeetingCard({ meeting }: { meeting: CustomerProfileMeeting }) {
  return (
    <MeetingOverviewCard meeting={meeting} className="overflow-hidden rounded-lg border border-border bg-card">
      <MeetingOverviewCard.Header className="border-b border-border px-4 py-3">
        <MeetingOverviewCard.Fields fields={[{ field: 'scheduledDate' }, { field: 'type' }]} />
        <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
      </MeetingOverviewCard.Header>
      <MeetingOverviewCard.Body className="px-4 py-3">
        <MeetingOverviewCard.Fields fields={[{ field: 'outcome', variant: 'editable' }]} />
      </MeetingOverviewCard.Body>
    </MeetingOverviewCard>
  )
}
