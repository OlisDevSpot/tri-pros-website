'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { useAbility } from '@/shared/domains/permissions/client'
import { canAgentSeePhone } from '@/shared/entities/customers/lib/can-see-phone'
import { formatCustomerAddress } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { AddressEditDialog } from './address-edit-dialog'
import { CustomerContactAddressRow } from './customer-contact-address-row'
import { CustomerContactButtons } from './customer-contact-buttons'
import { CustomerContactEmailRow } from './customer-contact-email-row'
import { CustomerContactPhoneRow } from './customer-contact-phone-row'
import { CustomerEditToggle } from './customer-edit-toggle'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  // `rail` sits on the card surface of the desktop rail; `photo` sits on the phone hero image.
  layout: 'rail' | 'photo'
}

export function CustomerHeroHeader({ customer, editForm, layout }: Props) {
  const ability = useAbility()
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const phoneUnlocked = canAgentSeePhone(ability, customer)
  const isPhoto = layout === 'photo'
  const surface = isPhoto ? 'image' : 'card'
  // The phone hero keeps call and email as discs beside the name; edit mode needs the full rows.
  const showButtons = isPhoto && !editForm.isEditing
  const address = formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        {editForm.isEditing && editForm.canEditContact
          ? (
              <Input
                {...editForm.form.register('name')}
                aria-label="Customer name"
                className={cn('h-9 w-full max-w-80 text-lg font-semibold', isPhoto && 'border-white/20 bg-white/10 text-white placeholder:text-white/50')}
                placeholder="Customer name"
              />
            )
          : (
              <h2
                className={cn('min-w-0 truncate text-2xl leading-tight font-semibold tracking-tight', isPhoto ? 'text-white' : 'text-foreground')}
                title={customer.name}
              >
                {customer.name}
              </h2>
            )}
        <CustomerEditToggle editForm={editForm} />
        {showButtons && <CustomerContactButtons customer={customer} />}
      </div>

      {/* Rows carry their own hover padding; the negative margin lines their text up with the name. */}
      <div className="-mx-2.5 flex min-w-0 flex-col">
        <CustomerContactAddressRow address={address} canEdit={editForm.canEditContact} onEdit={() => setAddressDialogOpen(true)} surface={surface} />
        {!showButtons && (
          <>
            <CustomerContactPhoneRow customer={customer} editForm={editForm} phoneUnlocked={phoneUnlocked} surface={surface} />
            <CustomerContactEmailRow customer={customer} editForm={editForm} surface={surface} />
          </>
        )}
      </div>

      <AddressEditDialog
        customerId={customer.id}
        defaultAddress={address.singleLine}
        isOpen={addressDialogOpen}
        onClose={() => setAddressDialogOpen(false)}
      />
    </div>
  )
}
