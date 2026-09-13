'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { formatCustomerAddress } from '@/shared/lib/formatters'

interface CustomerChipProps {
  customer: Pick<CustomerWithProfile, 'id' | 'name' | 'address' | 'city' | 'state' | 'zip'> | null
  meetingId: string
}

/**
 * The customer's identity in the top bar. One click opens the customer profile
 * modal; there are no contact actions here because the screen faces the homeowner.
 */
export function CustomerChip({ customer, meetingId }: CustomerChipProps) {
  const { open, setModal } = useModalStore()

  if (!customer) {
    return (
      <Button className="h-11 rounded-full px-3 text-muted-foreground" disabled size="sm" variant="ghost">
        {SHELL_COPY.noCustomer}
      </Button>
    )
  }

  const customerId = customer.id
  const address = formatCustomerAddress(customer)

  function handleClick() {
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId, highlightMeetingId: meetingId },
    })
    open()
  }

  return (
    <Button
      className="h-11 min-w-0 max-w-full gap-2 rounded-full pl-1.5 pr-3 hover:bg-muted hover:text-foreground"
      size="sm"
      title={SHELL_COPY.viewCustomerProfile}
      variant="ghost"
      onClick={handleClick}
    >
      <Avatar className="size-7">
        <AvatarFallback className="bg-muted text-[11px] font-bold text-foreground">
          {getInitials(customer.name)}
        </AvatarFallback>
      </Avatar>
      <span className="hidden min-w-0 text-left leading-tight md:grid">
        <span className="truncate text-[13px] font-semibold">{customer.name}</span>
        {address.hasAddress && (
          <span className="truncate text-[11px] font-normal text-muted-foreground">{address.singleLine}</span>
        )}
      </span>
      <span className="sr-only md:hidden">{customer.name}</span>
    </Button>
  )
}
