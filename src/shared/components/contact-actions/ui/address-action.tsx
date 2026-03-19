'use client'

import { CopyIcon, ExternalLinkIcon, GlobeIcon, MapPinIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { cn } from '@/shared/lib/utils'

interface AddressActionProps {
  address: string
  className?: string
  compact?: boolean
  children?: React.ReactNode
}

export function AddressAction({ address, className, compact = false, children }: AddressActionProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer',
              className,
            )}
            onClick={e => e.stopPropagation()}
          >
            <MapPinIcon size={14} className="shrink-0" />
            {!compact && <span className="truncate">{address}</span>}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => {
            window.open(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
              '_blank',
            )
          }}
        >
          <ExternalLinkIcon size={14} />
          Open in Google Maps
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            window.open(
              `https://earth.google.com/web/search/${encodeURIComponent(address)}`,
              '_blank',
            )
          }}
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
  )
}
