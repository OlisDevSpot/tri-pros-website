// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import type { SavingsCategory, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { BillCut } from '@/shared/modules/construction/core/types'

import { SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useTradeName } from '@/features/trade-scenes/hooks/use-trade-name'
import { cutSourceLabel } from '@/features/trade-scenes/lib/cut-source-label'
import { UnitMoneyField } from '@/features/trade-scenes/ui/components/fields/unit-money-field'
import { UnitNumberField } from '@/features/trade-scenes/ui/components/panel/unit-number-field'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { CUT_MODE_LABELS, CUT_MODES } from '@/shared/modules/construction/core/constants/cut-modes'

interface CutOverrideProps {
  category: SavingsCategory
  cut: BillCut
}

// The ROI calculator's bill-row override: From trades shows where the cut comes from; % or $ replaces it with a typed one.
export function CutOverride({ category, cut }: CutOverrideProps) {
  const mode = useSceneInputs((state: TradeSceneInputs) => state.bills[category].cut.mode)
  const value = useSceneInputs((state: TradeSceneInputs) => state.bills[category].cut.value)
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const tradeName = useTradeName()
  const label = SAVINGS_COPY.cutGroup(category)

  function setCut(next: TradeSceneInputs['bills'][SavingsCategory]['cut']) {
    const { bills } = inputs.getState()
    inputs.setState({ bills: { ...bills, [category]: { ...bills[category], cut: next } } })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        aria-label={label}
        type="single"
        variant="segmented"
        value={mode}
        onValueChange={(next) => {
          const picked = CUT_MODES.find(cutMode => cutMode === next)
          // A typed 30 % must not turn into $30 when the mode flips, so the value starts over.
          if (picked !== undefined && picked !== mode) {
            setCut({ mode: picked, value: null })
          }
        }}
      >
        {CUT_MODES.map(cutMode => <ToggleGroupItem key={cutMode} value={cutMode} className="h-11 px-3 text-sm">{CUT_MODE_LABELS[cutMode]}</ToggleGroupItem>)}
      </ToggleGroup>
      {mode === 'trades' && cut.parts.length > 0 && <p className="text-xs text-muted-foreground">{`−${Math.round(cut.combined * 1000) / 10}% · ${cut.parts.map(part => cutSourceLabel(part.source, tradeName)).join(', ')}`}</p>}
      {mode === 'amount' && (
        <UnitMoneyField
          cents
          aria-label={`${label}: ${SAVINGS_COPY.cutValue.amount}`}
          value={value}
          onChange={next => setCut({ mode, value: next })}
          unit={SAVINGS_COPY.cutSuffix.amount}
        />
      )}
      {mode === 'percent' && (
        <UnitNumberField
          className="w-40"
          hideLabel
          label={`${label}: ${SAVINGS_COPY.cutValue.percent}`}
          value={value}
          onChange={next => setCut({ mode, value: next })}
          suffix={SAVINGS_COPY.cutSuffix.percent}
          max={100}
        />
      )}
    </div>
  )
}
