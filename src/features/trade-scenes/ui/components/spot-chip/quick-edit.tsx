'use client'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useCallback, useEffect, useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { SCENE_VIEW_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { QuickEditBuild } from '@/features/trade-scenes/ui/components/spot-chip/quick-edit-build'
import { QuickEditToday } from '@/features/trade-scenes/ui/components/spot-chip/quick-edit-today'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface QuickEditProps {
  system: HomeSystemId
  // The most the whole chip may stand, so the body scrolls inside what is left under the name row.
  maxHeight: number
  // The chip's height with the fold shut, reported once for each side it opens on.
  onFolded: (height: number) => void
}

// The inputs for the side the scene shows. Each side mounts afresh, so a flip shuts the fold and reports its own height.
export function QuickEdit({ system, maxHeight, onFolded }: QuickEditProps) {
  const view = useSceneInputs((state: TradeSceneInputs) => state.view)
  const [rise, setRise] = useState(true)
  const { nameRowHalf, edge, riseDoneMs } = SCENE_LAYOUT.spotChip
  const chrome = 2 * nameRowHalf + 2 * edge

  useEffect(() => {
    const timer = setTimeout(() => setRise(false), riseDoneMs)
    return () => clearTimeout(timer)
  }, [riseDoneMs])

  const measure = useCallback((content: HTMLDivElement | null) => {
    if (!content) {
      return
    }
    let first = true
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false
        onFolded(chrome + content.offsetHeight)
      }
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [chrome, onFolded])

  return (
    <div data-quick-edit-body className={CONTROLS_CLASSES.quickEditBody} style={{ maxHeight: maxHeight - chrome }}>
      <div key={view} ref={measure} className={CONTROLS_CLASSES.quickEditContent}>
        <span className={cn(CONTROLS_CLASSES.quickEditSide, view === 'proposed' && CONTROLS_CLASSES.quickEditSideProposed)}>{SCENE_VIEW_LABELS[view]}</span>
        {view === 'existing' ? <QuickEditToday system={system} rise={rise} /> : <QuickEditBuild system={system} rise={rise} />}
      </div>
    </div>
  )
}
