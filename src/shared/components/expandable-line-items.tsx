'use client'

import type { ReactNode } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

interface Item {
  id: string
  label: string
  value: string
  className?: string
}

interface Props {
  /** Clickable header — left side content (label, count, etc.) */
  label: ReactNode
  /** Clickable header — right side value */
  value: ReactNode
  /** Line items revealed on expand */
  items: Item[]
  /** Color class applied to the header button */
  className?: string
}

export function ExpandableLineItems({ label, value, items, className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn('flex items-center justify-between w-full', className)}
      >
        <span className="flex items-center gap-1">
          {label}
          <ChevronRightIcon
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150',
              open && 'rotate-90',
            )}
          />
        </span>
        <span className="tabular-nums shrink-0">{value}</span>
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-150 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-0.5 space-y-px">
            {items.map(item => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between pl-5 text-xs',
                  item.className ?? 'text-muted-foreground',
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className="tabular-nums shrink-0">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
