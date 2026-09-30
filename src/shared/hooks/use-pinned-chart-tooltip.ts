import type { PointerEvent as ReactPointerEvent } from 'react'

import { useEffect, useRef, useState } from 'react'

import { createChartTooltipPin } from '@/shared/lib/create-chart-tooltip-pin'

// A tap's own mouse events arrive only after the finger lifts, so until then the pin would show the previous
// selection (often the last mouse hover). Only the chart under the tap gets the event: recharts keeps one pending
// selection for every chart on the page, so a second dispatch would cancel the first.
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
 * an explicit `false` overrides it. A real mouse pointer entering or moving in the same container afterward
 * (a touchscreen laptop, an iPad with a trackpad) hands control back to recharts' own hover.
 */
export function usePinnedChartTooltip<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  // A tap's pin, or the release of one, waiting for the frame that lands the tap's selection.
  const pendingFrame = useRef(0)
  const [pin] = useState(createChartTooltipPin)

  const cancelPendingFrame = () => {
    cancelAnimationFrame(pendingFrame.current)
    pendingFrame.current = 0
  }

  const handBackToMouse = (event: ReactPointerEvent<T>) => {
    if (event.pointerType === 'mouse') {
      cancelPendingFrame()
      pin.set(undefined)
    }
  }

  useEffect(() => {
    const release = () => {
      pendingFrame.current = 0
      pin.set(false)
      if (ref.current) {
        clearHover(ref.current)
      }
    }
    const releaseOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) {
        return
      }
      if (pendingFrame.current !== 0) {
        // Clearing now would run before the tap's own selection lands in that frame and leave it stuck on.
        cancelAnimationFrame(pendingFrame.current)
        pendingFrame.current = requestAnimationFrame(release)
      }
      else if (pin.getActive() === true) {
        release()
      }
    }
    document.addEventListener('pointerdown', releaseOutside, true)
    return () => {
      document.removeEventListener('pointerdown', releaseOutside, true)
      cancelAnimationFrame(pendingFrame.current)
    }
  }, [pin])

  return {
    /** Spread on the element wrapping the chart (or every chart sharing a syncId). */
    containerProps: {
      ref,
      onPointerDownCapture: (event: ReactPointerEvent<T>) => {
        cancelPendingFrame()
        if (event.pointerType === 'mouse') {
          pin.set(undefined)
          return
        }
        if (ref.current) {
          forceReselect(ref.current, event.target, event.clientX, event.clientY)
        }
        // Pinned in recharts' next frame so the old selection never flashes; an outside tap meanwhile releases there.
        pendingFrame.current = requestAnimationFrame(() => {
          pendingFrame.current = 0
          pin.set(true)
        })
      },
      // A mouse entering in a single move can fire only pointerover in Chromium, with no pointermove.
      onPointerOver: handBackToMouse,
      onPointerMove: handBackToMouse,
    },
    /** Pass to `<PinnedChartTooltip pin>`. */
    pin,
  }
}
