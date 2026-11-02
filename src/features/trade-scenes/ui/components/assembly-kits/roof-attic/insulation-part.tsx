'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'
import type { PieceLayout } from '@/shared/components/scene/types'

import { useEffect, useMemo } from 'react'
import { BoxGeometry } from 'three'

import { KIT_BATT, KIT_BATT_EAVE_CLEARANCE, KIT_BLOWN_INSULATION, KIT_COLORS, KIT_INSULATION_DEPTH, LOW_SLOPE_KIT, PITCHED_KIT } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { centredFramingGrid, framingBays } from '@/features/trade-scenes/lib/kit-framing'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'
import { InsulationBlanket } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/insulation-blanket'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { createNoiseTexture } from '@/shared/components/scene/lib/create-noise-texture'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'

// Batts lie in the bays between the joists, in lengths with seams between; old ones have gaps where a batt went missing.
// Blown fill under a gable is one lumpy blanket that buries the joists; in a flat roof's joist space it fills each bay.
export function InsulationPart({ material, condition, form }: PartRendererProps) {
  const roofForm = homeRoofForm(form)
  const lowSlope = roofForm === 'low-slope'
  const worn = condition === 'worn'
  const laid = KIT_INSULATION_DEPTH[material] ?? 0
  const depth = lowSlope ? Math.min(laid, LOW_SLOPE_KIT.joistDepth - 0.01) : laid
  const blanket = material === KIT_BLOWN_INSULATION && !lowSlope
  const seams = material !== KIT_BLOWN_INSULATION
  const color = worn ? KIT_COLORS.insulationWorn : KIT_COLORS.insulationNew
  const kit = lowSlope ? LOW_SLOPE_KIT : PITCHED_KIT

  const run = lowSlope ? kit.halfSpan * 2 - LOW_SLOPE_KIT.wall.thickness * 2 : (kit.halfSpan - KIT_BATT_EAVE_CLEARANCE) * 2
  const pieceLength = seams ? run / Math.max(1, Math.round(run / KIT_BATT.length)) : run
  // Fibrous, so a batt never reads as another board beside the joists. White, because each batt's colour comes per instance.
  const fiber = useMemo(() => createNoiseTexture('fiber', '#ffffff', 13), [])
  useEffect(() => () => fiber.dispose(), [fiber])
  const battGeometry = useOwnedGeometry(() => new BoxGeometry(pieceLength - (seams ? KIT_BATT.gap : 0), depth, 1), [pieceLength, depth, seams])

  const batts = useMemo((): PieceLayout[] => {
    if (blanket) {
      return []
    }
    const random = seededRandom(lowSlope ? 23 : 5)
    const members = centredFramingGrid(kit.depth, kit.joistWidth, kit.framingSpacing)
    const pieces: PieceLayout[] = []
    for (const bay of framingBays(kit.depth, kit.joistWidth, members)) {
      for (let x = -run / 2 + pieceLength / 2; x < run / 2; x += pieceLength) {
        const roll = random()
        if (worn && seams && roll < KIT_BATT.missingShare) {
          continue
        }
        pieces.push({ x, y: depth / 2, z: bay.centre, tilt: 0, width: bay.width - 0.006, shade: worn ? 0.82 + random() * 0.26 : 0.95 + random() * 0.08 })
      }
    }
    return pieces
  }, [blanket, lowSlope, kit, run, pieceLength, depth, worn, seams])

  if (blanket) {
    return <InsulationBlanket depth={depth} worn={worn} color={color} />
  }
  return (
    <InstancedPieces geometry={battGeometry} pieces={batts} color={color} stretchToWidth>
      <meshStandardMaterial color="#ffffff" map={fiber} roughness={1} />
    </InstancedPieces>
  )
}
