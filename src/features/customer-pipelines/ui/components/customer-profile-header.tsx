'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { useAbility } from '@/shared/permissions/hooks'

interface Props {
  customer: CustomerProfileData['customer']
  onEditField?: (field: string) => void
}

export function CustomerProfileHeader({ customer, onEditField }: Props) {
  const ability = useAbility()
  const canEditContact = ability.can('update', 'Customer', 'name')

  const address = [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      {customer.phone && (
        <PhoneAction
          phone={customer.phone}
          canEdit={canEditContact}
          onEdit={() => onEditField?.('phone')}
        />
      )}

      {customer.email && (
        <EmailAction
          email={customer.email}
          canEdit={canEditContact}
          onEdit={() => onEditField?.('email')}
        />
      )}

      {address && (
        <AddressAction
          address={address}
          canEdit={canEditContact}
          onEdit={() => onEditField?.('address')}
        />
      )}
    </div>
  )
}
