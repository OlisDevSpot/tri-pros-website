import { CheckIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface Props {
  state: 'active' | 'done' | 'pending'
  number?: number
  className?: string
}

export function StepMarker({ state, number, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
        state === 'active' && 'bg-primary text-primary-foreground',
        state === 'done' && 'bg-primary text-primary-foreground',
        state === 'pending' && (number == null ? 'border-[1.5px] border-dashed border-muted-foreground/60' : 'bg-muted text-muted-foreground'),
        className,
      )}
    >
      {state === 'done' ? <CheckIcon className="size-3.5" /> : number}
    </span>
  )
}
