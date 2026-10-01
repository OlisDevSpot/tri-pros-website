'use client'

import { useTheme } from 'next-themes'
import { useCallback, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

import { THEME_SWITCH_EASE } from '@/features/agent-dashboard/constants/sidebar-motion'

type ResolvedTheme = 'light' | 'dark'

const REVEAL_MS = 480

const subscribeNever = () => () => {}

/**
 * Switches light/dark by revealing the new theme as a circle grown from `origin`.
 * `afterApply` runs once the new theme is in the DOM, for a control that animates itself into place.
 */
export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme()
  // next-themes knows the theme during the client's first render but the server never does, so
  // anything rendered from it (aria-checked, data-state) waits for hydration to finish.
  const isHydrated = useSyncExternalStore(subscribeNever, () => true, () => false)

  const switchTheme = useCallback((next: ResolvedTheme, origin: HTMLElement | null, afterApply?: () => void) => {
    // next-themes writes the class in an effect; flushSync runs it before the view transition
    // takes its "new" snapshot, or the snapshot would still show the old theme.
    // eslint-disable-next-line react-dom/no-flush-sync
    const apply = () => flushSync(() => setTheme(next))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!origin || reduceMotion || typeof document.startViewTransition !== 'function') {
      apply()
      return
    }

    const { innerWidth: width, innerHeight: height } = window
    const rect = origin.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
    // Percentages, not px: Chrome renders px clip paths on ::view-transition-new unscaled at
    // fractional display scales (Windows 150%) on the first transition after load.
    const at = `${(x / width) * 100}% ${(y / height) * 100}%`
    const end = `${(radius / (Math.hypot(width, height) / Math.SQRT2)) * 100}%`

    const root = document.documentElement
    root.dataset.themeReveal = ''
    const transition = document.startViewTransition(() => {
      apply()
      afterApply?.()
    })
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0% at ${at})`, `circle(${end} at ${at})`] },
          { duration: REVEAL_MS, easing: THEME_SWITCH_EASE, pseudoElement: '::view-transition-new(root)' },
        )
      })
      .catch(() => {})
    transition.finished.finally(() => {
      delete root.dataset.themeReveal
    })
  }, [setTheme])

  return { isDark: isHydrated && resolvedTheme === 'dark', switchTheme }
}
