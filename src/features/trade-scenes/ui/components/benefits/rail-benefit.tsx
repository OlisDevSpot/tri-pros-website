'use client'

import type { BenefitLine } from '@/features/trade-scenes/types'

import { BENEFITS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface RailBenefitProps {
  line: BenefitLine
}

// The figure sits right only where the line has one; a line worked out from the picks names no upgrade.
export function RailBenefit({ line }: RailBenefitProps) {
  return (
    <div data-rail-line className="grid gap-0.5 border-t border-border py-2 first-of-type:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <b data-rail-line-title className="text-sm leading-snug font-bold">{line.title}</b>
        {line.figure !== null
          ? <b data-rail-line-figure className={cn('text-sm font-bold whitespace-nowrap tabular-nums', toneClasses('success').text)}>{`${formatAsDollars(line.figure)}${SAVINGS_COPY.billSuffix}`}</b>
          : line.soon && <span className="text-xs font-bold whitespace-nowrap text-muted-foreground">{BENEFITS_COPY.rail.soon}</span>}
      </div>
      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{line.detail}</p>
      {line.from !== null && <span data-rail-line-from className="text-xs text-muted-foreground">{line.from}</span>}
    </div>
  )
}
