import type { PointerEvent as ReactPointerEvent } from 'react'

import { useEffect, useRef, useState } from 'react'

// A single synthetic touch point reused for every forced re-select; recharts only reads its coordinates.
const SYNTHETIC_TOUCH_ID = -1

// v3 re-selects its active item/axis index only on a real touchmove, so a tap alone never updates it past
// the first one; replaying one at the tap's own point makes recharts re-run that same selection itself.
// Dispatched from `.recharts-wrapper`, not the tap's own target: near an edge that target can be a control
// overlapping the chart, and an event fired from there would never bubble into recharts' own tree.
function forceReselect(container: Element, clientX: number, clientY: number) {
  if (typeof Touch === 'undefined' || typeof TouchEvent === 'undefined') {
    return
  }
  const target = container.querySelector('.recharts-wrapper') ?? container
  try {
    const touch = new Touch({ identifier: SYNTHETIC_TOUCH_ID, target, clientX, clientY })
    target.dispatchEvent(new TouchEvent('touchmove', { touches: [touch], targetTouches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }))
  }
  catch {
    // No Touch/TouchEvent constructor (desktop Firefox/Safari); a touch/pen pointer there is unusual.
  }
}

/**
 * Keeps a recharts tooltip open after a tap. Recharts only shows it while the browser believes a mouse hovers the
 * chart, and a touch has no real hover: when the tooltip appears, Chrome re-checks hover at the last real mouse
 * position (touch never moves it), fires mouseleave on the chart and the tooltip vanishes.
 * Touch and pen pin it until a tap lands outside the container; a mouse keeps plain hover.
 *
 * Once a touch/pen pointer has fired here, `active` is driven explicitly (true while pinned, false once
 * released) rather than `undefined`: v3 can leave its own active state stuck true past release, and only
 * an explicit `false` overrides it.
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
    },
    /** Pass to `<Tooltip active>`; undefined leaves recharts' own hover in charge (real mouse use). */
    tooltipActive: touchLike ? pinned : undefined,
  }
}
