'use client'

import type { ReactNode } from 'react'
import type { LayerId, RoofAssembly } from '@/features/meeting-visualizations/types'
import { BoxGeometry } from 'three'
import { EXPLODE_INDEX, JOIST_DEPTH, MATERIAL_COLORS, RIDGE_HEIGHT, SCENE } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { framingPositions, seededRandom } from '@/features/meeting-visualizations/lib/roof-geometry'
import { LayerMotion } from '@/features/meeting-visualizations/ui/components/roof-cutaway/cutaway-motion'
import { Slab, useOwnedGeometry } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

const DRYWALL = 0.035
const SPAN = SCENE.halfSpan * 2

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

/**
 * Height of the rafters' underside above the ceiling at `x`. Deep fill tapers toward the
 * eaves where the roof comes down to meet the wall, as it does in a real attic.
 */
function roofUndersideAt(x: number): number {
  const fromWall = SCENE.halfSpan - Math.abs(x)
  return JOIST_DEPTH + fromWall * Math.tan(SCENE.pitch) - SCENE.rafterDepth / Math.cos(SCENE.pitch) - 0.03
}

/** A box whose top is lumpy like blown fill; old, settled insulation is lumpier and thinner. */
function InsulationBlanket({ height, fresh }: { height: number, fresh: boolean }) {
  const geometry = useOwnedGeometry(() => {
    const blanket = new BoxGeometry(SPAN - 0.02, height, SCENE.depth - 0.01, 90, 1, 46)
    const random = seededRandom(fresh ? 3 : 11)
    const phase = [random() * 6, random() * 6, random() * 6]
    const roughness = fresh ? 0.12 : 0.28
    const position = blanket.attributes.position
    for (let index = 0; index < position.count; index++) {
      if (position.getY(index) <= 0)
        continue
      const x = position.getX(index)
      const z = position.getZ(index)
      const lump = Math.sin(x * 4.1 + phase[0]) * Math.sin(z * 3.3 + phase[1]) * 0.6
        + Math.sin(x * 9.7 + z * 7.1 + phase[2]) * 0.4
      const top = Math.max(0.02, Math.min(height + lump * height * roughness, roofUndersideAt(x)))
      position.setY(index, top - height / 2)
    }
    blanket.computeVertexNormals()
    blanket.translate(0, height / 2, 0)
    return blanket
  }, [height, fresh])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={fresh ? MATERIAL_COLORS.insulationNew : MATERIAL_COLORS.insulationAged} roughness={1} />
    </mesh>
  )
}

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

/** Not a layer: two wall stubs under the eaves so the slice reads as part of a house. */
export function WallStubs() {
  return (
    <>
      {([-1, 1] as const).map(side => (
        <Slab
          key={side}
          size={[0.16, SCENE.wallHeight, SCENE.depth]}
          position={[side * (SCENE.halfSpan - 0.08), -SCENE.wallHeight / 2 - DRYWALL, 0]}
          color={MATERIAL_COLORS.wall}
          roughness={0.95}
        />
      ))}
    </>
  )
}
