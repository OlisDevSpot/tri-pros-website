import type { LucideIcon } from 'lucide-react'

import { Card } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface Props {
  icon: LucideIcon
  label: string
  value: number
  displayValue?: string
  color?: string
}

export function StatBarItem({ icon: Icon, label, value, displayValue, color }: Props) {
  return (
    <>
      {/* Mobile */}
      <div className="flex items-center gap-2 rounded-lg border border-border/50 px-2 py-2 lg:hidden">
        <Icon size={14} className={cn('shrink-0 text-muted-foreground', color)} />
        <span className="text-sm font-semibold tabular-nums">{displayValue ?? value}</span>
        <span className="truncate text-[10px] text-muted-foreground">{label}</span>
      </div>

      {/* Desktop */}
      <Card className="hidden items-center gap-3 px-4 py-3 lg:flex">
        <Icon size={16} className={cn('shrink-0 text-muted-foreground', color)} />
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-tight tabular-nums">{displayValue ?? value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </Card>
    </>
  )
}
