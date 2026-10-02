'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import type { formatCustomerAddress } from '@/shared/lib/formatters'
import { MapPinIcon } from 'lucide-react'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { CustomerContactAddTrigger } from './customer-contact-add-trigger'

interface Props {
  address: ReturnType<typeof formatCustomerAddress>
  canEdit: boolean
  onEdit: () => void
  surface: ContactActionSurface
}

export function CustomerContactAddressRow({ address, canEdit, onEdit, surface }: Props) {
  if (!address.hasAddress) {
    return canEdit ? <CustomerContactAddTrigger label="Add address" onClick={onEdit} surface={surface} /> : null
  }

  return (
    <AddressAction address={address.singleLine} canEdit={canEdit} onEdit={onEdit}>
      <ContactActionTrigger icon={MapPinIcon} label={address.singleLine} surface={surface} />
    </AddressAction>
  )
}
