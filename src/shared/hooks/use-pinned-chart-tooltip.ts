import type { PointerEvent as ReactPointerEvent } from 'react'

import { useEffect, useRef, useState } from 'react'

// v3 re-selects its active axis index only on a real mousemove/touchmove, so a tap alone never updates it
// past the first one; replaying one at the tap's own point makes recharts run that same selection itself.
// A MouseEvent works in every engine (WebKit rejects the Touch/TouchEvent constructors outright), and reaches
// every chart sharing this container (a syncId group renders more than one `.recharts-wrapper`).
function forceReselect(container: Element, clientX: number, clientY: number) {
  container.querySelectorAll('.recharts-wrapper').forEach(wrapper =>
    wrapper.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true, cancelable: true })),
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
