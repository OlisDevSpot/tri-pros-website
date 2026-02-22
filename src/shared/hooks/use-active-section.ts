'use client'

import { useEffect, useRef, useState } from 'react'

interface Options {
  rootEl?: HTMLElement | null
}

export function useActiveSection(sectionIds: string[], { rootEl }: Options = {}) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? '')
  const activeIdRef = useRef(activeId)
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    if (document) {
      const sectionElements = sectionIds
        .map(id => document.getElementById(id))
        .filter(Boolean) as HTMLElement[]

      if (!sectionElements.length)
        return

      // Pick the section that is *most* in view (more stable than first-intersecting).
      const sectionRatios = new Map<string, number>()

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            sectionRatios.set(e.target.id, e.intersectionRatio)
          }

          let bestId = activeId
          let bestRatio = -1

          for (const [id, ratio] of sectionRatios.entries()) {
            if (ratio > bestRatio) {
              bestRatio = ratio
              bestId = id
            }
          }

          if (bestId && bestId !== activeIdRef.current)
            setActiveId(bestId)
        },
        {
          // Tune this depending on your navbar height (see note below)
          root: rootEl ?? null,
          rootMargin: '-25% 0px -55% 0px',
          threshold: [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1],
        },
      )

      sectionElements.forEach(el => io.observe(el))
      return () => io.disconnect()
    }
  }, [activeId, rootEl, sectionIds])

  return activeId
}
