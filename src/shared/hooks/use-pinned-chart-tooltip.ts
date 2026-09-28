import type { PointerEvent as ReactPointerEvent } from 'react'

import { useEffect, useRef, useState } from 'react'

interface Options {
  /** Clears any highlight the chart keeps in its own state once the pin is released. */
  onUnpin?: () => void
}

/**
 * Keeps a recharts tooltip open after a tap. Recharts only shows it while the browser believes a mouse hovers the
 * chart, and a touch has no real hover: when the tooltip appears, Chrome re-checks hover at the last real mouse
 * position (touch never moves it), fires mouseleave on the chart and the tooltip vanishes.
 * Touch and pen pin it until a tap lands outside the container; a mouse keeps plain hover.
 */
export function usePinnedChartTooltip<T extends HTMLElement = HTMLDivElement>({ onUnpin }: Options = {}) {
  const ref = useRef<T>(null)
  const [pinned, setPinned] = useState(false)
  // A ref, not useEffectEvent: Next 15's bundled React does not export it, though the installed types do.
  const onUnpinRef = useRef(onUnpin)
  onUnpinRef.current = onUnpin

  useEffect(() => {
    if (!pinned) {
      return
    }
    const releaseOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) {
        setPinned(false)
        onUnpinRef.current?.()
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
      onPointerDownCapture: (event: ReactPointerEvent<T>) => setPinned(event.pointerType !== 'mouse'),
    },
    /** Pass to `<Tooltip active>`; undefined leaves recharts' own hover in charge. */
    tooltipActive: pinned ? true : undefined,
  }
}
