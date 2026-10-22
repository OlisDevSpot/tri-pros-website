'use client'

import { PROPOSAL_CUSTOMER_OVERRIDES } from '@/features/proposal-flow/lib/customer-action-overrides'
import { cn } from '@/shared/lib/utils'
import { CustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'

import { CustomerRow } from './cockpit/customer-row'
import { MeetingRow } from './cockpit/meeting-row'

interface Props {
  customerId: string
  meetingId: string | null
  className?: string
}

export function ProposalContextBand({ customerId, meetingId, className }: Props) {
  return (
    <MeetingActionsHost>
      <CustomerActionsHost overrides={PROPOSAL_CUSTOMER_OVERRIDES}>
        <div className={cn('grid gap-3 md:grid-cols-2', className)}>
          <CustomerRow customerId={customerId} />
          {meetingId && <MeetingRow customerId={customerId} meetingId={meetingId} />}
        </div>
      </CustomerActionsHost>
    </MeetingActionsHost>
  )
}
