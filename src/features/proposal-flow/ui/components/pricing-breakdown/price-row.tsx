import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface Props {
  label: ReactNode
  value: ReactNode
  className?: string
}

export function PriceRow({ label, value, className }: Props) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 whitespace-nowrap tabular-nums">{value}</span>
    </div>
  )
}
