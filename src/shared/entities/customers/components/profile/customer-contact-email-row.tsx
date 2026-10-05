'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { MailIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { CustomerContactAddTrigger } from './customer-contact-add-trigger'
import { CustomerContactInputRow } from './customer-contact-input-row'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  surface: ContactActionSurface
}

export function CustomerContactEmailRow({ customer, editForm, surface }: Props) {
  const canEdit = editForm.canEditContact

  if (editForm.isEditing && canEdit) {
    return <CustomerContactInputRow icon={MailIcon} inputProps={editForm.form.register('email')} label="Email" surface={surface} type="email" />
  }

  if (customer.email) {
    return (
      <EmailAction canEdit={canEdit} email={customer.email} onEdit={() => editForm.startEditing('email')}>
        <ContactActionTrigger icon={MailIcon} label={customer.email} surface={surface} />
      </EmailAction>
    )
  }

  if (canEdit) {
    return <CustomerContactAddTrigger label="Add email" onClick={() => editForm.startEditing('email')} surface={surface} />
  }

  return null
}
