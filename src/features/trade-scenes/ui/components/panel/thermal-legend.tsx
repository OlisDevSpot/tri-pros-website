'use client'

import { motion, useReducedMotion } from 'motion/react'

import { READING_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_THERMAL_PALETTE, THERMAL_LEGEND_TICKS } from '@/features/trade-scenes/constants/home-temperatures'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { ThermalScaleBar } from '@/shared/components/scene/ui/thermal-scale-bar'
import { THERMAL_SCALE_F } from '@/shared/modules/construction/core/constants/climate-presets'

// The thermal camera's key: one fixed scale, so a colour reads the same °F in every view. It stands in the bottom left of the
// scene's visible area, clear of the card and the dock, and glides with a fold.
export function ThermalLegend() {
  const { area, canvasOverhang } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={false}
      animate={{ x: area.left, y: -area.bottom }}
      transition={reduceMotion ? { duration: 0 } : SCENE_MOTION.transition}
      // Drawn in the canvas's box, which starts under the sidebar. The overhang changes on every frame of the sidebar's
      // slide, so it moves the key as a transform, never as layout, and apart from the eased x so it tracks the slide exactly.
      style={{ translate: `${canvasOverhang}px 0` }}
      className="pointer-events-none absolute bottom-4 left-4 h-44 rounded-xl bg-scrim/70 py-3 pr-3 pl-2.5 text-on-media shadow-lg"
    >
      <ThermalScaleBar scale={THERMAL_SCALE_F} palette={HOME_THERMAL_PALETTE} unit={READING_COPY.unit} ticks={THERMAL_LEGEND_TICKS} />
    </motion.div>
  )
}
