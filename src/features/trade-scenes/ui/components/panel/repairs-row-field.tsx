// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import type { RepairsRow } from '@/features/trade-scenes/lib/repairs-rows'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'

import { SourceTag } from '@/features/calculators/remodel-roi-calculator/ui/components/story/source-tag'
import { REPAIRS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { UnitMoneyField } from '@/features/trade-scenes/ui/components/fields/unit-money-field'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Label } from '@/shared/components/ui/label'
import { formatAsDollars } from '@/shared/lib/formatters'
import { resolveOverridable } from '@/shared/lib/resolve-overridable'

interface RepairsRowFieldProps {
  row: RepairsRow
}

// Empty shows the team's working number as the placeholder; a typed figure is tagged as the homeowner's.
export function RepairsRowField({ row }: RepairsRowFieldProps) {
  const override = useSceneInputs((state: TradeSceneInputs) => state.repairsOverrides[row.trade] ?? null)
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const id = useId()
  const { source } = resolveOverridable(override, row.working)

  function setRepairs(next: number | null) {
    inputs.setState(state => ({ repairsOverrides: { ...state.repairsOverrides, [row.trade]: next } }))
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5">
      <span className="grid justify-items-start gap-1">
        <Label htmlFor={id} className="text-sm font-bold">{row.label}</Label>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-muted-foreground">
          {row.note}
          <SourceTag tag={source === 'input' ? 'yours' : 'assumption'} />
        </span>
      </span>
      <UnitMoneyField id={id} value={override} onChange={setRepairs} unit={REPAIRS_COPY.perYear} placeholder={formatAsDollars(row.working)} />
    </li>
  )
}
