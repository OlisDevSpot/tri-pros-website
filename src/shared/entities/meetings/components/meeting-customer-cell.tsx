'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { formatAddress } from '@/shared/lib/formatters'

interface MeetingCustomerCellProps {
  meeting: MeetingRow
  actions?: EntityActionConfig<MeetingRow>[]
}

export function MeetingCustomerCell({ meeting, actions }: MeetingCustomerCellProps) {
  const address = meeting.customerAddress
    ? formatAddress(meeting.customerAddress, meeting.customerCity ?? '', meeting.customerState ?? 'CA', meeting.customerZip ?? '')
    : null
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <PrimaryCell
          entity={meeting}
          actions={actions}
          title={meeting.customerName ?? '—'}
          subtitle={meeting.meetingType}
          tooltipContent={`${meeting.customerName ?? 'No customer'} — ${meeting.meetingType}`}
        />
      </div>
      {/* The phone arrives already gated: agents get null until a proposal is sent. */}
      <div className="flex shrink-0 items-center gap-1 text-muted-foreground" onClick={e => e.stopPropagation()}>
        {meeting.customerPhone && <PhoneAction phone={meeting.customerPhone} compact />}
        {address && <AddressAction address={address} compact />}
      </div>
    </div>
  )
}
