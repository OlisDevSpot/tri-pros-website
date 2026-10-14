'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { useAbility } from '@/shared/domains/permissions/client'
import { CustomerContactButtons } from '@/shared/entities/customers/components/customer-contact-buttons'
import { canAgentSeePhone } from '@/shared/entities/customers/lib/can-see-phone'
import { formatCustomerAddress } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { AddressEditDialog } from './address-edit-dialog'
import { CustomerContactAddressRow } from './customer-contact-address-row'
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
  // The phone hero adds call and email discs in thumb reach beside the name; the rows below still
  // show the number and the address, since a disc hides the value. Edit mode swaps rows for inputs.
  const showDiscs = isPhoto && !editForm.isEditing
  const address = formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })

  return (
    // The step from the name to the contact block is wider than the step between the block's rows.
    <div className="flex min-w-0 flex-col gap-2.5">
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
              // A phone has no hover to reveal a truncated name, so a long name wraps instead.
              <h2
                className={cn('line-clamp-2 min-w-0 text-2xl leading-tight font-semibold tracking-tight', isPhoto ? 'text-white' : 'text-foreground')}
                title={customer.name}
              >
                {customer.name}
              </h2>
            )}
        <CustomerEditToggle editForm={editForm} />
        {showDiscs && <CustomerContactButtons className="ml-auto" contact={{ phone: customer.phone, email: customer.email }} surface="image" />}
      </div>

      {/* Rows carry their own hover padding; the negative margin lines their text up with the name. */}
      <div className="-mx-2.5 flex min-w-0 flex-col">
        <CustomerContactAddressRow address={address} canEdit={editForm.canEditContact} onEdit={() => setAddressDialogOpen(true)} surface={surface} />
        <CustomerContactPhoneRow customer={customer} editForm={editForm} phoneUnlocked={phoneUnlocked} surface={surface} />
        <CustomerContactEmailRow customer={customer} editForm={editForm} surface={surface} />
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
