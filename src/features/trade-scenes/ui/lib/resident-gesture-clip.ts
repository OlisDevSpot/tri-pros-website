import type { ResidentGesture } from '@/features/trade-scenes/types'

import { AdditiveAnimationBlendMode, AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack } from 'three'

import { RESIDENT_GESTURES } from '@/features/trade-scenes/constants/resident-clips'

const DEGREES = Math.PI / 180
const KEYS_PER_CYCLE = 12

const built = new Map<ResidentGesture, AnimationClip>()

function buildClip(gesture: ResidentGesture): AnimationClip {
  const spec = RESIDENT_GESTURES[gesture]
  const cycles = Math.max(1, ...spec.swings.map(swing => swing.cycles))
  const count = cycles * KEYS_PER_CYCLE + 1
  const times = Array.from({ length: count }, (_, index) => (index / (count - 1)) * spec.seconds)
  const holds: Readonly<Record<string, readonly [number, number, number]>> = spec.hold
  const bones = new Set([...Object.keys(holds), ...spec.swings.map(swing => swing.bone)])

  const tracks = [...bones].map((bone) => {
    const values = times.flatMap((time) => {
      const angles = [...(holds[bone] ?? [0, 0, 0])]
      for (const swing of spec.swings) {
        if (swing.bone === bone) {
          angles[swing.axis] += swing.degrees * Math.sin((2 * Math.PI * swing.cycles * time) / spec.seconds)
        }
      }
      const turn = new Quaternion().setFromEuler(new Euler(angles[0] * DEGREES, angles[1] * DEGREES, angles[2] * DEGREES))
      return [turn.x, turn.y, turn.z, turn.w]
    })
    return new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values)
  })
  return new AnimationClip(`gesture-${gesture}`, spec.seconds, tracks, AdditiveAnimationBlendMode)
}

// Additive: each key is a turn on top of the base clip's pose. Built once per gesture, so every resident's mixer reuses the
// same clip and a re-render never swaps it for an equal one.
export function residentGestureClip(gesture: ResidentGesture): AnimationClip {
  let clip = built.get(gesture)
  if (!clip) {
    clip = buildClip(gesture)
    built.set(gesture, clip)
  }
  return clip
}
