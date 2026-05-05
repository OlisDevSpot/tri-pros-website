import * as React from 'react'

const LG_BREAKPOINT = 1024

/**
 * Returns true when viewport width is below the Tailwind `lg` breakpoint
 * (< 1024px). Mirrors `useIsMobile` exactly but at a different threshold —
 * use this when a layout should collapse to single-column up through tablet
 * portrait, not just phone widths.
 *
 * SSR-safe: returns `false` on the first render and corrects on mount.
 */
export function useIsBelowLg() {
  const [isBelowLg, setIsBelowLg] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsBelowLg(window.innerWidth < LG_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsBelowLg(window.innerWidth < LG_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isBelowLg
}
