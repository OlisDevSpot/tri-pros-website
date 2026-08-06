'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'

import { CustomerTimeline } from '../timeline/customer-timeline'
import { CustomerProfileDetails } from './customer-profile-details'
import { CustomerRecordingPlayer } from './customer-recording-player'

interface Props {
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  onOpenMeeting: (meetingId: string) => void
}

export function CustomerProfileOverview({ data, editForm, onOpenMeeting }: Props) {
  // The recording is the richest artifact for an agent picking up a live lead,
  // so it anchors the top full-width. Below it, the workspace splits: activity
  // (where the agent logs the call) leads, qualification detail supports.
  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1">
      <CustomerRecordingPlayer customerId={data.customer.id} />
      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:flex-row">
        <div className="md:min-h-0 md:w-3/5 md:overflow-y-auto md:pr-1 md:[scrollbar-gutter:stable]">
          <CustomerTimeline data={data} onOpenMeeting={onOpenMeeting} />
        </div>
        <div className="space-y-4 md:min-h-0 md:w-2/5 md:overflow-y-auto md:pr-1 md:[scrollbar-gutter:stable]">
          <CustomerProfileDetails
            customer={data.customer}
            editForm={editForm}
          />
        </div>
      </div>
    </div>
  )
}
