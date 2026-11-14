'use client'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, HOME_SYSTEM_LABELS, PART_LABELS, QUICK_EDIT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { moveToAtticOffered } from '@/features/trade-scenes/lib/indoor-location'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { systemBuildEntries } from '@/features/trade-scenes/lib/system-build-entries'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { workDetailsShown } from '@/features/trade-scenes/lib/work-details-kind'
import { BuildSwitch } from '@/features/trade-scenes/ui/components/controls/build-switch'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { EntryWorkDetails } from '@/features/trade-scenes/ui/components/controls/entry-work-details'
import { QuickEditSection } from '@/features/trade-scenes/ui/components/spot-chip/quick-edit-section'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'

interface QuickEditBuildProps {
  system: HomeSystemId
  rise: boolean
}

// Only the picks already made: the build is chosen in the system's card, and this side changes what a pick holds.
export function QuickEditBuild({ system, rise }: QuickEditBuildProps) {
  const state = useSceneInputs((inputs: TradeSceneInputs) => inputs)
  const targets = useSceneTargets()
  const applyChange = useApplySceneChange()
  const { pickFromChip } = useSceneControls()
  const year = currentYear()
  const slots = sceneChangeSlots(state, targets, year)
  const slotOf = (id: string) => slots.find(slot => slot.id === id)!
  const picks = state.proposedScopeIds
  const rows = upgradeRows({ property: state.property, materials: state.homeMaterials, year }, picks, state.efficiencyUpgrades).find(entry => entry.id === system)?.rows ?? []
  const moveOffered = moveToAtticOffered(state.homeMaterials, homeRoofForm(targets.assemblies[HOME_PRIMARY_ASSEMBLY]?.form))
  const note = (text: string) => <span className="text-xs text-muted-foreground">{text}</span>

  // An unset foundation has no rows yet, which reads as nothing in the build, not as a slab.
  if (rows.length === 0 && (system !== 'foundation' || state.property.foundationType !== null)) {
    return note(CONTROLS_COPY.systems.noneOnSlab)
  }
  const entries = systemBuildEntries(rows, picks, state.efficiencyUpgrades).filter(entry => entry.picked !== null)
  if (entries.length === 0) {
    return (
      <div className="grid justify-items-start gap-1">
        {note(QUICK_EDIT_COPY.nothingInBuild(HOME_SYSTEM_LABELS[system]))}
        <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => pickFromChip(system)}>{QUICK_EDIT_COPY.addInCard}</Button>
      </div>
    )
  }
  return entries.map(({ row, kind, switches }, index) => {
    const slot = slotOf(`build:${row.part}`)
    // A pick is taken back in the system's card; here it only changes.
    const wayOptions = slot.options.filter(option => (row.scopeIds as readonly string[]).includes(option.value))
    return (
      <QuickEditSection key={row.part} index={index} rise={rise}>
        <div className={CONTROLS_CLASSES.capsLabel}>{PART_LABELS[row.part]}</div>
        {row.scopeIds.length > 1 && (
          <ChoicePill
            label={PART_LABELS[row.part]}
            value={slot.current}
            options={wayOptions.map(option => option.value)}
            labels={Object.fromEntries(wayOptions.map(option => [option.value, option.label]))}
            onChange={value => applyChange(slot.change(value))}
          />
        )}
        {workDetailsShown(kind, moveOffered) && <EntryWorkDetails kind={kind} slots={slots} />}
        {switches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {switches.map(id => <BuildSwitch key={id} id={id} slot={slotOf(id)} />)}
          </div>
        )}
      </QuickEditSection>
    )
  })
}
