'use client'

import type { ContactMenuControl } from '@/shared/components/contact-actions/types'

import { ChevronDownIcon, CopyIcon, MailIcon, PencilIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { cn } from '@/shared/lib/utils'

interface EmailActionProps extends ContactMenuControl {
  canEdit?: boolean
  children?: React.ReactNode
  className?: string
  compact?: boolean
  email: string
  onEdit?: () => void
}

export function EmailAction({ canEdit, children, className, compact = false, email, onEdit, open, onOpenChange, onCloseAutoFocus }: EmailActionProps) {
  const menu = (
    <DropdownMenuContent align="start" collisionPadding={8} onCloseAutoFocus={onCloseAutoFocus}>
      <DropdownMenuItem asChild>
        <a href={`mailto:${email}`}>
          <MailIcon size={14} />
          Send Email
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => copyToClipboard(email, 'Email')}>
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
  )

  if (children) {
    return (
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    )
  }

  return (
    <span className={cn('flex items-center gap-1', className)}>
      <a
        href={`mailto:${email}`}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <MailIcon size={14} className="shrink-0" />
        {!compact && <span className="truncate">{email}</span>}
      </a>

      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center hover:text-foreground transition-colors cursor-pointer"
            onClick={e => e.stopPropagation()}
          >
            <ChevronDownIcon size={12} />
          </button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    </span>
  )
}
