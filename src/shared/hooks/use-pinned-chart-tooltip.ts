import type { PointerEvent as ReactPointerEvent } from 'react'

import type { MouseHandlerDataParam } from 'recharts'

import { useEffect, useRef, useState } from 'react'

/**
 * Keeps a recharts tooltip open after a tap. Recharts only shows it while the browser believes a mouse hovers the
 * chart, and a touch has no real hover: when the tooltip appears, Chrome re-checks hover at the last real mouse
 * position (touch never moves it), fires mouseleave on the chart and the tooltip vanishes.
 * Touch and pen pin it until a tap lands outside the container; a mouse keeps plain hover.
 *
 * v3 selects on touchmove only, and the tap's emulated mouseleave clears recharts' own active index even though
 * `active` stays forced true — so the index is tracked here instead and handed back to the chart explicitly.
 */
export function usePinnedChartTooltip<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [pinned, setPinned] = useState(false)
  const [index, setIndex] = useState<string | null>(null)

  useEffect(() => {
    if (!pinned) {
      return
    }
    const releaseOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) {
        setPinned(false)
        setIndex(null)
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
    /** Pass to `<Tooltip defaultIndex>` so a pinned tooltip keeps pointing at the tapped segment. */
    tooltipIndex: pinned ? index : undefined,
    /** Pass to the chart root's `onClick`, so a tap records which segment to keep pinned. */
    onChartClick: (state: MouseHandlerDataParam) => setIndex(state.activeTooltipIndex == null ? null : String(state.activeTooltipIndex)),
  }
}
