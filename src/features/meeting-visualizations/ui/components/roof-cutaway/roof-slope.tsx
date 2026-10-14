'use client'

import type { ReactNode } from 'react'
import type { LayerId, RoofAssembly } from '@/features/meeting-visualizations/types'
import { useMemo } from 'react'
import { BoxGeometry, CylinderGeometry } from 'three'
import { EXPLODE_INDEX, JOIST_DEPTH, MATERIAL_COLORS, SCENE, SLOPE_LENGTH } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import {
  framingPositions,
  layoutShingles,
  layoutTiles,
  SHINGLE_LENGTH,
  skipSheathingBoards,
  slopeEndFor,
  TILE_LENGTH,
} from '@/features/meeting-visualizations/lib/roof-geometry'
import { LayerMotion } from '@/features/meeting-visualizations/ui/components/roof-cutaway/cutaway-motion'
import { InstancedPieces } from '@/features/meeting-visualizations/ui/components/roof-cutaway/instanced-pieces'
import { Slab, useOwnedGeometry } from '@/features/meeting-visualizations/ui/components/roof-cutaway/scene-primitives'

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

function Shingles({ worn, seed }: { worn: boolean, seed: number }) {
  const pieces = useMemo(() => layoutShingles({ seed, worn, base: COVERING_BASE }), [seed, worn])
  const geometry = useOwnedGeometry(() => new BoxGeometry(SHINGLE_LENGTH, SCENE.shingleThickness, 1), [])
  return (
    <InstancedPieces
      geometry={geometry}
      pieces={pieces}
      color={worn ? MATERIAL_COLORS.shingleWorn : MATERIAL_COLORS.shingleNew}
      stretchToWidth
      roughness={worn ? 1 : 0.8}
    />
  )
}

/** A half-pipe whose axis runs down the slope; `upper` picks the cap's arc over the pan's. */
function halfPipe(upper: boolean): CylinderGeometry {
  const geometry = new CylinderGeometry(SCENE.tileRadius, SCENE.tileRadius, TILE_LENGTH, 14, 1, true, upper ? 0 : Math.PI, Math.PI)
  geometry.rotateZ(Math.PI / 2)
  return geometry
}

function Tiles({ worn, seed }: { worn: boolean, seed: number }) {
  const { pans, caps } = useMemo(() => layoutTiles({ seed, worn, base: COVERING_BASE }), [seed, worn])
  const capGeometry = useOwnedGeometry(() => halfPipe(true), [])
  const panGeometry = useOwnedGeometry(() => halfPipe(false), [])
  const color = worn ? MATERIAL_COLORS.tileWorn : MATERIAL_COLORS.tileNew
  return (
    <>
      <InstancedPieces geometry={panGeometry} pieces={pans} color={color} roughness={0.75} doubleSided />
      <InstancedPieces geometry={capGeometry} pieces={caps} color={color} roughness={0.75} doubleSided />
    </>
  )
}
