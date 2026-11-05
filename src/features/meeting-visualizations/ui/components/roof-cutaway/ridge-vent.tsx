'use client'

import type { ReactNode } from 'react'
import type { LayerId } from '@/features/meeting-visualizations/types'
import { EXPLODE_INDEX, JOIST_DEPTH, MATERIAL_COLORS, RIDGE_HEIGHT, SCENE } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { LayerMotion } from '@/features/meeting-visualizations/ui/components/roof-cutaway/layer-motion'
import { Slab } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

interface RidgeVentProps {
  entryDelay: (id: LayerId) => number
  renderPin: (id: LayerId, position: [number, number, number]) => ReactNode
}

const CAP_RUN = 0.36
const COVERING_TOP = SCENE.deckThickness + SCENE.membraneThickness * 2 + 0.07

export function RidgeVent({ entryDelay, renderPin }: RidgeVentProps) {
  const peak = JOIST_DEPTH + RIDGE_HEIGHT + COVERING_TOP / Math.cos(SCENE.pitch) + 0.02
  const halfRun = (CAP_RUN / 2) * Math.cos(SCENE.pitch)
  const drop = (CAP_RUN / 2) * Math.sin(SCENE.pitch)
  return (
    <LayerMotion id="ridge-vent" axis="up" explodeIndex={EXPLODE_INDEX['ridge-vent'] * 2} delay={entryDelay('ridge-vent')}>
      {([-1, 1] as const).map(side => (
        <Slab
          key={side}
          size={[CAP_RUN, 0.05, SCENE.depth]}
          position={[side * halfRun, peak - drop, 0]}
          rotation={[0, 0, -side * SCENE.pitch]}
          color={MATERIAL_COLORS.ridgeVent}
          roughness={0.6}
        />
      ))}
      {renderPin('ridge-vent', [0, peak + 0.18, SCENE.depth / 2])}
    </LayerMotion>
  )
}
