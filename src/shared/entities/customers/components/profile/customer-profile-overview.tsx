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
  // The recording is the richest artifact for an agent picking up a live lead, so it leads. The
  // pane scrolls as one; activity and qualification sit side by side only from xl, because below
  // that the rail leaves the pane too narrow for two columns.
  return (
    <div className="flex flex-col gap-4">
      {data.hasRecording && <CustomerRecordingPlayer customerId={data.customer.id} />}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 xl:w-3/5">
          <CustomerTimeline data={data} onOpenMeeting={onOpenMeeting} />
        </div>
        <div className="min-w-0 space-y-4 xl:w-2/5">
          <CustomerProfileDetails customer={data.customer} editForm={editForm} />
        </div>
      </div>
    </div>
  )
}
