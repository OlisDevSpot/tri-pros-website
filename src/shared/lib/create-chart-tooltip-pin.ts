/** What a pinned tooltip reads: `active` for `<Tooltip>`, undefined while a mouse drives recharts' own hover. */
export interface ChartTooltipPin {
  subscribe: (listener: () => void) => () => void
  getActive: () => boolean | undefined
}

// Lives outside React state: re-rendering the chart that owns the hook hands recharts fresh data, axis and bar
// props, which rebuilds every bar and replays its entry animation, so only the tooltip subscribes to it.
export function createChartTooltipPin() {
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
