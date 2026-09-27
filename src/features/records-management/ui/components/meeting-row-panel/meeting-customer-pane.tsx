'use client'

import type { CustomerOverviewCardData } from '@/shared/entities/customers/components/overview-card'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'

interface MeetingCustomerPaneProps {
  customer: CustomerOverviewCardData | null
  hasCustomer: boolean
  isLoading: boolean
}

export function MeetingCustomerPane({ customer, hasCustomer, isLoading }: MeetingCustomerPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Customer" isLoading={isLoading}>
      {!hasCustomer || !customer
        ? <p className="text-sm text-muted-foreground">No customer linked</p>
        : (
            <CustomerOverviewCard customer={customer}>
              <CustomerOverviewCard.ContactActions />
              <CustomerOverviewCard.LeadSource />
              <CustomerOverviewCard.Campaign />
              <CustomerOverviewCard.Insights />
              <CustomerOverviewCard.ProfileFields />
            </CustomerOverviewCard>
          )}
    </ExpandedRowPanel.Pane>
  )
}
