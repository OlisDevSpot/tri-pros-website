'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { UserIcon } from 'lucide-react'
import { COCKPIT_CUSTOMER_HIDDEN_ACTIONS } from '@/features/proposal-flow/constants/cockpit-actions'
import { OverviewCard } from '@/shared/components/entities/overview-card/overview-card'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'
import { PRESENTABLE_INSIGHT_FIELDS } from '@/shared/modules/customers/core/constants/presentable-insight-fields'

export function CockpitCustomerCard({ profile }: { profile: CustomerProfileData }) {
  return (
    <OverviewCard>
      <CustomerOverviewCard customer={profile.customer} className="gap-0">
        <OverviewCard.Header
          icon={<UserIcon className="size-4" />}
          eyebrow="Customer"
          title={profile.customer.name}
          actions={<CustomerOverviewCard.Actions mode="compact" hide={COCKPIT_CUSTOMER_HIDDEN_ACTIONS} />}
        />
        <OverviewCard.Body>
          <CustomerOverviewCard.ContactActions />
          <CustomerOverviewCard.Insights fields={PRESENTABLE_INSIGHT_FIELDS} />
          <OverviewCard.Section label="Notes">
            <CustomerOverviewCard.Notes notes={profile.notes} />
          </OverviewCard.Section>
        </OverviewCard.Body>
      </CustomerOverviewCard>
    </OverviewCard>
  )
}
