'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'

import { CustomerTimeline } from '../timeline/customer-timeline'
import { CustomerProfileDetails } from './customer-profile-details'
import { CustomerRecordingPlayer } from './customer-recording-player'

interface Props {
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  onMutationSuccess: () => void
}

export function CustomerProfileOverview({ data, editForm, onMutationSuccess }: Props) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="md:w-3/5">
        <CustomerTimeline data={data} onMutationSuccess={onMutationSuccess} />
      </div>
      <div className="space-y-4 md:w-2/5">
        <CustomerRecordingPlayer customerId={data.customer.id} />
        <CustomerProfileDetails
          editForm={editForm}
          customerProfileJSON={data.customer.customerProfileJSON as Record<string, unknown> | null}
          propertyProfileJSON={data.customer.propertyProfileJSON as Record<string, unknown> | null}
          financialProfileJSON={data.customer.financialProfileJSON as Record<string, unknown> | null}
        />
      </div>
    </div>
  )
}
