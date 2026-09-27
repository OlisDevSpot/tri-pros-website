'use client'

import type { CustomerOverviewCardData } from '@/shared/entities/customers/components/overview-card'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'

interface MeetingCustomerPaneProps {
  customer: CustomerOverviewCardData | null
  hasCustomer: boolean
  isLoading: boolean
  leadSource: MeetingRow['leadSource']
}

export function MeetingCustomerPane({ customer, hasCustomer, isLoading, leadSource }: MeetingCustomerPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Customer" isLoading={isLoading}>
      {!hasCustomer || !customer
        ? <p className="text-sm text-muted-foreground">No customer linked</p>
        : (
            <CustomerOverviewCard customer={customer} leadSource={leadSource}>
              <CustomerOverviewCard.ContactActions />
              <CustomerOverviewCard.LeadSource />
              <CustomerOverviewCard.Insights />
              <CustomerOverviewCard.ProfileFields />
            </CustomerOverviewCard>
          )}
    </ExpandedRowPanel.Pane>
  )
}
