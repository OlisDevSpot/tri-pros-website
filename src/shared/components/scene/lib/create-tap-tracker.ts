import type { PointerSample } from '@/shared/components/scene/types'

import { SCENE_GESTURES } from '@/shared/components/scene/constants/scene-gestures'

interface Press {
  type: string
  down: PointerSample
  starts: Map<number, PointerSample>
  multi: boolean
  moved: boolean
}

interface LastTap {
  type: string
  x: number
  y: number
  time: number
}

// Button 0 is a left click, a finger or a pen tip; a right or middle press still drags the camera but never looks.
function canTap(s: PointerSample) {
  return s.isPrimary && s.button === 0
}

function travelLimit(type: string) {
  return type === 'mouse' ? SCENE_GESTURES.pressTravelPx.mouse : SCENE_GESTURES.pressTravelPx.touch
}

export function createTapTracker() {
  let press: Press | null = null
  let lastTap: LastTap | null = null

  function finish(pointerId: number) {
    press?.starts.delete(pointerId)
    if (press && press.starts.size === 0) {
      press = null
    }
  }

  return {
    down(s: PointerSample) {
      // A primary pointer goes down only when no other of its kind is held, so a press still open lost its up and cancel;
      // kept, it would turn every later press into a second finger.
      if (press && s.isPrimary) {
        press = null
        lastTap = null
      }
      if (!press) {
        press = { type: s.pointerType, down: s, starts: new Map([[s.pointerId, s]]), multi: false, moved: false }
        return
      }
      press.multi = true
      press.starts.set(s.pointerId, s)
    },
    move(s: PointerSample): 'moved' | null {
      const start = press?.starts.get(s.pointerId)
      if (!press || !start || press.moved) {
        return null
      }
      if (Math.hypot(s.x - start.x, s.y - start.y) > travelLimit(press.type)) {
        press.moved = true
        return 'moved'
      }
      return null
    },
    // 'tap' is every tap that is not a double-tap's second, the first of a pair included.
    up(s: PointerSample): 'tap' | 'double' | null {
      const current = press
      if (!current || !current.starts.has(s.pointerId)) {
        return null
      }
      finish(s.pointerId)
      if (press) {
        return null
      }
      const start = current.down
      const isTap = !current.multi
        && canTap(start)
        && !current.moved
        && s.time - start.time <= SCENE_GESTURES.tapMs
        && Math.hypot(s.x - start.x, s.y - start.y) <= travelLimit(current.type)
      if (!isTap) {
        lastTap = null
        return null
      }
      const first = lastTap
      if (first
        && first.type === current.type
        && start.time - first.time <= SCENE_GESTURES.doubleMs
        && Math.hypot(start.x - first.x, start.y - first.y) <= SCENE_GESTURES.doubleSlopPx) {
        lastTap = null
        return 'double'
      }
      lastTap = { type: current.type, x: s.x, y: s.y, time: s.time }
      return 'tap'
    },
    cancel(pointerId: number) {
      if (!press?.starts.has(pointerId)) {
        return
      }
      lastTap = null
      press.multi = true
      finish(pointerId)
    },
  }
}
