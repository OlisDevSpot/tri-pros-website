'use client'

import type { MouseEvent } from 'react'
import type { BenefitLine, HomeSystemId } from '@/features/trade-scenes/types'
import type { BenefitKind } from '@/shared/modules/construction/core/constants/benefit-kinds'

import { BENEFITS_COPY, HOME_SYSTEM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { benefitCount } from '@/features/trade-scenes/lib/benefit-count'
import { cn } from '@/shared/lib/utils'
import { BENEFIT_KIND_LABELS } from '@/shared/modules/construction/core/constants/benefit-kinds'

interface MatrixCellProps {
  system: HomeSystemId
  kind: BenefitKind
  lines: BenefitLine[]
  // The cell is the picked dot.
  pressed: boolean
  // Its row or its column is picked.
  lit: boolean
  portrait: boolean
  onPick: (event: MouseEvent<HTMLButtonElement>) => void
}

// One dot per benefit line; a coming-soon line is a dashed ring.
export function MatrixCell({ system, kind, lines, pressed, lit, portrait, onPick }: MatrixCellProps) {
  return (
    <button
      type="button"
      data-matrix-cell={`${system}:${kind}`}
      data-lit={lit || undefined}
      aria-pressed={pressed}
      aria-label={BENEFITS_COPY.matrix.cellName(HOME_SYSTEM_LABELS[system], BENEFIT_KIND_LABELS[kind], benefitCount(lines))}
      disabled={lines.length === 0}
      onClick={onPick}
      className={cn(
        'flex h-11 min-w-0 cursor-pointer flex-wrap content-center items-center justify-center rounded-[10px] bg-band outline-none',
        'transition-[background-color,box-shadow] duration-160 ease-(--matrix-ease) motion-reduce:transition-none',
        'not-data-lit:not-aria-pressed:enabled:hover:bg-muted pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default',
        'data-lit:bg-row-selected aria-pressed:bg-row-selected aria-pressed:inset-ring-2 aria-pressed:inset-ring-primary',
        portrait ? 'gap-0.75 px-0.5' : 'gap-1 px-1',
      )}
    >
      {lines.map(line => (
        <span
          key={`${line.from}:${line.title}`}
          data-matrix-dot={line.soon ? 'soon' : 'benefit'}
          className={cn('shrink-0 rounded-full', portrait ? 'size-1.5' : 'size-2', line.soon ? 'border-[1.5px] border-dashed border-muted-foreground' : 'bg-primary')}
        />
      ))}
    </button>
  )
}
