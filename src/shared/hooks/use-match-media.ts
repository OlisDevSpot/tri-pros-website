import type { Breakpoint } from '../constants/css-breakpoints'
import { useEffect, useState } from 'react'
import { BREAKPOINTS } from '../constants/css-breakpoints'

type BreakpointState = Record<Breakpoint, boolean>

export function getInitialState(): BreakpointState {
  return Object.keys(BREAKPOINTS).reduce((acc, key) => {
    acc[key as Breakpoint] = false
    return acc
  }, {} as BreakpointState)
}

export function useMatchMedia() {
  const [matches, setMatches] = useState<BreakpointState>(getInitialState)

  useEffect(() => {
    if (typeof window === 'undefined')
      return

    const mqls = Object.entries(BREAKPOINTS).map(([key, value]) => {
      const mql = window.matchMedia(`(min-width: ${value}px)`)

      const onChange = () => {
        setMatches(prev => ({
          ...prev,
          [key]: mql.matches,
        }))
      }

      onChange()
      mql.addEventListener('change', onChange)

      return { key, mql, onChange }
    })

    return () => {
      mqls.forEach(({ mql, onChange }) =>
        mql.removeEventListener('change', onChange),
      )
    }
  }, [])

  return matches
}
