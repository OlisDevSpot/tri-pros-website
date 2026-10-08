'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { TabsContent } from '@/shared/components/ui/tabs'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { CustomerMeetingsList } from '../lists/customer-meetings-list'
import { CustomerProjectsList } from '../lists/customer-projects-list'
import { CustomerProfileOverview } from './customer-profile-overview'

interface Props {
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  highlightMeetingId?: string
  onMutationSuccess: () => void
  onOpenMeeting: (meetingId: string) => void
}

export function CustomerProfileTabPanels({ data, editForm, highlightMeetingId, onMutationSuccess, onOpenMeeting }: Props) {
  return (
    <MeetingActionsHost>
      <TabsContent className="mt-0 p-4 md:p-6" value="overview">
        <CustomerProfileOverview data={data} editForm={editForm} onOpenMeeting={onOpenMeeting} />
      </TabsContent>
      <TabsContent className="mt-0 p-4 md:p-6" value="meetings">
        <CustomerMeetingsList highlightMeetingId={highlightMeetingId} meetings={data.meetings} />
      </TabsContent>
      <TabsContent className="mt-0 p-4 md:p-6" value="projects">
        <CustomerProjectsList data={data} highlightMeetingId={highlightMeetingId} onMutationSuccess={onMutationSuccess} />
      </TabsContent>
    </MeetingActionsHost>
  )
}
