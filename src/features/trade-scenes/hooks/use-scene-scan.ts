'use client'

import type { RefObject } from 'react'
import type { Object3D } from 'three'

import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { SCENE_SCAN_SETTLE_FRAMES } from '@/features/trade-scenes/constants/scene-scan'
import { watchSubtree } from '@/features/trade-scenes/ui/lib/watch-subtree'

// The heat arrows keep the canvas drawing for as long as they show, so a pass over the scene's meshes run from the frame loop
// would run at the display's rate forever. This runs `scan` only after something it reads may have changed: any render of
// the caller (its props carry every input change), an object joining or leaving the tree under `root`, or the returned
// `wake`. Run before the frame draws, so nothing shows a frame of stale materials; `scan` returns whether it changed
// anything, which asks for one more frame.
export function useSceneScan(root: RefObject<Object3D | null>, scan: (root: Object3D) => boolean): () => void {
  const pending = useRef(SCENE_SCAN_SETTLE_FRAMES)
  const latestScan = useRef(scan)
  const wake = useCallback(() => {
    pending.current = SCENE_SCAN_SETTLE_FRAMES
  }, [])

  useLayoutEffect(() => {
    latestScan.current = scan
    wake()
  })

  useEffect(() => {
    const node = root.current
    return node ? watchSubtree(node, wake) : undefined
  }, [root, wake])

  useFrame((state) => {
    const node = root.current
    if (pending.current <= 0 || !node) {
      return
    }
    pending.current -= 1
    if (latestScan.current(node)) {
      pending.current = SCENE_SCAN_SETTLE_FRAMES
      state.invalidate()
    }
  })

  return wake
}
