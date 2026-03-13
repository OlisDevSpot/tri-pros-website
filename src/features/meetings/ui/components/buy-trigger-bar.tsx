'use client'

import type { BuyTrigger } from '@/features/meetings/types'
import { triggerConfig } from '@/features/meetings/constants/trigger-config'
import { cn } from '@/shared/lib/utils'

interface BuyTriggerBarProps {
  className?: string
  trigger: BuyTrigger
}

export function BuyTriggerBar({ className, trigger }: BuyTriggerBarProps) {
  const config = triggerConfig[trigger.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-2 border px-4 py-2 text-sm font-medium',
        config.bg,
        config.text,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{trigger.message}</span>
    </div>
  )
}
