'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import { CopyIcon, MailIcon } from 'lucide-react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Button } from '@/shared/components/ui/button'
import { copyToClipboard } from '@/shared/lib/clipboard'

interface Props {
  customer: CustomerProfileData['customer']
}

export function CustomerProfileHeader({ customer }: Props) {
  const address = [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      {customer.phone && <PhoneAction phone={customer.phone} />}

      {customer.email && (
        <span className="flex items-center gap-1.5">
          <MailIcon size={14} className="shrink-0" />
          <a
            href={`mailto:${customer.email}`}
            className="hover:text-foreground transition-colors"
          >
            {customer.email}
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => copyToClipboard(customer.email!, 'Email')}
          >
            <CopyIcon size={11} />
          </Button>
        </span>
      )}

      {address && <AddressAction address={address} />}
    </div>
  )
}
