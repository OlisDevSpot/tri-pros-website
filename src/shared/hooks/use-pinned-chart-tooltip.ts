import type { PointerEvent as ReactPointerEvent } from 'react'

import { useEffect, useRef, useState } from 'react'

// Chromium's touch emulation never fires a touchmove for a tap alone, so its active axis index never updates
// past the first one; replaying a mousemove at the tap's own point makes recharts re-run that selection
// itself (WebKit taps already re-select through their own compat mouse events). Targets only the wrapper
// under the tap: recharts throttles this move through one shared scheduler, so dispatching to every wrapper
// in a syncId group would only let the last one land — the rest follow recharts' own sync instead.
function forceReselect(container: Element, clientX: number, clientY: number) {
  const wrapper = Array.from(container.querySelectorAll('.recharts-wrapper')).find((element) => {
    const rect = element.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  })
  wrapper?.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true, cancelable: true }))
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
  const [pinned, setPinned] = useState(false)
  const [touchLike, setTouchLike] = useState(false)

  useEffect(() => {
    if (!pinned) {
      return
    }
    const releaseOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) {
        setPinned(false)
        if (ref.current) {
          clearHover(ref.current)
        }
      }
    }
    document.addEventListener('pointerdown', releaseOutside, true)
    return () => document.removeEventListener('pointerdown', releaseOutside, true)
  }, [pinned])

  return {
    pinned,
    /** Spread on the element wrapping the chart (or every chart sharing a syncId). */
    containerProps: {
      ref,
      onPointerDownCapture: (event: ReactPointerEvent<T>) => {
        const isTouchLike = event.pointerType !== 'mouse'
        setTouchLike(isTouchLike)
        setPinned(isTouchLike)
        if (isTouchLike && ref.current) {
          forceReselect(ref.current, event.clientX, event.clientY)
        }
      },
      onPointerMove: (event: ReactPointerEvent<T>) => {
        if (event.pointerType === 'mouse') {
          setTouchLike(false)
        }
      },
    },
    /** Pass to `<Tooltip active>`; undefined leaves recharts' own hover in charge (real mouse use). */
    tooltipActive: touchLike ? pinned : undefined,
  }
}
