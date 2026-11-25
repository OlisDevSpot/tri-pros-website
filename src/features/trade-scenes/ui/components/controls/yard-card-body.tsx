'use client'

import type { GroundLayer, GroundSystemId, PropertyLayout, TradeSceneInputs, YardId } from '@/features/trade-scenes/types'

import { PlusIcon } from 'lucide-react'

import { PROPOSED_KEEP } from '@/features/trade-scenes/constants/ground-materials'
import { CONTROLS_COPY, LOT_COPY, YARD_SYSTEM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { GROUND_SYSTEM_IDS, YARD_LOT_SIDES } from '@/features/trade-scenes/constants/yards'
import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useResolvedLayout } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { commitLayout, startDrawing } from '@/features/trade-scenes/lib/create-layout-editor'
import { hasAppearances } from '@/features/trade-scenes/lib/ground-appearance'
import { fenceLabel, fenceOptions, groundLabel, groundOptions, systemMaterials } from '@/features/trade-scenes/lib/lot-options'
import { perimeterKindsFor } from '@/features/trade-scenes/lib/perimeter-kinds'
import { setYardBuild, setYardFence, setYardGround, yardFence, yardGroundBuild, yardGroundToday } from '@/features/trade-scenes/lib/yard-picks'
import { ControlsChip } from '@/features/trade-scenes/ui/components/controls/controls-chip'
import { LotPickChip } from '@/features/trade-scenes/ui/components/controls/lot-pick-chip'
import { SystemCardRow } from '@/features/trade-scenes/ui/components/controls/system-card-row'
import { YardSelectionBody } from '@/features/trade-scenes/ui/components/controls/yard-selection-body'
import { GroundAppearancePicks } from '@/features/trade-scenes/ui/components/panel/ground-appearance-picks'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

interface YardCardBodyProps {
  yard: YardId
}

