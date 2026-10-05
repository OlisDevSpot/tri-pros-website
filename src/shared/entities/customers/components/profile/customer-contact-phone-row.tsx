'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { PhoneIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { formatPhone } from '@/shared/lib/phone'
import { CustomerContactAddTrigger } from './customer-contact-add-trigger'
import { CustomerContactInputRow } from './customer-contact-input-row'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  phoneUnlocked: boolean
  surface: ContactActionSurface
}

export function CustomerContactPhoneRow({ customer, editForm, phoneUnlocked, surface }: Props) {
  const canEdit = editForm.canEditContact

  if (editForm.isEditing && canEdit) {
    return <CustomerContactInputRow icon={PhoneIcon} inputProps={editForm.form.register('phone')} label="Phone" surface={surface} type="tel" />
  }

  if (customer.phone) {
    return (
      <PhoneAction canEdit={canEdit} onEdit={() => editForm.startEditing('phone')} phone={customer.phone}>
        <ContactActionTrigger icon={PhoneIcon} label={formatPhone(customer.phone)} surface={surface} />
      </PhoneAction>
    )
  }

  // The DAL blanks a gated phone, so an agent who cannot see it gets no hint that one exists.
  if (phoneUnlocked && canEdit) {
    return <CustomerContactAddTrigger label="Add phone" onClick={() => editForm.startEditing('phone')} surface={surface} />
  }

  return null
}
