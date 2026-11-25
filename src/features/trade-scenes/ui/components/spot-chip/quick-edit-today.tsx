'use client'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { conditionTitle } from '@/features/trade-scenes/lib/condition-title'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { materialInputGroupHeader, materialInputGroupIds, ratedMaterial, ridingSlot } from '@/features/trade-scenes/lib/material-input-groups'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { systemInputSlotIds } from '@/features/trade-scenes/lib/system-input-slots'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { MaterialInputGroup } from '@/features/trade-scenes/ui/components/controls/material-input-group'
import { MissingChip } from '@/features/trade-scenes/ui/components/controls/missing-chip'
import { QuickEditSection } from '@/features/trade-scenes/ui/components/spot-chip/quick-edit-section'
import { WearFold } from '@/features/trade-scenes/ui/components/spot-chip/wear-fold'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface QuickEditTodayProps {
  system: HomeSystemId
  rise: boolean
}

// What the home has today, one section per material the system holds: the same list the system action card reads, its inputs
// open instead of behind a chip's menu.
export function QuickEditToday({ system, rise }: QuickEditTodayProps) {
  const state = useSceneInputs((inputs: TradeSceneInputs) => inputs)
  const targets = useSceneTargets()
  const applyChange = useApplySceneChange()
  const slots = sceneChangeSlots(state, targets, currentYear())
  const slotOf = (id: string) => slots.find(slot => slot.id === id)!

  if (system === 'foundation' && state.property.foundationType === null) {
    const foundation = slotOf('foundation')
    return (
      <QuickEditSection index={0} rise={rise}>
        <div className={CONTROLS_CLASSES.capsLabel}>{foundation.name}</div>
        <MissingChip slot={foundation} onPick={value => applyChange(foundation.change(value))} />
      </QuickEditSection>
    )
  }
  const entries = systemInputSlotIds(system, targets.home, slots)
  if (entries.length === 0) {
    return <span className="text-xs text-muted-foreground">{CONTROLS_COPY.systems.noCrawlSpace}</span>
  }
  return entries.map(({ slotId, material }, index) => {
    const slot = slotOf(slotId)
    const rated = ratedMaterial(material)
    return (
      <QuickEditSection key={slotId} index={index} rise={rise}>
        <div className={CONTROLS_CLASSES.capsLabel}>{slot.name}</div>
        <ChoicePill
          label={slot.name}
          value={slot.current}
          options={slot.options.map(option => option.value)}
          labels={Object.fromEntries(slot.options.map(option => [option.value, option.label]))}
          onChange={value => applyChange(slot.change(value))}
        />
        {materialInputGroupIds(slot, slots, material).map((id) => {
          const input = <MaterialInputGroup id={id} slot={slot} slots={slots} material={material} />
          if (id === 'condition') {
            const gutterWear = slot.id === 'gutters' ? ridingSlot(slots, 'gutter-wear') : null
            return (
              <div key={id} className="grid justify-items-start gap-1">
                <div className={CONTROLS_CLASSES.groupTitle}>{conditionTitle(rated?.wear ?? (gutterWear?.current as Wear | null | undefined) ?? null)}</div>
                {input}
              </div>
            )
          }
          if (id === 'wear') {
            return (rated?.id === 'exterior-paint' || rated?.id === 'roof') && <WearFold key={id} id={rated.id} material={rated}>{input}</WearFold>
          }
          const header = materialInputGroupHeader(id, ridingSlot(slots, id) ?? slot)
          return (
            <div key={id} className="grid justify-items-start gap-1">
              {header !== null && <div className={CONTROLS_CLASSES.groupTitle}>{header}</div>}
              {input}
            </div>
          )
        })}
      </QuickEditSection>
    )
  })
}
