'use client'

import type { ReactNode } from 'react'
import type { HomeFactId } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

interface FactRowProps {
  id: HomeFactId
  label: string
  // As the tab counts and the group's dot count it.
  missing: boolean
  // The picked value's words; read only while the fact is set.
  value: string | null
  // For a control named by this row's label rather than by its own.
  labelId?: string
  children: ReactNode
}

// A missing fact marks its label; the value side says so quietly, so the label carries the alarm.
export function FactRow({ id, label, missing, value, labelId, children }: FactRowProps) {
  const attention = toneClasses('attention')

  return (
    <div data-fact-row={id} data-missing={missing || undefined} className="grid gap-2 border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} data-fact-label className={cn(CONTROLS_CLASSES.capsLabel, missing && attention.text)}>
          {missing && <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-[1px]" />}
          {label}
        </span>
        <span data-fact-value className={cn('font-bold', missing ? 'text-xs text-muted-foreground' : 'text-sm text-foreground')}>
          {missing ? CONTROLS_COPY.facts.missing : value}
        </span>
      </div>
      {children}
    </div>
  )
}
