'use client'

import type { RepairsRow } from '@/features/trade-scenes/lib/repairs-rows'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ValueSource } from '@/shared/lib/resolve-overridable'

import { useId } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { UnitMoneyField } from '@/features/trade-scenes/ui/components/fields/unit-money-field'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface CostsRepairsRowProps {
  row: RepairsRow
  source: ValueSource
}

// The working figure follows the material's condition, so it shows as the placeholder until one is typed.
export function CostsRepairsRow({ row, source }: CostsRepairsRowProps) {
  const id = useId()
  const perYear = useSceneInputs((state: TradeSceneInputs) => state.repairsOverrides[row.trade] ?? null)
  const applyChange = useApplySceneChange()
  const { shape } = useSceneVisibleArea()
  const portrait = shape === 'portrait'
  const typed = source === 'input'

  return (
    <div data-repairs-row={row.material} className="contents">
      <label htmlFor={id} className="grid text-sm leading-tight font-bold">
        <span data-repairs-label>{row.label}</span>
        <small data-repairs-note className="text-xs font-semibold text-muted-foreground">{row.note}</small>
      </label>
      <UnitMoneyField
        compact
        id={id}
        aria-label={BENEFITS_COPY.editor.repairsName(row.label)}
        value={perYear}
        placeholder={formatAsDollars(row.working)}
        unit={SAVINGS_COPY.repairsSuffix}
        onChange={next => applyChange({ kind: 'repairs', trade: row.trade, perYear: next })}
        className={portrait ? 'w-28' : 'w-33'}
      />
      <span data-source-tag className={cn(CONTROLS_CLASSES.sourceTag, typed ? CONTROLS_CLASSES.sourceTagTyped : toneClasses('attention').fill, portrait && 'col-start-2 -mt-1 justify-self-end')}>
        {typed ? BENEFITS_COPY.editor.tags.typed : BENEFITS_COPY.editor.tags.working}
      </span>
    </div>
  )
}
