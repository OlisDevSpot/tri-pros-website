'use client'

import type { SavingsCategory, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { climateDefaultBill } from '@/features/trade-scenes/lib/climate-default-bill'
import { UnitMoneyField } from '@/features/trade-scenes/ui/components/fields/unit-money-field'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { BILL_CATEGORY_LABELS } from '@/shared/modules/construction/core/constants/bill-categories'

interface CostsBillRowProps {
  category: SavingsCategory
}

// A typed $0 is a real $0 (a home with no gas); clearing the field goes back to the climate's default.
export function CostsBillRow({ category }: CostsBillRowProps) {
  const id = useId()
  const climate = useSceneInputs((state: TradeSceneInputs) => state.climate)
  const now = useSceneInputs((state: TradeSceneInputs) => state.bills[category].now)
  const applyChange = useApplySceneChange()
  const { shape } = useSceneVisibleArea()
  const portrait = shape === 'portrait'
  const label = BILL_CATEGORY_LABELS[category]
  const typed = now !== null

  return (
    <div data-bill-row={category} className="contents">
      <label htmlFor={id} className="text-sm font-bold">{label}</label>
      <UnitMoneyField
        compact
        id={id}
        aria-label={BENEFITS_COPY.editor.billName(label)}
        value={now}
        placeholder={formatAsDollars(climateDefaultBill(climate, category))}
        unit={SAVINGS_COPY.billSuffix}
        onChange={next => applyChange({ kind: 'bill', category, now: next })}
        className={portrait ? 'w-28' : 'w-33'}
      />
      <span data-source-tag className={cn(CONTROLS_CLASSES.sourceTag, typed ? CONTROLS_CLASSES.sourceTagTyped : toneClasses('attention').fill, portrait && 'col-start-2 -mt-1 justify-self-end')}>
        {typed ? BENEFITS_COPY.editor.tags.typed : BENEFITS_COPY.editor.tags.working}
      </span>
    </div>
  )
}
