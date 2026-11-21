'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { motion, useReducedMotion } from 'motion/react'
import { Toolbar } from 'radix-ui'
import { useLayoutEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, HOME_SYSTEM_LABELS, PROFILE_COPY, YEAR_BUILT_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { YEAR_BUILT_ICON } from '@/features/trade-scenes/constants/scene-control-icons'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useLotIsData } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { AreaGroupSwitch } from '@/features/trade-scenes/ui/components/controls/area-group-switch'
import { RailChip } from '@/features/trade-scenes/ui/components/controls/rail-chip'
import { YardRailChips } from '@/features/trade-scenes/ui/components/controls/yard-rail-chips'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

interface SystemsRailProps {
  id: string
}

// Where the lot is data, the group switch first, and the Lot group holds the yards. Exterior is Year built first, as it
// sets what the systems start from, then each system in the order the build lists them, marked where the build changes
// it. A stage too narrow for it scrolls it, and the picked system is brought to its middle.
export function SystemsRail({ id }: SystemsRailProps) {
  const { picked, pickSystem, group } = useSceneControls()
  const lotIsData = useLotIsData()
  const { shape } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const yearBuilt = useSceneInputs((state: TradeSceneInputs) => state.property.yearBuilt)
  const changed = useSceneInputs(useShallow((state: TradeSceneInputs) => upgradeRows({ property: state.property, materials: state.homeMaterials, year: currentYear() }, state.proposedScopeIds, state.efficiencyUpgrades)
    .filter(system => system.rows.some(row => upgradeRowState(row, state.proposedScopeIds, state.efficiencyUpgrades).picked !== null))
    .map(system => system.id)))
  const portrait = shape === 'portrait'
  const rail = useRef<HTMLDivElement>(null)
  const { railBottom, railHeight } = SCENE_LAYOUT.controls
  const YearIcon = YEAR_BUILT_ICON

  useLayoutEffect(() => {
    const element = rail.current!
    const pressed = element.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (pressed) {
      element.scrollLeft = pressed.offsetLeft - (element.clientWidth - pressed.offsetWidth) / 2
    }
  }, [picked, group, portrait])

  return (
    <Toolbar.Root asChild aria-label={CONTROLS_COPY.systems.title}>
      <motion.div
        ref={rail}
        id={id}
        data-systems-rail
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: CONTROLS_EASE }}
        style={{ bottom: portrait ? railBottom.portrait : railBottom.wide, height: railHeight }}
        className={cn(
          'absolute z-30 flex items-center gap-1 overflow-x-auto border bg-card p-1.25 shadow-lg [scrollbar-width:none]',
          portrait ? 'inset-x-2.5 rounded-[22px]' : 'left-1/2 w-max max-w-[calc(100%-20px)] -translate-x-1/2 rounded-full',
        )}
      >
        {lotIsData && (
          <>
            <AreaGroupSwitch />
            <Toolbar.Separator className="mx-0.5 h-5.5 w-px shrink-0 bg-border" />
          </>
        )}
        {group === 'lot'
          ? <YardRailChips />
          : (
              <>
                <Toolbar.Button
                  data-rail-chip="year-built"
                  aria-pressed={picked === 'year-built'}
                  onClick={() => pickSystem('year-built')}
                  className={cn(CONTROLS_CLASSES.railChip, 'text-foreground')}
                >
                  <YearIcon aria-hidden />
                  <span data-rail-key className={cn('font-semibold', yearBuilt === null ? toneClasses('attention').text : 'text-muted-foreground')}>
                    {yearBuilt === null ? CONTROLS_COPY.systems.yearBuilt : PROFILE_COPY.yearBuilt}
                  </span>
                  <span data-rail-value>{yearBuilt === null ? PROFILE_COPY.unknown : YEAR_BUILT_LABELS[yearBuilt]}</span>
                </Toolbar.Button>
                <Toolbar.Separator className="mx-0.5 h-5.5 w-px shrink-0 bg-border" />
                {HOME_SYSTEM_IDS.map(system => (
                  <RailChip
                    key={system}
                    id={system}
                    label={HOME_SYSTEM_LABELS[system]}
                    changed={changed.includes(system)}
                    pressed={picked === system}
                    onPress={() => pickSystem(system)}
                  />
                ))}
              </>
            )}
      </motion.div>
    </Toolbar.Root>
  )
}
