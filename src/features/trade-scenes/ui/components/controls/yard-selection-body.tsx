'use client'

import type { ReactNode } from 'react'
import type { EditorSelection, FenceBrush, GroundBrush } from '@/features/trade-scenes/lib/create-layout-editor'
import type { PropertyLayout, TradeSceneInputs, YardId } from '@/features/trade-scenes/types'

import { ArrowLeftIcon, Trash2Icon } from 'lucide-react'

import { FENCE_KINDS_BY_LAYER } from '@/features/trade-scenes/constants/fence-kinds'
import { GROUND_MATERIALS, GROUND_MATERIALS_BY_LAYER, PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { CONTROLS_COPY, LOT_COPY, YARD_SYSTEM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useResolvedLayout } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { applyFenceStroke, applyStroke, commitLayout } from '@/features/trade-scenes/lib/create-layout-editor'
import { formatFeet, formatSquareFeet } from '@/features/trade-scenes/lib/format-feet'
import { hasAppearances } from '@/features/trade-scenes/lib/ground-appearance'
import { fenceLengthM, fenceLineCells, perimeterSideOf } from '@/features/trade-scenes/lib/lot-fences'
import { fenceLabel, fenceOptions, groundLabel, groundOptions } from '@/features/trade-scenes/lib/lot-options'
import { regionAreaM2, regionTileIndices } from '@/features/trade-scenes/lib/lot-regions'
import { fenceSelectionAt, regionSelectionAt } from '@/features/trade-scenes/lib/selection-at'
import { removeFenceLine, removeRegion } from '@/features/trade-scenes/lib/yard-picks'
import { LotPickChip } from '@/features/trade-scenes/ui/components/controls/lot-pick-chip'
import { SystemCardRow } from '@/features/trade-scenes/ui/components/controls/system-card-row'
import { GroundAppearancePicks } from '@/features/trade-scenes/ui/components/panel/ground-appearance-picks'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'

interface YardSelectionBodyProps {
  yard: YardId
  selected: EditorSelection
}

// The yard card on one region or one fence line: its chips change that thing only, and Remove takes it out of Today and the
// build at once. Mounted only from the yard card, where the lot is data.
export function YardSelectionBody({ yard, selected }: YardSelectionBodyProps) {
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const editor = useLayoutEditorApi()
  const resolved = useResolvedLayout()
  const { lot, tile } = resolved.layout
  const region = selected.type === 'region' ? resolved.regions.find(r => r.id === selected.id) : undefined
  const fence = selected.type === 'fence' ? resolved.fences.find(f => f.id === selected.id) : undefined
  if (!region && !fence) {
    return null
  }

  // An id names the first tile or cell of its thing, so a write that merges it with an earlier neighbour renames it; the
  // selection is found again from a tile or cell the write kept in the thing.
  const write = (next: (current: PropertyLayout) => PropertyLayout, follow: (after: PropertyLayout) => EditorSelection | null) => {
    const after = next(inputs.getState().layout)
    commitLayout(inputs, editor, after)
    editor.setState({ selected: follow(after) })
  }

  let name: string
  let chips: { today: ReactNode, build: ReactNode }
  let remove: () => void
  if (region) {
    // A region always has ground today: a tile with none belongs to no region.
    const material = region.existing!
    const system = GROUND_MATERIALS[material].system
    const what = system === null ? groundLabel(material) : YARD_SYSTEM_LABELS[system]
    const tiles = regionTileIndices(resolved.regions, lot, resolved.mask, resolved.yards, region.id)
    const anchor = Number(region.id)
    const paint = (brush: GroundBrush) => write(current => applyStroke(current, tiles, brush), after => regionSelectionAt(after, anchor))
    name = [what, formatSquareFeet(regionAreaM2(region, tile))].join(CONTROLS_COPY.systems.valueJoin)
    chips = {
      today: (
        <LotPickChip
          id="focus:today"
          keyLabel={what}
          label={what}
          options={groundOptions(GROUND_MATERIALS_BY_LAYER.existing)}
          value={material}
          labelOf={groundLabel}
          extra={hasAppearances(material, region.wear) && (
            <GroundAppearancePicks
              material={material}
              wear={region.wear}
              value={region.appearanceExisting}
              onPick={appearance => paint({ existing: null, proposed: null, appearanceExisting: appearance })}
            />
          )}
          wear={region.wear === null ? undefined : { value: region.wear, onPick: wear => paint({ existing: null, proposed: null, wear }) }}
          onPick={(next) => {
            // Today offers no Keep; only the build's menu ends with it.
            if (next !== PROPOSED_KEEP) {
              paint({ existing: next, proposed: null, wear: region.wear ?? undefined })
            }
          }}
        />
      ),
      build: (
        <LotPickChip
          id="focus:build"
          keyLabel={what}
          label={what}
          options={groundOptions(GROUND_MATERIALS_BY_LAYER.proposed)}
          value={region.proposed}
          labelOf={groundLabel}
          extra={region.proposed !== null && hasAppearances(region.proposed, null) && (
            <GroundAppearancePicks
              material={region.proposed}
              wear={null}
              value={region.appearanceProposed}
              onPick={appearance => paint({ existing: null, proposed: null, appearanceProposed: appearance })}
            />
          )}
          proposed
          addText={what}
          keep
          onPick={next => paint({ existing: null, proposed: next })}
        />
      ),
    }
    remove = () => write(current => removeRegion(current, tiles), () => null)
  }
  else {
    const line = fence!
    const side = perimeterSideOf(lot, line)
    const what = YARD_SYSTEM_LABELS.fencing
    const target = { axis: line.axis, indices: fenceLineCells(line, lot) }
    const paint = (brush: FenceBrush) => write(current => applyFenceStroke(current, target, brush), after => fenceSelectionAt(after, line.axis, line.line, line.from))
    name = [side === null ? LOT_COPY.inside : LOT_COPY.sides[side], formatFeet(fenceLengthM(line, tile))].join(CONTROLS_COPY.systems.valueJoin)
    chips = {
      today: (
        <LotPickChip
          id="focus:today"
          keyLabel={what}
          label={what}
          options={fenceOptions(FENCE_KINDS_BY_LAYER.existing)}
          value={line.existing}
          labelOf={fenceLabel}
          addText={what}
          onPick={(next) => {
            if (next !== PROPOSED_KEEP) {
              paint({ existing: next, proposed: null })
            }
          }}
        />
      ),
      build: (
        <LotPickChip
          id="focus:build"
          keyLabel={what}
          label={what}
          options={fenceOptions(FENCE_KINDS_BY_LAYER.proposed)}
          value={line.proposed}
          labelOf={fenceLabel}
          proposed
          addText={what}
          keep
          onPick={next => paint({ existing: null, proposed: next })}
        />
      ),
    }
    remove = () => write(current => removeFenceLine(current, line), () => null)
  }

  return (
    <div data-yard-focus={selected.type} className="grid gap-2.5">
      <p data-yard-focus-name className="text-sm font-bold">{name}</p>
      <SystemCardRow side="existing">{chips.today}</SystemCardRow>
      <SystemCardRow side="proposed">{chips.build}</SystemCardRow>
      <div className="grid gap-1">
        <Button type="button" variant="destructive" data-yard-focus-remove onClick={remove} className="h-11 w-full rounded-xl">
          <Trash2Icon aria-hidden />
          {region ? LOT_COPY.removeRegion : LOT_COPY.removeFence}
        </Button>
        <p className="text-xs text-muted-foreground">{region ? LOT_COPY.removeRegionHint : LOT_COPY.removeFenceHint}</p>
      </div>
      <Button type="button" variant="secondary" data-yard-focus-whole onClick={() => editor.setState({ yard, selected: null })} className="h-11 w-full rounded-xl">
        <ArrowLeftIcon aria-hidden />
        {LOT_COPY.wholeYard}
      </Button>
    </div>
  )
}
