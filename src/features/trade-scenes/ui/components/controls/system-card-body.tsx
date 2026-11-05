'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { HomeSystemId, SceneChangeSlotId, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, EFFICIENCY_UPGRADE_LABELS, PART_LABELS, REQUIRED_UPGRADE_COPY, SCENE_VIEW_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { NO_CHANGE_CHOICE } from '@/features/trade-scenes/constants/scene-controls'
import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { systemMaterialIds } from '@/features/trade-scenes/lib/system-material-ids'
import { upgradeRowBlockedLine, upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { ExistingChip } from '@/features/trade-scenes/ui/components/controls/existing-chip'
import { LookInsideBody } from '@/features/trade-scenes/ui/components/controls/look-inside-body'
import { LookInsideButton } from '@/features/trade-scenes/ui/components/controls/look-inside-button'
import { MissingChip } from '@/features/trade-scenes/ui/components/controls/missing-chip'
import { ProposedChip } from '@/features/trade-scenes/ui/components/controls/proposed-chip'
import { ShingleColors } from '@/features/trade-scenes/ui/components/panel/shingle-colors'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface SystemCardBodyProps {
  system: HomeSystemId
}

// Today and the Tri Pros build, one row each, then the way up close. The side the scene is not showing dims, but its chips
// still work.
export function SystemCardBody({ system }: SystemCardBodyProps) {
  const state = useSceneInputs((inputs: TradeSceneInputs) => inputs)
  const targets = useSceneTargets()
  const applyChange = useApplySceneChange()
  const year = currentYear()
  const slots = sceneChangeSlots(state, targets, year)
  const slotOf = (id: SceneChangeSlotId) => slots.find(slot => slot.id === id)
  const facts = { property: state.property, materials: state.homeMaterials, year }
  const picks = state.proposedScopeIds
  const rows = upgradeRows(facts, picks, state.efficiencyUpgrades).find(entry => entry.id === system)?.rows ?? []
  // Gutters rides with the roof.
  const existing = systemMaterialIds(system, targets.home).flatMap(id => [
    <ExistingChip key={id} slot={slotOf(id)!} slots={slots} material={targets.home[id]!} />,
    ...id === 'roof' ? [<ExistingChip key="gutters" slot={slotOf('gutters')!} slots={slots} material={null} />] : [],
  ])

  // Inside the menu the colours line up with its header, and the line pill, which wraps at the menu's width, keeps a
  // radius that reads at two rows.
  const shingleColors = (
    <div className="px-1.5 pb-1.5 [&_[data-slot=toggle-group]]:rounded-[18px]">
      <ShingleColors />
    </div>
  )

  const proposed = rows.flatMap((row): ReactNode[] => {
    const id = `build:${row.part}` as const
    const label = PART_LABELS[row.part]
    const words = CONTROLS_COPY.systems.buildChips[row.part]
    if (row.blocked !== null) {
      const line = upgradeRowBlockedLine(row, facts, picks)!
      return [<ProposedChip key={id} id={id} kind="reason" label={label} text={words.add} reason={line.text} included={line.included} />]
    }
    const slot = slotOf(id)!
    const { holdsCoolRoof, holdsR8, holdsCoolPaint, holdsR38, holdsBatts, installsCoolShingle } = upgradeRowState(row, picks, state.efficiencyUpgrades)
    const chips: ReactNode[] = [
      row.scopeIds.length === 1
        ? (
            <ProposedChip
              key={id}
              id={id}
              kind="toggle"
              text={slot.current === NO_CHANGE_CHOICE ? words.add : words.short(slot.options.find(option => option.value === slot.current)!.label)}
              on={slot.current !== NO_CHANGE_CHOICE}
              onToggle={() => applyChange(slot.change(slot.current === NO_CHANGE_CHOICE ? row.scopeIds[0] : NO_CHANGE_CHOICE))}
            />
          )
        : <ProposedChip key={id} id={id} kind="menu" label={label} add={words.add} short={words.short} slot={slot} extra={installsCoolShingle && shingleColors} />,
    ]
    // A row that holds an upgrade always lists its slot, taken or not yet.
    const upgrade = (upgradeId: EfficiencyUpgradeId, saysWhy: boolean) => {
      const key = `upgrade:${upgradeId}` as const
      const upgradeSlot = slotOf(key)!
      if (upgradeSlot.required) {
        return <ProposedChip key={key} id={key} kind="reason" label={EFFICIENCY_UPGRADE_LABELS[upgradeId]} text={EFFICIENCY_UPGRADE_LABELS[upgradeId]} reason={REQUIRED_UPGRADE_COPY.reason} included />
      }
      if (upgradeSlot.unavailable === null) {
        const on = upgradeSlot.current === 'on'
        return <ProposedChip key={key} id={key} kind="toggle" text={EFFICIENCY_UPGRADE_LABELS[upgradeId]} on={on} onToggle={() => applyChange(upgradeSlot.change(on ? 'off' : 'on'))} />
      }
      return saysWhy && <ProposedChip key={key} id={key} kind="reason" label={EFFICIENCY_UPGRADE_LABELS[upgradeId]} text={EFFICIENCY_UPGRADE_LABELS[upgradeId]} reason={upgradeSlot.unavailable} included={false} />
    }
    // Batts are a look on a picked replace only; before one is picked the menu beside it already offers the replace.
    const batts = () => {
      const battsSlot = slotOf('style:batts')!
      const on = battsSlot.current === 'on'
      return battsSlot.unavailable === null && <ProposedChip key={battsSlot.id} id={battsSlot.id} kind="toggle" text={battsSlot.name} on={on} onToggle={() => applyChange(battsSlot.change(on ? 'off' : 'on'))} />
    }
    // The R-8 and R-38 steps, Cool Life paint and batts come only with the chip beside them, which already says why.
    return [...chips, holdsCoolRoof && upgrade('cool-roof', true), holdsR8 && upgrade('r8-ducts', false), holdsCoolPaint && upgrade('cool-paint', false), holdsR38 && upgrade('r38-insulation', false), holdsBatts && batts()]
  })

  const dimmed = state.view === 'existing' ? 'proposed' : 'existing'
  const sideRow = (side: 'existing' | 'proposed', chips: ReactNode) => (
    <div data-system-row={side} data-dimmed={dimmed === side || undefined} className="grid gap-1.5">
      <span className={CONTROLS_CLASSES.capsLabel}>{SCENE_VIEW_LABELS[side]}</span>
      <div
        // The chips take the controls' curve through a variable: a class cannot read the constant.
        style={{ '--chip-ease': CONTROLS_EASE_CSS } as CSSProperties}
        className={cn(
          'flex flex-wrap items-center gap-1.5 *:transition-opacity *:duration-220 *:ease-(--chip-ease) motion-reduce:*:transition-none',
          dimmed === side && '*:opacity-45 *:hover:opacity-85 *:focus-visible:opacity-85 *:data-[state=open]:opacity-85',
        )}
      >
        {chips}
      </div>
    </div>
  )

  const note = (text: string) => <span className="text-xs text-muted-foreground">{text}</span>
  // Only the foundation can have nothing to show: unset, it is asked for here rather than taken for a slab; a slab has no
  // crawl space to show or build on.
  if (system === 'foundation' && state.property.foundationType === null) {
    const foundation = slotOf('foundation')!
    return (
      <>
        {sideRow('existing', <MissingChip slot={foundation} onPick={value => applyChange(foundation.change(value))} />)}
        {sideRow('proposed', note(CONTROLS_COPY.systems.foundationFirst))}
      </>
    )
  }
  return (
    <>
      {sideRow('existing', existing.length === 0 ? note(CONTROLS_COPY.systems.noCrawlSpace) : existing)}
      {sideRow('proposed', rows.length === 0 ? note(CONTROLS_COPY.systems.noneOnSlab) : proposed)}
      <LookInsideButton system={system} />
      {state.lookInside && <LookInsideBody system={system} />}
    </>
  )
}
