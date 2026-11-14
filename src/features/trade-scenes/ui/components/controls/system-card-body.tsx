'use client'

import type { ReactNode } from 'react'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'
import { CONTROLS_COPY, PART_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_PRIMARY_ASSEMBLY, NO_CHANGE_CHOICE } from '@/features/trade-scenes/constants/scene-controls'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { moveToAtticOffered } from '@/features/trade-scenes/lib/indoor-location'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { systemBuildEntries } from '@/features/trade-scenes/lib/system-build-entries'
import { systemInputSlotIds } from '@/features/trade-scenes/lib/system-input-slots'
import { upgradeRowBlockedLine } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { workDetailsKind, workDetailsShown } from '@/features/trade-scenes/lib/work-details-kind'
import { BuildSwitch } from '@/features/trade-scenes/ui/components/controls/build-switch'
import { EntryWorkDetails } from '@/features/trade-scenes/ui/components/controls/entry-work-details'
import { ExistingChip } from '@/features/trade-scenes/ui/components/controls/existing-chip'
import { LookInsideBody } from '@/features/trade-scenes/ui/components/controls/look-inside-body'
import { MissingChip } from '@/features/trade-scenes/ui/components/controls/missing-chip'
import { ProposedChip } from '@/features/trade-scenes/ui/components/controls/proposed-chip'
import { SystemCardRow } from '@/features/trade-scenes/ui/components/controls/system-card-row'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SystemCardBodyProps {
  system: HomeSystemId
}

// Today and the Tri Pros build, one row each, then the way up close while it is on.
export function SystemCardBody({ system }: SystemCardBodyProps) {
  const state = useSceneInputs((inputs: TradeSceneInputs) => inputs)
  const targets = useSceneTargets()
  const applyChange = useApplySceneChange()
  const year = currentYear()
  const slots = sceneChangeSlots(state, targets, year)
  const slotOf = (id: string) => slots.find(slot => slot.id === id)
  const facts = { property: state.property, materials: state.homeMaterials, year }
  const picks = state.proposedScopeIds
  const rows = upgradeRows(facts, picks, state.efficiencyUpgrades).find(entry => entry.id === system)?.rows ?? []
  const existing = systemInputSlotIds(system, targets.home, slots).map(({ slotId, material }) => (
    <ExistingChip key={slotId} slot={slotOf(slotId)!} slots={slots} material={material} />
  ))

  // A whole new system has a choice only where its unit could move to the attic, so elsewhere its menu closes on the pick
  // like any other.
  const moveOffered = moveToAtticOffered(state.homeMaterials, homeRoofForm(targets.assemblies[HOME_PRIMARY_ASSEMBLY]?.form))

  const proposed = systemBuildEntries(rows, picks, state.efficiencyUpgrades).flatMap(({ row, kind, switches }): ReactNode[] => {
    const id = `build:${row.part}` as const
    const label = PART_LABELS[row.part]
    const words = CONTROLS_COPY.systems.buildChips[row.part]
    if (row.blocked !== null) {
      const line = upgradeRowBlockedLine(row, facts, picks)!
      return [<ProposedChip key={id} id={id} kind="reason" label={label} text={words.add} reason={line.text} included={line.included} />]
    }
    const slot = slotOf(id)!
    // Work with something to choose is chosen inside its menu, one way or several, so every such row reads as the roof's does.
    const menu = row.scopeIds.length > 1 || row.scopeIds.some(scopeId => workDetailsKind(scopeId) !== null)
    const chip = menu
      ? (
          <ProposedChip
            key={id}
            id={id}
            kind="menu"
            label={label}
            add={words.add}
            short={words.short}
            slot={slot}
            staysOpenOn={value => workDetailsShown(workDetailsKind(value), moveOffered)}
            // Inside the menu the colours line up with its header, and the line pill, which wraps at the menu's width,
            // keeps a radius that reads at two rows.
            extra={workDetailsShown(kind, moveOffered) && <div className="px-1.5 pb-1.5 [&_[data-slot=toggle-group]]:rounded-[18px]"><EntryWorkDetails kind={kind} slots={slots} /></div>}
          />
        )
      : (
          <ProposedChip
            key={id}
            id={id}
            kind="toggle"
            text={slot.current === NO_CHANGE_CHOICE ? words.add : words.short(slot.options.find(option => option.value === slot.current)!.label)}
            on={slot.current !== NO_CHANGE_CHOICE}
            onToggle={() => applyChange(slot.change(slot.current === NO_CHANGE_CHOICE ? row.scopeIds[0] : NO_CHANGE_CHOICE))}
          />
        )
    return [chip, ...switches.map(id => <BuildSwitch key={id} id={id} slot={slotOf(id)!} />)]
  })

  const note = (text: string) => <span className="text-xs text-muted-foreground">{text}</span>
  // Only the foundation can have nothing to show: unset, it is asked for here rather than taken for a slab; a slab has no
  // crawl space to show or build on.
  if (system === 'foundation' && state.property.foundationType === null) {
    const foundation = slotOf('foundation')!
    return (
      <>
        <SystemCardRow side="existing"><MissingChip slot={foundation} onPick={value => applyChange(foundation.change(value))} /></SystemCardRow>
        <SystemCardRow side="proposed">{note(CONTROLS_COPY.systems.foundationFirst)}</SystemCardRow>
      </>
    )
  }
  return (
    <>
      <SystemCardRow side="existing">{existing.length === 0 ? note(CONTROLS_COPY.systems.noCrawlSpace) : existing}</SystemCardRow>
      <SystemCardRow side="proposed">{rows.length === 0 ? note(CONTROLS_COPY.systems.noneOnSlab) : proposed}</SystemCardRow>
      {state.lookInside && <LookInsideBody system={system} />}
    </>
  )
}
