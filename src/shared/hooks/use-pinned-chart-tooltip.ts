import type { PointerEvent as ReactPointerEvent } from 'react'

import { useEffect, useRef, useState } from 'react'

/** What a pinned tooltip reads: `active` for `<Tooltip>`, undefined while a mouse drives recharts' own hover. */
export interface ChartTooltipPin {
  subscribe: (listener: () => void) => () => void
  getActive: () => boolean | undefined
}

// Lives outside React state: re-rendering the chart that owns the hook hands recharts fresh data, axis and bar
// props, which rebuilds every bar and replays its entry animation, so only the tooltip subscribes to it.
function createPin() {
  let active: boolean | undefined
  const listeners = new Set<() => void>()
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getActive: () => active,
    set: (next: boolean | undefined) => {
      if (next !== active) {
        active = next
        listeners.forEach(listener => listener())
      }
    },
  }
}

// A tap's compat mouse events arrive only after the finger lifts (and Chromium's touch emulation never re-selects a
// line chart's x past the first tap), so the pin would show whatever was selected before, such as the last mouse
// hover. A mouseover at the tap selects it at once: per-item tooltips through the segment's own enter, axis tooltips
// through the wrapper's. Only the chart under the tap gets it: recharts throttles the axis selection through one
// scheduler shared by every chart, so in a syncId group only the last dispatch would land; the rest follow its sync.
function forceReselect(container: Element, target: EventTarget, clientX: number, clientY: number) {
  const wrapper = Array.from(container.querySelectorAll('.recharts-wrapper')).find((element) => {
    const rect = element.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  })
  const arrivedAt = target instanceof Element && wrapper?.contains(target) ? target : wrapper
  arrivedAt?.dispatchEvent(new MouseEvent('mouseover', { clientX, clientY, bubbles: true, cancelable: true }))
}

// WebKit's compat mouseout on an outside tap fires on whatever the tap actually landed on, never on the
// chart, so recharts' own hover state (and the dimming that reads it) stays stuck active; this mimics a
// real pointer leaving, which recharts always clears unconditionally on every engine.
function clearHover(container: Element) {
  container.querySelectorAll('.recharts-wrapper').forEach(wrapper =>
    wrapper.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: document.body, bubbles: true, cancelable: true })),
  )
}

/**
 * Keeps a recharts tooltip open after a tap. Recharts only shows it while the browser believes a mouse hovers the
 * chart, and a touch has no real hover: when the tooltip appears, Chrome re-checks hover at the last real mouse
 * position (touch never moves it), fires mouseleave on the chart and the tooltip vanishes.
 * Touch and pen pin it until a tap lands outside the container; a mouse keeps plain hover.
 *
 * Once a touch/pen pointer has fired here, `active` is driven explicitly (true while pinned, false once
 * released) rather than `undefined`: v3 can leave its own active state stuck true past release, and only
 * an explicit `false` overrides it. A real mouse pointer moving in the same container afterward (a
 * touchscreen laptop, an iPad with a trackpad) hands control back to recharts' own hover.
 */
export function usePinnedChartTooltip<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const pendingPin = useRef(0)
  const [pin] = useState(createPin)

  useEffect(() => {
    const releaseOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) {
        return
      }
      cancelAnimationFrame(pendingPin.current)
      if (pin.getActive() !== true) {
        return
      }
      pin.set(false)
      if (ref.current) {
        clearHover(ref.current)
      }
    }
    document.addEventListener('pointerdown', releaseOutside, true)
    return () => document.removeEventListener('pointerdown', releaseOutside, true)
  }, [pin])

  return {
    /** Spread on the element wrapping the chart (or every chart sharing a syncId). */
    containerProps: {
      ref,
      onPointerDownCapture: (event: ReactPointerEvent<T>) => {
        cancelAnimationFrame(pendingPin.current)
        if (event.pointerType === 'mouse') {
          pin.set(undefined)
          return
        }
        if (ref.current) {
          forceReselect(ref.current, event.target, event.clientX, event.clientY)
        }
        // An axis tooltip applies that selection on recharts' next animation frame; pinning in the same frame,
        // after it, keeps the tooltip from first flashing whatever was selected before.
        pendingPin.current = requestAnimationFrame(() => pin.set(true))
      },
      onPointerMove: (event: ReactPointerEvent<T>) => {
        if (event.pointerType === 'mouse') {
          cancelAnimationFrame(pendingPin.current)
          pin.set(undefined)
        }
      },
    },
    /** Pass to `<PinnedChartTooltip pin>`. */
    pin,
  }
}
