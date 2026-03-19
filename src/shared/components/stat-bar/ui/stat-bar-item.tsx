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
    <div>
      {/* Mobile — centered vertical layout */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-border/50 py-3 lg:hidden">
        <Icon size={36} className={cn('absolute -right-1 -top-1 opacity-[0.07]', color)} />
        <span className="relative text-lg font-bold tabular-nums">{displayValue ?? value}</span>
        <span className="relative text-[10px] text-muted-foreground">{label}</span>
      </div>

      {/* Desktop — fixed height, equal width via grid */}
      <Card className="relative hidden h-[72px] overflow-hidden px-4 py-3 lg:flex lg:items-center">
        <Icon size={52} className={cn('absolute -right-1.5 -top-1.5 opacity-[0.07]', color)} />
        <div className="relative min-w-0">
          <p className="text-2xl font-semibold leading-tight tabular-nums">{displayValue ?? value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </Card>
    </div>
  )
}
