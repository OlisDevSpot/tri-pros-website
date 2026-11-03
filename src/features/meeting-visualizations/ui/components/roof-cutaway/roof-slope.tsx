'use client'

import type { ReactNode } from 'react'
import type { LayerId, RoofAssembly } from '@/features/meeting-visualizations/types'
import { EXPLODE_INDEX, JOIST_DEPTH, MATERIAL_COLORS, SCENE, SLOPE_LENGTH } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { framingPositions, skipSheathingBoards, slopeEndFor } from '@/features/meeting-visualizations/lib/roof-geometry'
import { LayerMotion } from '@/features/meeting-visualizations/ui/components/roof-cutaway/layer-motion'
import { Slab } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'
import { Shingles } from '@/features/meeting-visualizations/ui/components/roof-cutaway/shingles'
import { Tiles } from '@/features/meeting-visualizations/ui/components/roof-cutaway/tiles'

const DECK_TOP = SCENE.deckThickness
const MEMBRANE = SCENE.membraneThickness
const UNDERLAYMENT_BASE = DECK_TOP + MEMBRANE
const COVERING_BASE = UNDERLAYMENT_BASE + MEMBRANE

/** Run a slab from the eave overhang to where it meets its mirror at the ridge. */
function alongSlope(offset: number): { length: number, center: number } {
  const end = slopeEndFor(offset)
  return { length: end + SCENE.overhang, center: (end - SCENE.overhang) / 2 }
}

export type SlopeFace = 'front' | 'back'

interface RoofSlopeProps {
  assembly: RoofAssembly
  face: SlopeFace
  entryDelay: (id: LayerId) => number
  /** Only the slope facing the camera carries pins. */
  renderPin?: (id: LayerId, position: [number, number, number]) => ReactNode
}

/**
 * One side of the gable, drawn in the slope's own frame: x runs eave to ridge, y is the
 * roof normal, z runs along the ridge. The back slope is the same drawing turned half a
 * circle about the ridge's vertical axis, so explode pushes both sides outward.
 */
export function RoofSlope({ assembly, face, entryDelay, renderPin }: RoofSlopeProps) {
  const pinZ = SCENE.depth / 2
  const pin = (id: LayerId, along: number, offset: number) => renderPin?.(id, [along, offset + 0.1, pinZ])

  const motion = (id: LayerId) => ({ id, axis: 'normal' as const, explodeIndex: EXPLODE_INDEX[id], delay: entryDelay(id) })

  const deck = alongSlope(DECK_TOP)
  const underlayment = alongSlope(UNDERLAYMENT_BASE + MEMBRANE)
  const rafter = { length: SLOPE_LENGTH + SCENE.overhang, center: (SLOPE_LENGTH - SCENE.overhang) / 2 }

  return (
    <group rotation={[0, face === 'back' ? Math.PI : 0, 0]}>
      <group position={[-SCENE.halfSpan, JOIST_DEPTH, 0]} rotation={[0, 0, SCENE.pitch]}>
        <LayerMotion {...motion('rafters')}>
          {framingPositions().map(z => (
            <Slab key={z} size={[rafter.length, SCENE.rafterDepth, SCENE.rafterWidth]} position={[rafter.center, -SCENE.rafterDepth / 2, z]} color={MATERIAL_COLORS.lumber} />
          ))}
          {pin('rafters', 3.6, -SCENE.rafterDepth)}
        </LayerMotion>

        <LayerMotion key={`deck:${assembly.deck}:${assembly.deckAged}`} {...motion('deck')}>
          {assembly.deck === 'solid'
            ? <Slab size={[deck.length, SCENE.deckThickness, SCENE.depth]} position={[deck.center, DECK_TOP / 2, 0]} color={assembly.deckAged ? MATERIAL_COLORS.plywoodAged : MATERIAL_COLORS.plywood} />
            : skipSheathingBoards().map(board => (
                <Slab key={board.x} size={[board.length, SCENE.deckThickness * 0.8, SCENE.depth]} position={[board.x, DECK_TOP * 0.4, 0]} color={MATERIAL_COLORS.lumberAged} />
              ))}
          {pin('deck', 3.0, DECK_TOP)}
        </LayerMotion>

        {assembly.hasIceWater && (
          <LayerMotion key="ice-water" {...motion('ice-water')}>
            <Slab
              size={[SCENE.iceWaterReach + SCENE.overhang, MEMBRANE, SCENE.depth]}
              position={[(SCENE.iceWaterReach - SCENE.overhang) / 2, DECK_TOP + MEMBRANE / 2, 0]}
              color={MATERIAL_COLORS.iceWater}
              roughness={0.5}
            />
            {pin('ice-water', 0.35, DECK_TOP + MEMBRANE)}
          </LayerMotion>
        )}

        <LayerMotion key={`underlayment:${assembly.underlayment}`} {...motion('underlayment')}>
          <Slab
            size={[underlayment.length, MEMBRANE, SCENE.depth]}
            position={[underlayment.center, UNDERLAYMENT_BASE + MEMBRANE / 2, 0]}
            color={assembly.underlayment === 'felt' ? MATERIAL_COLORS.felt : MATERIAL_COLORS.synthetic}
            roughness={assembly.underlayment === 'felt' ? 1 : 0.6}
          />
          {pin('underlayment', 2.3, COVERING_BASE)}
        </LayerMotion>

        {assembly.hasDripEdge && (
          <LayerMotion key={`drip-edge:${assembly.build}`} {...motion('drip-edge')}>
            <Slab size={[0.16, 0.01, SCENE.depth]} position={[-SCENE.overhang + 0.06, COVERING_BASE + 0.005, 0]} color={MATERIAL_COLORS.dripEdge} roughness={0.3} metalness={0.85} />
            <Slab size={[0.01, 0.18, SCENE.depth]} position={[-SCENE.overhang - 0.015, COVERING_BASE - 0.08, 0]} color={MATERIAL_COLORS.dripEdge} roughness={0.3} metalness={0.85} />
            {pin('drip-edge', -0.5, COVERING_BASE)}
          </LayerMotion>
        )}

        <LayerMotion key={`covering:${assembly.covering}:${assembly.coveringWorn}`} {...motion('covering')}>
          {assembly.covering === 'shingle'
            ? <Shingles worn={assembly.coveringWorn} seed={face === 'front' ? 7 : 19} />
            : <Tiles worn={assembly.coveringWorn} seed={face === 'front' ? 7 : 19} />}
          {pin('covering', 1.4, COVERING_BASE + 0.12)}
        </LayerMotion>
      </group>
    </group>
  )
}
