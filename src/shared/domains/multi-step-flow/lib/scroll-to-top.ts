/**
 * Scroll a target element (an internally-scrolling stage / authenticated panel)
 * to top, or the window when no target is given. SSR-guarded.
 */
export function scrollToTop(target?: HTMLElement | null): void {
  if (target) {
    target.scrollTo({ top: 0, left: 0 })
    return
  }
  if (typeof window === 'undefined') {
    return
  }
  window.scrollTo({ top: 0, left: 0 })
}
