'use client'

import type { MouseEvent } from 'react'
import type { BenefitKind } from '@/shared/modules/construction/core/constants/benefit-kinds'

import { BENEFIT_KIND_ICONS } from '@/features/trade-scenes/constants/benefit-kind-icons'
import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { cn } from '@/shared/lib/utils'
import { BENEFIT_KIND_LABELS } from '@/shared/modules/construction/core/constants/benefit-kinds'

interface MatrixKindHeadProps {
  kind: BenefitKind
  // Under the name: the saving now for Savings, "soon" for Planet, a count for the rest.
  summary: string
  // How many benefits the column holds, as its name reads it.
  count: string
  pressed: boolean
  disabled: boolean
  portrait: boolean
  onPick: (event: MouseEvent<HTMLButtonElement>) => void
}

// Held at the top while the systems scroll under it, on the window's own fill. It reaches up over the scroll's top
// padding, so no row shows above it and it never moves to stick. A one-line name sits on the same line as the last line
// of a two-line one, so the summaries share a baseline.
export function MatrixKindHead({ kind, summary, count, pressed, disabled, portrait, onPick }: MatrixKindHeadProps) {
  const Icon = BENEFIT_KIND_ICONS[kind]
  const label = BENEFIT_KIND_LABELS[kind]

  return (
    <div className="sticky -top-0.75 z-1 -mt-0.75 min-w-0 bg-(--card) pt-0.75">
      <button
        type="button"
        data-matrix-kind={kind}
        aria-pressed={pressed}
        aria-label={BENEFITS_COPY.matrix.headName(label, count)}
        disabled={disabled}
        onClick={onPick}
        className={cn(CONTROLS_CLASSES.matrixHead, 'grid content-end justify-items-center gap-0.5 px-0.5 text-center', portrait ? 'h-11.5 pb-1' : 'h-18 pb-1.5')}
      >
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        {!portrait && (
          <span className="flex min-h-7.5 items-end">
            <span className="line-clamp-2 text-xs leading-tight font-bold">{label}</span>
          </span>
        )}
        <span className={cn('min-h-4 text-xs leading-4 font-bold tabular-nums', kind === 'savings' ? 'text-primary' : 'text-muted-foreground')}>{summary}</span>
      </button>
    </div>
  )
}
