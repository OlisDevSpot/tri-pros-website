'use client'

import type { CSSProperties, MouseEvent } from 'react'
import type { BenefitLine, BenefitSelection } from '@/features/trade-scenes/types'
import type { BenefitKind } from '@/shared/modules/construction/core/constants/benefit-kinds'

import { Fragment } from 'react'

import { BENEFITS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { benefitCount } from '@/features/trade-scenes/lib/benefit-count'
import { MatrixCell } from '@/features/trade-scenes/ui/components/benefits/matrix-cell'
import { MatrixKindHead } from '@/features/trade-scenes/ui/components/benefits/matrix-kind-head'
import { MatrixSystemHead } from '@/features/trade-scenes/ui/components/benefits/matrix-system-head'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { BENEFIT_KINDS } from '@/shared/modules/construction/core/constants/benefit-kinds'
import { UPGRADE_REGISTRY } from '@/shared/modules/construction/core/constants/upgrade-registry'

interface BenefitsMatrixProps {
  portrait: boolean
}

// Systems down, kinds across, a dot per benefit line. Every row has a fixed height, so as the rail's wrapper widens the
// grid narrows by plain flex reflow, frame by frame, without a row ever changing height; only the systems scroll, under
// the held kinds row. No layout animation: its projection would squash the grid where the reflow already moves it. The
// scroll pads out by a focus ring's width and gives it back in margin, so the edge heads' and cells' rings clear its clip.
export function BenefitsMatrix({ portrait }: BenefitsMatrixProps) {
  const { lines, picks, now } = useBenefitsFigures()
  const { selection, select, openers } = useBenefits()
  // The build's one saving figure, never the systems' Savings lines added up: their cuts compound.
  const savingNow = now.saves
  const pick = (next: BenefitSelection) => (event: MouseEvent<HTMLButtonElement>) => {
    openers.selection.current = event.currentTarget
    select(next)
  }
  const summary = (kind: BenefitKind, ofKind: readonly BenefitLine[]) => {
    if (kind === 'savings') {
      // A phone column is too narrow for the suffix, as the readout drops it there too.
      return savingNow > 0 ? `${formatAsDollars(savingNow)}${portrait ? '' : SAVINGS_COPY.billSuffix}` : ''
    }
    if (kind === 'planet') {
      return ofKind.length > 0 ? BENEFITS_COPY.matrix.soon : ''
    }
    return ofKind.length > 0 ? String(ofKind.length) : ''
  }

  return (
    <div
      data-matrix-scroll
      style={{ '--matrix-ease': CONTROLS_EASE_CSS } as CSSProperties}
      className="-m-0.75 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-0.75"
    >
      <div
        data-benefits-matrix
        className={cn('grid content-start gap-y-0.5', portrait ? 'grid-cols-[66px_repeat(7,minmax(0,1fr))] gap-x-px' : 'grid-cols-[170px_repeat(7,minmax(0,1fr))] gap-x-0.5')}
      >
        <span aria-hidden className="sticky -top-0.75 z-1 -mt-0.75 bg-(--card) pt-0.75" />
        {BENEFIT_KINDS.map((kind) => {
          const ofKind = lines.filter(line => line.kind === kind)
          return (
            <MatrixKindHead
              key={kind}
              kind={kind}
              summary={summary(kind, ofKind)}
              count={benefitCount(ofKind)}
              pressed={selection?.type === 'kind' && selection.kind === kind}
              disabled={ofKind.length === 0}
              portrait={portrait}
              onPick={pick({ type: 'kind', kind })}
            />
          )
        })}
        {HOME_SYSTEM_IDS.map((system) => {
          const ofSystem = lines.filter(line => line.system === system)
          return (
            <Fragment key={system}>
              <MatrixSystemHead
                system={system}
                upgrades={picks[system].map(scopeId => UPGRADE_REGISTRY[scopeId].name)}
                count={benefitCount(ofSystem)}
                pressed={selection?.type === 'system' && selection.system === system}
                disabled={ofSystem.length === 0}
                portrait={portrait}
                onPick={pick({ type: 'system', system })}
              />
              {BENEFIT_KINDS.map(kind => (
                <MatrixCell
                  key={kind}
                  system={system}
                  kind={kind}
                  lines={ofSystem.filter(line => line.kind === kind)}
                  pressed={selection?.type === 'dot' && selection.system === system && selection.kind === kind}
                  lit={selection?.type === 'system' ? selection.system === system : selection?.type === 'kind' && selection.kind === kind}
                  portrait={portrait}
                  onPick={pick({ type: 'dot', system, kind })}
                />
              ))}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
