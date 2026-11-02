'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { ReactNode } from 'react'
import type { Group } from 'three'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { KIT_MOTION } from '@/features/trade-scenes/constants/assembly-kits'
import { useAssemblyKitFade } from '@/features/trade-scenes/contexts/assembly-kit-fade-context'
import { partPinId } from '@/features/trade-scenes/lib/part-pin-id'
import { applyKitOpacity } from '@/features/trade-scenes/ui/components/assembly-kits/lib/apply-kit-opacity'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { useSceneMotion } from '@/shared/components/scene/contexts/scene-motion-context'
import { dampValue, easeStepSeconds, isSettled } from '@/shared/components/scene/lib/damp-value'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

type Vec3 = readonly [number, number, number]

interface KitPartProps {
  /** null for the kit's frame (walls, parapet): it fades and dims with the parts, but no tap emphasises it. */
  partId: string | null
  /** The part's offset at full peel. */
  peelOffset: Vec3
  peel: number
  dimmed: boolean
  /** An installed part drops into place when it mounts, so a change of view shows what the work puts in. */
  drop: boolean
  pin: Vec3 | null
  onTap?: (partId: string) => void
  children: ReactNode
}

// One part's motion: its peel offset, its drop on arrival, and its fade (the host's crossfade times its own emphasis), eased
// together in the frame loop and written straight to the group. The crossfade is read from a ref, so a fade never re-renders
// the part; a peel arrives as a prop and the part eases toward it rather than jumping.
export function KitPart({ partId, peelOffset, peel, dimmed, drop, pin, onTap, children }: KitPartProps) {
  const group = useRef<Group>(null)
  const fade = useAssemblyKitFade()
  const { reducedMotion } = useSceneMotion()
  const invalidate = useThree(state => state.invalidate)

  const goal = [peelOffset[0] * peel, peelOffset[1] * peel, peelOffset[2] * peel, 0, dimmed ? KIT_MOTION.dimmedOpacity : 1]
  const latestGoal = useRef(goal)
  // [x, y, z, drop, opacity]; seeded on the first frame so an installed part starts above its place and unseen.
  const current = useRef<number[] | null>(null)
  const resting = useRef(true)
  const applied = useRef(Number.NaN)

  const goalKey = goal.join(',')
  useLayoutEffect(() => {
    latestGoal.current = goal
    invalidate()
    // goalKey stands for goal, a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalKey, invalidate])
  useEffect(() => invalidate(), [invalidate])

  useFrame((state, delta) => {
    const node = group.current
    if (!node) {
      return
    }
    const target = latestGoal.current
    const now = current.current ??= [target[0], target[1], target[2], drop && !reducedMotion ? KIT_MOTION.dropLift : 0, drop && !reducedMotion ? 0 : target[4]]
    if (isSettled(now, target)) {
      resting.current = true
    }
    else {
      const next = reducedMotion ? [...target] : dampValue(now, target, easeStepSeconds(resting.current, delta))
      resting.current = false
      current.current = isSettled(next, target) ? [...target] : next
      state.invalidate()
    }
    const [x, y, z, lift, own] = current.current
    node.position.set(x, y + lift, z)
    const opacity = own * fade.current
    if (opacity !== applied.current) {
      applyKitOpacity(node, opacity)
      applied.current = opacity
    }
  })

  // A tap on a dimmed part moves the emphasis to it, as a rep pointing at it expects; the frame lets the tap fall through.
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (partId === null || event.delta > SCENE_MOTION.tapSlopPx) {
      return
    }
    event.stopPropagation()
    onTap?.(partId)
  }

  return (
    <group ref={group} onClick={handleClick}>
      {children}
      {partId !== null && pin && <SceneAnchor id={partPinId(partId)} position={[pin[0], pin[1], pin[2]]} />}
    </group>
  )
}
