'use client'

import type { CustomerProfileData } from '@/features/pipeline/types'

import { CopyIcon, ExternalLinkIcon, GlobeIcon, MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      {customer.phone && (
        <span className="flex items-center gap-1.5">
          <PhoneIcon size={14} className="shrink-0" />
          <a
            href={`tel:${customer.phone}`}
            className="hover:text-foreground transition-colors"
          >
            {formatAsPhoneNumber(customer.phone)}
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => copyToClipboard(customer.phone!, 'Phone')}
          >
            <CopyIcon size={11} />
          </Button>
        </span>
      )}

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

      {address && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
            >
              <MapPinIcon size={14} className="shrink-0" />
              {address}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank')}
            >
              <ExternalLinkIcon size={14} />
              Open in Google Maps
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(`https://earth.google.com/web/search/${encodeURIComponent(address)}`, '_blank')}
            >
              <GlobeIcon size={14} />
              Open in Google Earth
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => copyToClipboard(address, 'Address')}>
              <CopyIcon size={14} />
              Copy Address
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
