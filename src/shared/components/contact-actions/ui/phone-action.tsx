'use client'

import { ChevronDownIcon, CopyIcon, MessageSquareIcon, PencilIcon, PhoneIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { formatAsPhoneNumber } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface PhoneActionProps {
  canEdit?: boolean
  className?: string
  compact?: boolean
  onEdit?: () => void
  phone: string
}

export function PhoneAction({ canEdit, className, compact = false, onEdit, phone }: PhoneActionProps) {
  return (
    <span className={cn('flex items-center gap-1', className)}>
      <a
        href={`tel:${phone}`}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <PhoneIcon size={14} className="shrink-0" />
        {!compact && <span className="truncate">{formatAsPhoneNumber(phone)}</span>}
      </a>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center hover:text-foreground transition-colors cursor-pointer"
            onClick={e => e.stopPropagation()}
          >
            <ChevronDownIcon size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <a href={`tel:${phone}`}>
              <PhoneIcon size={14} />
              Call
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`sms:${phone}`}>
              <MessageSquareIcon size={14} />
              Text
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyToClipboard(phone, 'Phone')}>
            <CopyIcon size={14} />
            Copy
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon size={14} />
                Edit
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}
