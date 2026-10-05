'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { MailIcon, PhoneIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { formatPhone } from '@/shared/lib/phone'

interface Props {
  customer: CustomerProfileData['customer']
}

// Thumb-sized call and email beside the name on the phone hero; edit mode brings back full rows.
export function CustomerContactButtons({ customer }: Props) {
  if (!customer.phone && !customer.email) {
    return null
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {customer.phone && (
        <PhoneAction phone={customer.phone}>
          <ContactActionTrigger icon={PhoneIcon} label={`Call or text ${formatPhone(customer.phone)}`} shape="round" surface="image" />
        </PhoneAction>
      )}
      {customer.email && (
        <EmailAction email={customer.email}>
          <ContactActionTrigger icon={MailIcon} label={`Email ${customer.email}`} shape="round" surface="image" />
        </EmailAction>
      )}
    </div>
  )
}
