import type { WheelDevice, WheelSample } from '@/shared/components/scene/types'

import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'
import { classifyWheelStream } from '@/shared/components/scene/lib/classify-wheel-stream'
import { startsWheelStream } from '@/shared/components/scene/lib/starts-wheel-stream'

const { decideMs } = SCENE_GESTURES.wheel

interface WheelRouterOptions {
  now: () => number
  schedule: (fn: () => void, ms: number) => () => void
  onPan: (dx: number, dy: number) => void
  onZoom: (deltaY: number) => void
}

type RoutedWheelSample = WheelSample & { ctrlKey: boolean, metaKey: boolean }

export function createWheelRouter({ now, schedule, onPan, onZoom }: WheelRouterOptions) {
  let samples: WheelSample[] = []
  let held: WheelSample[] = []
  let device: WheelDevice | null = null
  let lastAt: number | null = null
  let lastConfident: WheelDevice | null = null
  let cancelDecide: (() => void) | null = null

  function clearDecide() {
    cancelDecide?.()
    cancelDecide = null
  }

  function apply(sample: WheelSample) {
    if (device === 'trackpad') {
      onPan(sample.deltaX, sample.deltaY)
    }
    else {
      onZoom(sample.deltaY)
    }
  }

  function decide(next: WheelDevice, confident: boolean) {
    clearDecide()
    device = next
    if (confident) {
      lastConfident = next
    }
    const replay = held
    held = []
    replay.forEach(apply)
  }

  return {
    wheel(sample: RoutedWheelSample) {
      if (sample.ctrlKey || sample.metaKey) {
        onZoom(sample.deltaY)
        return
      }
      if (sample.shiftKey) {
        onPan(sample.deltaX || sample.deltaY, 0)
        return
      }
      const at = now()
      if (startsWheelStream(lastAt, at)) {
        clearDecide()
        samples = []
        held = []
        device = null
      }
      lastAt = at
      if (device) {
        apply(sample)
        return
      }
      samples.push(sample)
      held.push(sample)
      const confident = classifyWheelStream(samples)
      if (confident) {
        decide(confident, true)
        return
      }
      // A slow mouse stream never reaches a confident reading, so the wait is bounded rather than the first notch lost.
      cancelDecide ??= schedule(() => {
        cancelDecide = null
        decide(lastConfident ?? 'mouse', false)
      }, decideMs)
    },
    dispose() {
      clearDecide()
    },
  }
}
