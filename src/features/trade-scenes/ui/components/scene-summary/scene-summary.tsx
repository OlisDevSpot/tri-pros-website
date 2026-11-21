'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { SUMMARY_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { THERMAL_ICON, WEATHER_SUMMARY_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useSystemCardBottom } from '@/features/trade-scenes/contexts/system-card-bottom-context'
import { outsideTemperature } from '@/features/trade-scenes/lib/outside-temperature'
import { SummarySlot } from '@/features/trade-scenes/ui/components/scene-summary/summary-slot'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

// Read-only: the weather, the outside temperature and Thermal, so the homeowner sees what the picture is showing.
export function SceneSummary() {
  const { top, left, height, icon, slotMs, flameNudge } = SCENE_LAYOUT.summary
  const weather = useSceneInputs((state: TradeSceneInputs) => state.weather)
  const climate = useSceneInputs((state: TradeSceneInputs) => state.climate)
  const thermal = useSceneInputs((state: TradeSceneInputs) => state.thermalCamera)
  const { shape, stageElement } = useSceneVisibleArea()
  const { bottom: openCardBottom } = useSystemCardBottom()
  const reduceMotion = useReducedMotion() ?? false
  // The layout lab stands its badge in this corner; the summary waits beside it.
  const [badgeShift, setBadgeShift] = useState(0)
  useLayoutEffect(() => {
    const badge = stageElement?.ownerDocument.querySelector<HTMLElement>('[data-lab-badge]')
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- the badge is another tree's node, measurable only once mounted
    setBadgeShift(badge ? badge.offsetWidth + SCENE_LAYOUT.summary.badgeGap : 0)
  }, [stageElement])

  if (shape !== 'landscape' && openCardBottom !== null) {
    return null
  }

  const outside = outsideTemperature({ weather, climate })
  const label = SUMMARY_COPY.label({ weather, outside, thermal })
  const WeatherIcon = WEATHER_SUMMARY_ICONS[weather]
  const Flame = THERMAL_ICON
  const iconSize = { width: icon, height: icon }

  return (
    <div role="status" aria-label={label} style={{ top, left: left + badgeShift, height }} className={CONTROLS_CLASSES.summaryPill}>
      <SummarySlot value={weather}>
        <WeatherIcon aria-hidden style={iconSize} className={CONTROLS_CLASSES.summaryIcon} />
      </SummarySlot>
      <SummarySlot value={String(outside)}>
        {outside !== null && <span aria-hidden className={CONTROLS_CLASSES.summaryNumber}>{`${outside}°`}</span>}
      </SummarySlot>
      <AnimatePresence initial={false}>
        {thermal && (
          <motion.span
            key="thermal"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : slotMs / 1000, ease: CONTROLS_EASE }}
            className={CONTROLS_CLASSES.summaryFlame}
          >
            <span className={CONTROLS_CLASSES.summaryFlameInner}>
              <Flame aria-hidden style={{ ...iconSize, translate: `0 -${flameNudge}px` }} className={CONTROLS_CLASSES.summaryIcon} />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
