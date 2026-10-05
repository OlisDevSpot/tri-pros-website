'use client'

import { PlusIcon } from 'lucide-react'
import { PROFILE_NEW_SHEET_ID } from '@/shared/entities/customers/constants/profile-modal'
import { cn } from '@/shared/lib/utils'

interface Props {
  className?: string
  onToggle: () => void
  open: boolean
}

// The raised center disc: it opens the New sheet and, turned into an ×, closes it again.
export function CustomerProfileNewButton({ className, onToggle, open }: Props) {
  return (
    <button
      aria-controls={PROFILE_NEW_SHEET_ID}
      aria-expanded={open}
      className={cn(
        'relative z-10 flex h-14 min-w-0 flex-col items-center justify-end gap-1 rounded-xl text-xs font-semibold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      onClick={onToggle}
      type="button"
    >
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card">
        <PlusIcon className={cn('size-6 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-45')} />
      </span>
      New
    </button>
  )
}
