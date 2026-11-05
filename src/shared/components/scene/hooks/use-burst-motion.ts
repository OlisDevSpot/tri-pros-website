'use client'

import type { SceneBurst } from '@/shared/components/scene/types'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { burstLife } from '@/shared/components/scene/lib/burst-life'

// Steps a motion each frame of a burst with how alive the burst is (0 to 1) and the frame's seconds. The burst itself
// keeps the canvas drawing, so this asks for nothing; once the burst ends it steps once more at 0 to land the rest pose.
export function useBurstMotion(burst: SceneBurst, step: (life: number, seconds: number) => void): void {
  const invalidate = useThree(state => state.invalidate)
  const latestStep = useRef(step)
  useLayoutEffect(() => {
    latestStep.current = step
  })

  useFrame((_, delta) => {
    if (burst.running) {
      latestStep.current(burstLife(burst.progress()), Math.min(delta, SCENE_MOTION.maxFrameSeconds))
    }
  })

  useEffect(() => {
    if (!burst.running) {
      latestStep.current(0, 0)
      invalidate()
    }
  }, [burst.running, invalidate])
}