// A yard's systems, as a system action card's rows: Today has a chip per system the yard has, the build one per system it can
// take there. Each chip acts on the yard's whole share of its system; a region or fence line tapped in the scene is the
// card's one thing, and a region or fence of its own is drawn. A system the yard lacks today is added by drawing it in
// the build. Mounted only where the lot is data.
export function YardCardBody({ yard }: YardCardBodyProps) {
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const editor = useLayoutEditorApi()
  const selected = useLayoutEditor(state => state.selected)
  const { layout, yards, regions, fences } = useResolvedLayout()
  // A selection can outlive its thing: an undo or a write elsewhere may have painted it away.
  const stands = selected !== null && (selected.type === 'region' ? regions : fences).some(thing => thing.id === selected.id)
  if (stands) {
    return <YardSelectionBody yard={yard} selected={selected} />
  }
  const { lot } = layout
  const commit = (write: (current: PropertyLayout) => PropertyLayout) => commitLayout(inputs, editor, write(inputs.getState().layout))
  const ground = GROUND_SYSTEM_IDS.flatMap((system) => {
    const today = yardGroundToday(lot, yards, yard, system)
    return today === null ? [] : [{ system, today, build: yardGroundBuild(lot, yards, yard, system) }]
  })
  const fenceToday = yardFence(layout, yards, yard, 'existing')
  const materialsOf = (system: GroundSystemId, layer: GroundLayer) => groundOptions(systemMaterials(system, layer))
  const kindsOf = (layer: GroundLayer) => fenceOptions(perimeterKindsFor(YARD_LOT_SIDES[yard], layer))
  const drawInBuild = (start: () => void) => {
    inputs.setState({ view: 'proposed' })
    start()
  }

  return (
    <>
      <SystemCardRow side="existing">
        {ground.map(({ system, today }) => (
          <LotPickChip
            key={system}
            id={`today:${system}`}
            keyLabel={YARD_SYSTEM_LABELS[system]}
            label={YARD_SYSTEM_LABELS[system]}
            options={materialsOf(system, 'existing')}
            value={today.material}
            labelOf={groundLabel}
            extra={today.material !== 'mixed' && hasAppearances(today.material, today.wear === 'mixed' ? null : today.wear) && (
              <GroundAppearancePicks
                material={today.material}
                wear={today.wear === 'mixed' ? null : today.wear}
                value={today.appearance}
                onPick={appearance => commit(current => setYardGround(current, yard, system, { appearance }))}
              />
            )}
            wear={today.wear === null ? undefined : { value: today.wear, onPick: wear => commit(current => setYardGround(current, yard, system, { wear })) }}
            onPick={(material) => {
              // Today offers no Keep; only the build's menu ends with it.
              if (material !== PROPOSED_KEEP) {
                commit(current => setYardGround(current, yard, system, { material }))
              }
            }}
          />
        ))}
        <LotPickChip
          id="today:fencing"
          keyLabel={YARD_SYSTEM_LABELS.fencing}
          label={YARD_SYSTEM_LABELS.fencing}
          options={kindsOf('existing')}
          value={fenceToday}
          labelOf={fenceLabel}
          addText={YARD_SYSTEM_LABELS.fencing}
          onPick={kind => commit(current => setYardFence(current, yard, 'existing', kind))}
        />
      </SystemCardRow>
      <SystemCardRow side="proposed">
        {GROUND_SYSTEM_IDS.map((system) => {
          const today = ground.find(each => each.system === system)
          return today
            ? (
                <LotPickChip
                  key={system}
                  id={`build:${system}`}
                  keyLabel={YARD_SYSTEM_LABELS[system]}
                  label={YARD_SYSTEM_LABELS[system]}
                  options={materialsOf(system, 'proposed')}
                  value={today.build?.material ?? null}
                  labelOf={groundLabel}
                  extra={today.build !== null && today.build.material !== 'mixed' && hasAppearances(today.build.material, null) && (
                    <GroundAppearancePicks
                      material={today.build.material}
                      wear={null}
                      value={today.build.appearance}
                      onPick={appearance => commit(current => setYardBuild(current, yard, system, { appearance }))}
                    />
                  )}
                  proposed
                  addText={YARD_SYSTEM_LABELS[system]}
                  keep
                  onPick={material => commit(current => setYardBuild(current, yard, system, { material }))}
                />
              )
            : (
                <ControlsChip
                  key={system}
                  data-lot-chip={`build:${system}`}
                  variant="add"
                  icon={PlusIcon}
                  onClick={() => drawInBuild(() => startDrawing(editor, 'ground', systemMaterials(system, 'proposed')[0]))}
                >
                  {YARD_SYSTEM_LABELS[system]}
                </ControlsChip>
              )
        })}
        {fenceToday === null && (
          <ControlsChip
            data-lot-chip="build:fencing"
            variant="add"
            icon={PlusIcon}
            onClick={() => drawInBuild(() => startDrawing(editor, 'fence', perimeterKindsFor(YARD_LOT_SIDES[yard], 'proposed')[0]))}
          >
            {YARD_SYSTEM_LABELS.fencing}
          </ControlsChip>
        )}
        {fenceToday !== null && (
          <LotPickChip
            id="build:fencing"
            keyLabel={YARD_SYSTEM_LABELS.fencing}
            label={YARD_SYSTEM_LABELS.fencing}
            options={kindsOf('proposed')}
            value={yardFence(layout, yards, yard, 'proposed')}
            labelOf={fenceLabel}
            proposed
            addText={YARD_SYSTEM_LABELS.fencing}
            keep
            onPick={kind => commit(current => setYardFence(current, yard, 'proposed', kind))}
          />
        )}
        <ControlsChip data-lot-chip="build:patio-cover" variant="add" aria-disabled>
          {`${YARD_SYSTEM_LABELS['patio-cover']}${CONTROLS_COPY.systems.valueJoin}${CONTROLS_COPY.facts.soon}`}
        </ControlsChip>
      </SystemCardRow>
      <p className="text-xs text-muted-foreground">{LOT_COPY.drawHint}</p>
    </>
  )
}
