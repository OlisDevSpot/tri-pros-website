'use client'

import { CopyIcon, PhoneIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { formatAsPhoneNumber } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface PhoneActionProps {
  phone: string
  className?: string
  compact?: boolean
}

export function PhoneAction({ phone, className, compact = false }: PhoneActionProps) {
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <PhoneIcon size={14} className="shrink-0" />
      {!compact && (
        <a
          href={`tel:${phone}`}
          className="hover:text-foreground transition-colors truncate"
        >
          {formatAsPhoneNumber(phone)}
        </a>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          copyToClipboard(phone, 'Phone')
        }}
      >
        <CopyIcon size={11} />
      </Button>
    </span>
  )
}
