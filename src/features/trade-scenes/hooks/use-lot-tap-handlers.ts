'use client'

import type { ThreeElements, ThreeEvent } from '@react-three/fiber'
import type { LotHit } from '@/features/trade-scenes/lib/lot-tap'
import type { ResolvedLayout } from '@/features/trade-scenes/types'

import { useThree } from '@react-three/fiber'
import { useCallback, useMemo } from 'react'

import { FENCE_MESH_TAP_SHARE, LINE_TAP_SHARE } from '@/features/trade-scenes/constants/layout-grid'
import { useLayoutEditor, useLayoutEditorApi } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { fenceLineNear } from '@/features/trade-scenes/lib/fence-stroke'
import { fenceTapTile, lotTapTarget } from '@/features/trade-scenes/lib/lot-tap'
import { tileAt } from '@/features/trade-scenes/lib/tile-at'
import { isNearestSolidHit } from '@/features/trade-scenes/ui/lib/nearest-solid-hit'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'

interface LotTapHandlers {
  ground: Pick<ThreeElements['mesh'], 'onClick'>
  fence: Pick<ThreeElements['group'], 'onClick'>
}

// A click, never a press, and only while Areas holds the Lot group, so a stray tap anywhere else does what it always did.
export function useLotTapHandlers(resolved: ResolvedLayout): LotTapHandlers | null {
  const mode = useLayoutEditor(state => state.mode)
  const editor = useLayoutEditorApi()
  const { open, group } = useSceneControls()
  const { claimTap } = useSceneTapClaim()
  const scene = useThree(state => state.scene)
  const raycaster = useThree(state => state.raycaster)

  // A tap that names no yard (the house, past the lot) is left unclaimed, so the tap-away closes Areas.
  const act = useCallback((hit: LotHit) => {
    const target = lotTapTarget(hit, resolved)
    if (!target) {
      return
    }
    claimTap()
    editor.setState(target)
  }, [resolved, editor, claimTap])

  // R3F runs onClick however far the press travelled, so a drag that turned the camera must not count as a tap. The ground
  // runs under the house and the fences, so a tap on a roof would otherwise open the yard behind it.
  const tapPoint = useCallback(
    (event: ThreeEvent<MouseEvent>) => event.delta > SCENE_MOTION.tapSlopPx || !isNearestSolidHit(event, raycaster, scene) ? null : event.point,
    [raycaster, scene],
  )

  const onGroundClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    const point = tapPoint(event)
    if (!point) {
      return
    }
    const { origin, layout } = resolved
    const { x, z } = point
    const line = fenceLineNear(origin, layout.lot, resolved.fences, x, z, layout.tile * LINE_TAP_SHARE)
    act({ tile: tileAt(origin, layout.lot, x, z), fenceId: line?.id ?? null })
  }, [resolved, tapPoint, act])

  const onFenceClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    const point = tapPoint(event)
    if (!point) {
      return
    }
    const { origin, layout } = resolved
    const { x, z } = point
    // The hit lands on a board's face or a wall's top, up to half a tile off the grid line the fence stands on.
    const line = fenceLineNear(origin, layout.lot, resolved.fences, x, z, layout.tile * FENCE_MESH_TAP_SHARE)
    if (!line) {
      return
    }
    event.stopPropagation()
    act({ tile: fenceTapTile(origin, layout.lot, resolved.yards, line, x, z), fenceId: line.id })
  }, [resolved, tapPoint, act])

  const live = mode === 'orbit' && open === 'systems' && group === 'lot'
  return useMemo(
    () => live ? { ground: { onClick: onGroundClick }, fence: { onClick: onFenceClick } } : null,
    [live, onGroundClick, onFenceClick],
  )
}
