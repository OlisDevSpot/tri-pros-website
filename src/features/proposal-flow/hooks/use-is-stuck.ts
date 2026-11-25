import { useEffect, useState } from 'react'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'

// A sticky node never leaves its scroller, so "stuck" is read as the node being clipped by 1px at the sticky line. Threshold 0 as well as 1: Chromium notifies only when the threshold index changes, and an instant jump from off-screen into the stuck state would otherwise stay at index 0.
export function useIsStuck(node: HTMLElement | null, top: number) {
  const { rootEl } = useScrollRoot()
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    if (!node || !rootEl) {
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0))
      },
      { root: rootEl, rootMargin: `${-(top + 1)}px 0px 0px 0px`, threshold: [0, 1] },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      setStuck(false)
    }
  }, [node, rootEl, top])

  return stuck
}
