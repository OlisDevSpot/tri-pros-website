import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface EditorialEyebrowProps {
  children: ReactNode
  className?: string
}

export function EditorialEyebrow({ children, className }: EditorialEyebrowProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground',
        className,
      )}
    >
      <span aria-hidden className="h-px w-8 bg-primary" />
      <span>{children}</span>
    </div>
  )
}
