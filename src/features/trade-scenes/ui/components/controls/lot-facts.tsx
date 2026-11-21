'use client'

import type { TradeSceneInputs, YardId } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { GROUND_MATERIALS, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { LOT_COPY, YARD_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useResolvedLayout } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { commitLayout } from '@/features/trade-scenes/lib/create-layout-editor'
import { groundLabel, yardBaseOptions } from '@/features/trade-scenes/lib/lot-options'
import { setYardBase } from '@/features/trade-scenes/lib/yard-picks'
import { presentYards } from '@/features/trade-scenes/lib/yards'
import { FactRow } from '@/features/trade-scenes/ui/components/controls/fact-row'
import { LotPerimeterFields } from '@/features/trade-scenes/ui/components/controls/lot-perimeter-fields'
import { LotPickChip } from '@/features/trade-scenes/ui/components/controls/lot-pick-chip'
import { SoonTiles } from '@/features/trade-scenes/ui/components/controls/soon-tiles'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

const BASE_OPTIONS = yardBaseOptions()

// Mounted only where the lot is data.
export function LotFacts() {
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const editor = useLayoutEditorApi()
  const { layout, yards } = useResolvedLayout()

  const commit = (yard: YardId, patch: Parameters<typeof setYardBase>[2]) => commitLayout(inputs, editor, setYardBase(inputs.getState().layout, yard, patch))

  return (
    <>
      <h3 className={`${CONTROLS_CLASSES.capsLabel} pt-2.5`}>{LOT_COPY.yardsToday}</h3>
      <p className="pb-1 text-xs text-muted-foreground">{LOT_COPY.yardsHint}</p>
      {presentYards(yards).map((yard) => {
        const base = layout.lot.bases[yard]
        return (
          <FactRow key={yard} id={yard} label={YARD_LABELS[yard]} missing={false} value={groundLabel(base.material)}>
            <LotPickChip
              id={`base:${yard}`}
              label={LOT_COPY.base(YARD_LABELS[yard])}
              options={BASE_OPTIONS}
              value={base.material}
              labelOf={groundLabel}
              wear={GROUND_MATERIALS[base.material].wears ? { value: base.wear, onPick: wear => commit(yard, { wear }) } : undefined}
              onPick={(material) => {
                if (material !== PROPOSED_KEEP) {
                  commit(yard, { material })
                }
              }}
            />
          </FactRow>
        )
      })}
      <h3 className={`${CONTROLS_CLASSES.capsLabel} pt-3 pb-2`}>{LOT_COPY.fencesToday}</h3>
      <LotPerimeterFields />
      <SoonTiles tiles={LOT_COPY.soonTiles} />
    </>
  )
}
