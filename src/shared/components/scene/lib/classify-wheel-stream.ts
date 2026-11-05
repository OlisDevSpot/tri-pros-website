import type { WheelDevice, WheelSample } from '@/shared/components/scene/types'

import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'

const { mouseNotch, trackpadSmall, trackpadCadence } = SCENE_GESTURES.wheel

function isNotchMultiple(deltaY: number) {
  const abs = Math.abs(deltaY)
  if (abs === 0) {
    return false
  }
  const q = abs / mouseNotch
  return q >= 1 - 1e-6 && Math.abs(q - Math.round(q)) < 1e-6
}

// Null means undecided. Line-mode deltas are checked first because a mouse's 3-line notch is also under the trackpad's small-delta limit.
export function classifyWheelStream(samples: readonly WheelSample[]): WheelDevice | null {
  if (samples.some(sample => sample.deltaMode !== 0)) {
    return 'mouse'
  }
  if (samples.some(sample => (sample.deltaX !== 0 && !sample.shiftKey) || (Math.abs(sample.deltaY) > 0 && Math.abs(sample.deltaY) < trackpadSmall))) {
    return 'trackpad'
  }
  if (samples.some(sample => isNotchMultiple(sample.deltaY))) {
    return 'mouse'
  }
  if (samples.length >= 2) {
    const last = samples[samples.length - 1]
    const before = samples[samples.length - 2]
    // A Shift-wheel mouse sends only deltaX, and a zero deltaY would read as an instant trackpad.
    if (last.deltaY === 0) {
      return null
    }
    return Math.abs((last.timeStamp - before.timeStamp) * last.deltaY) < trackpadCadence ? 'trackpad' : 'mouse'
  }
  return null
}
