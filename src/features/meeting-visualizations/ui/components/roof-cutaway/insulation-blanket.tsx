'use client'

import { BoxGeometry } from 'three'
import { JOIST_DEPTH, MATERIAL_COLORS, SCENE, SPAN } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { seededRandom } from '@/features/meeting-visualizations/lib/roof-geometry'
import { useOwnedGeometry } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

/**
 * Height of the rafters' underside above the ceiling at `x`. Deep fill tapers toward the
 * eaves where the roof comes down to meet the wall, as it does in a real attic.
 */
function roofUndersideAt(x: number): number {
  const fromWall = SCENE.halfSpan - Math.abs(x)
  return JOIST_DEPTH + fromWall * Math.tan(SCENE.pitch) - SCENE.rafterDepth / Math.cos(SCENE.pitch) - 0.03
}

/** A box whose top is lumpy like blown fill; old, settled insulation is lumpier and thinner. */
export function InsulationBlanket({ height, fresh }: { height: number, fresh: boolean }) {
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
