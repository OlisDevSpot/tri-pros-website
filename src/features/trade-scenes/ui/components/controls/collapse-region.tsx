'use client'

import type { ReactNode } from 'react'

import { useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'

interface CollapseRegionProps {
  // Names what the children show, so a re-render that shows the same thing keeps the copy held for the shut; null shuts it.
  contentKey: string | null
  children: ReactNode
}

// Opens and shuts on a 0fr to 1fr row, so it grows to its content without measuring it. While it shuts it keeps the last
// content it showed, so that content leaves with it rather than vanishing first.
export function CollapseRegion({ contentKey, children }: CollapseRegionProps) {
  const reduceMotion = useReducedMotion()
  const shown = contentKey !== null
  const [last, setLast] = useState<{ key: string | null, content: ReactNode }>({ key: null, content: null })
  if (shown && contentKey !== last.key) {
    setLast({ key: contentKey, content: children })
  }
  // With no transition there is no transitionend to clear it on.
  const leaving = !shown && !reduceMotion ? last.content : null

  return (
    <div
      inert={!shown}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows' && !shown) {
          setLast({ key: null, content: null })
        }
      }}
      style={{
        gridTemplateRows: shown ? '1fr' : '0fr',
        opacity: shown ? 1 : 0,
        transition: reduceMotion ? 'none' : `grid-template-rows 260ms ${CONTROLS_EASE_CSS}, opacity 200ms ${CONTROLS_EASE_CSS}`,
      }}
      className="grid min-h-0 flex-[0_1_auto]"
    >
      <div className="flex min-h-0 flex-col overflow-hidden">{shown ? children : leaving}</div>
    </div>
  )
}
