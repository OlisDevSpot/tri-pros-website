'use client'

import type { ReactNode } from 'react'
import type { LayerId, RoofAssembly } from '@/features/meeting-visualizations/types'
import { EXPLODE_INDEX, JOIST_DEPTH, MATERIAL_COLORS, SCENE, SPAN } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { framingPositions } from '@/features/meeting-visualizations/lib/roof-geometry'
import { InsulationBlanket } from '@/features/meeting-visualizations/ui/components/roof-cutaway/insulation-blanket'
import { LayerMotion } from '@/features/meeting-visualizations/ui/components/roof-cutaway/layer-motion'
import { Slab } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

export const DRYWALL = 0.035

interface AtticProps {
  assembly: RoofAssembly
  entryDelay: (id: LayerId) => number
  renderPin: (id: LayerId, position: [number, number, number]) => ReactNode
}

/** Insulation lifts out of the joist bays and the ceiling drops away, opening the attic for the camera. */
export function AtticFloor({ assembly, entryDelay, renderPin }: AtticProps) {
  const height = assembly.insulationInches * SCENE.unitsPerInch
  const pinZ = SCENE.depth / 2

  return (
    <>
      <LayerMotion id="ceiling" axis="down" explodeIndex={EXPLODE_INDEX.ceiling} delay={entryDelay('ceiling')}>
        <Slab size={[SPAN, DRYWALL, SCENE.depth]} position={[0, -DRYWALL / 2, 0]} color={MATERIAL_COLORS.drywall} roughness={0.95} />
        {framingPositions().map(z => (
          <Slab key={z} size={[SPAN, JOIST_DEPTH, SCENE.rafterWidth]} position={[0, JOIST_DEPTH / 2, z]} color={MATERIAL_COLORS.lumber} />
        ))}
        {renderPin('ceiling', [1.6, 0.05, pinZ])}
      </LayerMotion>

      <LayerMotion
        key={`insulation:${assembly.insulationRValue}`}
        id="insulation"
        axis="up"
        explodeIndex={EXPLODE_INDEX.insulation}
        delay={entryDelay('insulation')}
      >
        <InsulationBlanket height={height} fresh={assembly.insulationNew} />
        {renderPin('insulation', [-1.2, height + 0.1, pinZ])}
      </LayerMotion>
    </>
  )
}
