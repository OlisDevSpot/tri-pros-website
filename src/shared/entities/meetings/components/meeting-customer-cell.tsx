'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { MapPinIcon } from 'lucide-react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { CustomerNameCell } from '@/shared/components/data-table/ui/customer-name-cell'
import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { formatAddress } from '@/shared/lib/formatters'

interface MeetingCustomerCellProps {
  meeting: MeetingRow
  actions?: EntityActionConfig<MeetingRow>[]
  onViewProfile?: (customerId: string) => void
}

export function MeetingCustomerCell({ meeting, actions, onViewProfile }: MeetingCustomerCellProps) {
  const address = meeting.customerAddress
    ? formatAddress(meeting.customerAddress, meeting.customerCity ?? '', meeting.customerState ?? 'CA', meeting.customerZip ?? '')
    : null
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <PrimaryCell
          entity={meeting}
          actions={actions}
          className="max-w-none"
          title={(
            <CustomerNameCell
              customerId={meeting.customerId}
              customerName={meeting.customerName}
              onViewProfile={onViewProfile}
              className="text-sm font-medium leading-tight text-foreground"
            />
          )}
          subtitle={address
            ? (
                <div className="min-w-0 text-muted-foreground" onClick={e => e.stopPropagation()}>
                  <AddressAction address={address}>
                    <button
                      type="button"
                      className="flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 text-left text-xs transition-colors hover:text-foreground"
                    >
                      <MapPinIcon size={14} className="shrink-0" />
                      <span className="truncate">{address}</span>
                    </button>
                  </AddressAction>
                </div>
              )
            : '—'}
        />
      </div>
      {/* The phone arrives already gated: agents get null until a proposal is sent. */}
      {meeting.customerPhone && (
        <div className="flex shrink-0 items-center text-muted-foreground" onClick={e => e.stopPropagation()}>
          <PhoneAction phone={meeting.customerPhone} compact />
        </div>
      )}
    </div>
  )
}
