'use client'

import type { ReceiptRow } from '@/features/calculators/remodel-roi-calculator/types'

import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { Receipt } from '@/features/calculators/remodel-roi-calculator/ui/components/story/receipt'
import { cn } from '@/shared/lib/utils'

interface Props {
  equation: string
  rows: ReceiptRow[]
}

export function ChapterMath({ equation, rows }: Props) {
  const [open, setOpen] = useState(false)
  if (!rows.length) {
    return null
  }
  return (
    <div className="grid gap-1">
      <button
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3.5 rounded-lg border bg-card px-3.5 py-2.5 text-left"
        onClick={() => setOpen(value => !value)}
        type="button"
      >
        <span className="flex-1 text-sm leading-snug tabular-nums">{equation}</span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-primary">
          {open ? STORY_COPY.hideMath : STORY_COPY.showMath}
          <ChevronDownIcon className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && <Receipt rows={rows} />}
    </div>
  )
}
