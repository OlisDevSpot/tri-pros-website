'use client'

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

interface EmailActionProps {
  canEdit?: boolean
  className?: string
  compact?: boolean
  email: string
  onEdit?: () => void
}

export function EmailAction({ canEdit, className, compact = false, email, onEdit }: EmailActionProps) {
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
      </DropdownMenu>
    </span>
  )
}
