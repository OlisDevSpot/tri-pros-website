'use client'

import type { CustomerProfileData } from '@/features/pipeline/types'

import { CopyIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { formatAsPhoneNumber } from '@/shared/lib/formatters'

interface Props {
  customer: CustomerProfileData['customer']
}

export function CustomerProfileHeader({ customer }: Props) {
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  const address = [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">{customer.name}</h2>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {customer.phone && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-sm"
            onClick={() => copyToClipboard(customer.phone!, 'Phone')}
          >
            <PhoneIcon size={14} />
            {formatAsPhoneNumber(customer.phone)}
            <CopyIcon size={11} className="opacity-50" />
          </Button>
        )}

        {customer.email && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-sm"
            onClick={() => copyToClipboard(customer.email!, 'Email')}
          >
            <MailIcon size={14} />
            {customer.email}
            <CopyIcon size={11} className="opacity-50" />
          </Button>
        )}

        {address && (
          <span className="flex items-center gap-1.5">
            <MapPinIcon size={14} />
            {address}
          </span>
        )}
      </div>
    </div>
  )
}
