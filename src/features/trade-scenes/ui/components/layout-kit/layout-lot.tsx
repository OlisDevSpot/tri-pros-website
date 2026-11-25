'use client'

import type { FenceBoxes, TradeSceneInputs, WeatherSky } from '@/features/trade-scenes/types'

import { useEffect, useMemo } from 'react'

import { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { CONCRETE_TEXTURE } from '@/features/trade-scenes/constants/material-textures'
import { BLUEPRINT_OMIT_TAG } from '@/features/trade-scenes/constants/scene-load'
import { useLayoutEditor } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useResolvedLayout } from '@/features/trade-scenes/contexts/resolved-layout-context'
import { useLotDrawHandlers } from '@/features/trade-scenes/hooks/use-lot-draw-handlers'
import { useLotTapHandlers } from '@/features/trade-scenes/hooks/use-lot-tap-handlers'
import { useTextureHold } from '@/features/trade-scenes/hooks/use-texture-maps'
import { lotTextureRequests } from '@/features/trade-scenes/lib/ground-draw'
import { LotPlants } from '@/features/trade-scenes/ui/components/home-kit/lot-plants'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { Neighbours } from '@/features/trade-scenes/ui/components/home-kit/neighbours'
import { LayoutFenceHighlight } from '@/features/trade-scenes/ui/components/layout-kit/layout-fence-highlight'
import { LayoutGround } from '@/features/trade-scenes/ui/components/layout-kit/layout-ground'
import { LayoutMagnetBand } from '@/features/trade-scenes/ui/components/layout-kit/layout-magnet-band'
import { LayoutRegionOutlines } from '@/features/trade-scenes/ui/components/layout-kit/layout-region-outlines'
import { LayoutRegions } from '@/features/trade-scenes/ui/components/layout-kit/layout-regions'
import { LayoutTileGrid } from '@/features/trade-scenes/ui/components/layout-kit/layout-tile-grid'
import { LayoutYardOutline } from '@/features/trade-scenes/ui/components/layout-kit/layout-yard-outline'
import { LotDrawPreview } from '@/features/trade-scenes/ui/components/layout-kit/lot-draw-preview'
import { useSceneCameraApi } from '@/shared/components/scene/contexts/scene-camera-context'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { setSceneCameraDrawing } from '@/shared/components/scene/lib/create-scene-camera'

interface LayoutLotProps {
  ground: WeatherSky['ground']
}

interface FenceBoxLook {
  color: string
  roughness: number
  metalness?: number
  opacity?: number
  radius?: number
  castShadow: boolean
  receiveShadow?: boolean
  ignoreTaps?: true
}

// The chain mesh casts no shadow: a see-through plane would throw a solid one.
const FENCE_BOX_LOOKS: Record<keyof FenceBoxes, FenceBoxLook> = {
  blockWalls: { color: HOME_PALETTE.blockWall, radius: 0.01, roughness: 0.95, castShadow: true, receiveShadow: true },
  wallCaps: { color: LOT_PALETTE.wallCap, roughness: 0.9, castShadow: true, receiveShadow: true },
  fenceBoards: { color: LOT_PALETTE.fenceBoard, roughness: 0.85, castShadow: true, receiveShadow: true },
  fenceRails: { color: LOT_PALETTE.fenceRail, roughness: 0.9, castShadow: true, ignoreTaps: true },
  vinylParts: { color: LOT_PALETTE.vinyl, roughness: 0.35, castShadow: true, receiveShadow: true },
  compositeBoards: { color: LOT_PALETTE.compositeBoard, roughness: 0.8, castShadow: true, receiveShadow: true },
  compositePosts: { color: LOT_PALETTE.compositePost, roughness: 0.7, castShadow: true, receiveShadow: true },
  ironwork: { color: LOT_PALETTE.iron, roughness: 0.5, metalness: 0.6, castShadow: true },
  chainPosts: { color: LOT_PALETTE.galvanised, roughness: 0.4, metalness: 0.7, castShadow: true },
  chainMesh: { color: LOT_PALETTE.chainMesh, roughness: 0.6, opacity: 0.45, castShadow: false, ignoreTaps: true },
}

