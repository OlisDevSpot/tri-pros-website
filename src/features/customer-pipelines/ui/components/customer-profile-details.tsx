'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import {
  customerProfileLabels,
  financialProfileLabels,
  propertyProfileLabels,
} from '@/features/customer-pipelines/constants/profile-field-labels'
import { ProfileCard } from '@/features/customer-pipelines/ui/components/profile-card'

interface Props {
  customer: CustomerProfileData['customer']
}

export function CustomerProfileDetails({ customer }: Props) {
  return (
    <div className="space-y-4">
      <ProfileCard
        title="Customer Profile"
        data={customer.customerProfileJSON as Record<string, unknown> | null}
        labels={customerProfileLabels}
      />
      <ProfileCard
        title="Property Profile"
        data={customer.propertyProfileJSON as Record<string, unknown> | null}
        labels={propertyProfileLabels}
      />
      <ProfileCard
        title="Financial Profile"
        data={customer.financialProfileJSON as Record<string, unknown> | null}
        labels={financialProfileLabels}
      />
    </div>
  )
}
