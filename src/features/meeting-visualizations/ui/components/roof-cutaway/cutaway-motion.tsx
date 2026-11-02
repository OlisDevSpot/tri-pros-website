'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { ReactNode, RefObject } from 'react'
import type { Group, Material, Mesh } from 'three'
import type { LayerId } from '@/features/meeting-visualizations/types'
import { useFrame, useThree } from '@react-three/fiber'
import { createContext, use, useEffect, useMemo, useRef } from 'react'
import { SCENE } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'

interface CutawayMotion {
  /** Damped toward the slider each frame; read in useFrame, never in render. */
  explode: RefObject<number>
  selected: LayerId | null
  reducedMotion: boolean
  onSelect: (id: LayerId) => void
}

const CutawayMotionContext = createContext<CutawayMotion | null>(null)

function useCutawayMotion(): CutawayMotion {
  const motion = use(CutawayMotionContext)
  if (!motion)
    throw new Error('useCutawayMotion must be used inside <CutawayMotionProvider>')
  return motion
}

const DAMPING = 6
const SETTLED = 0.0005

function damp(current: number, target: number, delta: number, reducedMotion: boolean): number {
  if (reducedMotion)
    return target
  // Clamp the step so a backgrounded tab does not snap on return.
  return current + (target - current) * (1 - Math.exp(-DAMPING * Math.min(delta, 0.1)))
}

interface ProviderProps {
  explodeTarget: number
  selected: LayerId | null
  reducedMotion: boolean
  onSelect: (id: LayerId) => void
  children: ReactNode
}

/**
 * The canvas renders on demand to spare the iPad's battery, so every animation here keeps
 * the loop alive by invalidating until it settles, and stops asking once it has.
 */
export function CutawayMotionProvider({ explodeTarget, selected, reducedMotion, onSelect, children }: ProviderProps) {
  const explode = useRef(explodeTarget)
  const invalidate = useThree(state => state.invalidate)

  useEffect(() => invalidate(), [explodeTarget, selected, invalidate])

  useFrame((state, delta) => {
    explode.current = damp(explode.current, explodeTarget, delta, reducedMotion)
    if (Math.abs(explode.current - explodeTarget) > SETTLED)
      state.invalidate()
  })

  const value = useMemo(() => ({ explode, selected, reducedMotion, onSelect }), [selected, reducedMotion, onSelect])
  return <CutawayMotionContext value={value}>{children}</CutawayMotionContext>
}

export type ExplodeAxis = 'normal' | 'up' | 'down'

interface LayerMotionProps {
  id: LayerId
  /** Seconds after mount before the layer drops into place. */
  delay: number
  axis: ExplodeAxis
  explodeIndex: number
  children: ReactNode
}

const ENTRY_SECONDS = 0.55
const DIMMED_OPACITY = 0.1

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function forEachMaterial(root: Group, visit: (material: Material) => void) {
  root.traverse((object) => {
    const material = (object as Mesh).material
    if (!material)
      return
    for (const each of Array.isArray(material) ? material : [material])
      visit(each)
  })
}

/**
 * Drops a layer in from above the roof on mount, offsets it by the shared explode amount
 * along its axis, and fades it back when another layer is selected. Remounting a layer
 * (a new key) replays the drop, which is how a rebuild animates.
 */
export function LayerMotion({ id, delay, axis, explodeIndex, children }: LayerMotionProps) {
  const { explode, selected, reducedMotion, onSelect } = useCutawayMotion()
  const group = useRef<Group>(null)
  const mountedAt = useRef<number | null>(null)
  const opacity = useRef(reducedMotion ? 1 : 0)

  const dimmed = selected !== null && selected !== id
  const invalidate = useThree(state => state.invalidate)

  // A layer that mounts while the loop is idle has to ask for its first frame.
  useEffect(() => invalidate(), [invalidate])

  useFrame((state, delta) => {
    const node = group.current
    if (!node)
      return

    mountedAt.current ??= state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - mountedAt.current
    const entry = reducedMotion ? 1 : easeOutCubic(Math.min(Math.max((elapsed - delay) / ENTRY_SECONDS, 0), 1))

    const spread = explode.current * explodeIndex * SCENE.explodeGap
    const lift = (1 - entry) * SCENE.entryLift
    if (axis === 'normal')
      node.position.y = spread + lift
    else if (axis === 'up')
      node.position.y = spread * 0.45 + lift
    else
      node.position.y = -spread * 1.3 - lift

    const targetOpacity = (dimmed ? DIMMED_OPACITY : 1) * entry
    opacity.current = damp(opacity.current, targetOpacity, delta, reducedMotion)
    const solid = opacity.current > 0.995
    forEachMaterial(node, (material) => {
      material.opacity = opacity.current
      material.transparent = !solid
      // A ghosted layer must not hide the selected one behind it.
      material.depthWrite = opacity.current > 0.5
    })

    if (entry < 1 || Math.abs(opacity.current - targetOpacity) > SETTLED)
      state.invalidate()
  })

  // A ghosted layer lets the tap fall through to the solid one behind it; a drag is an orbit, not a tap.
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (dimmed || event.delta > 6)
      return
    event.stopPropagation()
    onSelect(id)
  }

  return <group ref={group} onClick={handleClick}>{children}</group>
}

/** Raises the whole roof as the slider opens, so the attic shows between the rafters and the joists. */
export function ExplodeLift({ amount, children }: { amount: number, children: ReactNode }) {
  const { explode } = useCutawayMotion()
  const group = useRef<Group>(null)
  useFrame(() => {
    if (group.current)
      group.current.position.y = explode.current * amount
  })
  return <group ref={group}>{children}</group>
}