const FENCE_BOX_LISTS = Object.keys(FENCE_BOX_LOOKS) as (keyof FenceBoxes)[]

// A double-tap looks at the spot it lands on: the ground, the paving and the walls take it, and the thin pieces lying on
// them pass it through to what is underneath.
export function LayoutLot({ ground }: LayoutLotProps) {
  const resolved = useResolvedLayout()
  const layer = useSceneInputs((state: TradeSceneInputs) => state.view)
  const draws = useLotDrawHandlers(resolved)
  const taps = useLotTapHandlers(resolved)
  // Drawing and the yard taps never run together: one is draw mode's, the other orbit mode's.
  const handlers = draws ?? taps?.ground ?? null
  const mode = useLayoutEditor(state => state.mode)
  const tool = useLayoutEditor(state => state.tool)
  const selected = useLayoutEditor(state => state.selected)
  const yard = useLayoutEditor(state => state.yard)
  const camera = useSceneCameraApi()
  const { boxes } = resolved
  const lot = resolved.layout.lot
  // Both layers' maps stay held while the lot shows, so a Today ⇄ Build toggle, however long after, finds them loaded.
  useTextureHold(useMemo(() => lotTextureRequests(lot), [lot]))

  // Draw mode holds the whole camera still, a press that misses the ground included, so no finger turns the lot away from
  // a stroke; the flag stops the orbit, the pan, the pinch, the wheel and the double-tap together.
  useEffect(() => {
    setSceneCameraDrawing(camera, mode === 'draw')
    return () => setSceneCameraDrawing(camera, false)
  }, [camera, mode])
  const fence = resolved.fenceBoxes[layer]
  return (
    <group>
      <group userData={BLUEPRINT_OMIT_TAG}>
        <LayoutGround ground={ground} resolved={resolved} handlers={handlers} />
        <LotPlants />
        <Neighbours />
      </group>
      <LayoutRegions lot={lot} resolved={resolved} layer={layer} ground={ground} />
      {yard !== null && <LayoutYardOutline resolved={resolved} yard={yard} />}
      {mode === 'draw' && <LayoutTileGrid resolved={resolved} />}
      {selected !== null && (
        <>
          <LayoutRegionOutlines resolved={resolved} selected={selected} />
          <LayoutFenceHighlight resolved={resolved} selected={selected} />
        </>
      )}
      {mode === 'draw' && <LotDrawPreview resolved={resolved} />}
      {mode === 'draw' && tool === 'fence' && <LayoutMagnetBand resolved={resolved} />}
      {/* The sidewalk and the aprons stand over the front lot line, so a fence press there lands on the paving, never the
          ground: the paving takes the press while a fence is on the bar. */}
      <group {...(draws && tool === 'fence' ? draws : undefined)}>
        <MergedBoxes boxes={boxes.asphalt} texture={{ set: 'asphalt', map: 'own' }} color={LOT_PALETTE.asphalt} roughness={0.95} receiveShadow />
        <MergedBoxes boxes={boxes.concrete} texture={CONCRETE_TEXTURE} color={HOME_PALETTE.path} roughness={0.9} castShadow receiveShadow />
      </group>
      {/* A fence press on a wall standing on the lot line starts a stroke too. R3F raycasts a handler group's descendants, so the walls and boards take a yard tap and the pieces that ignore
          taps pass it on to what stands behind them. */}
      <group {...(draws && tool === 'fence' ? draws : taps?.fence)}>
        {FENCE_BOX_LISTS.map(list => fence[list].length > 0 && <MergedBoxes key={list} boxes={fence[list]} {...FENCE_BOX_LOOKS[list]} />)}
      </group>
    </group>
  )
}
