'use client'

import type { ReactNode } from 'react'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { ChevronDownIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { QUICK_EDIT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { wearFoldSummary } from '@/features/trade-scenes/lib/wear-summary'
import { CollapseRegion } from '@/features/trade-scenes/ui/components/controls/collapse-region'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface WearFoldProps {
  id: 'exterior-paint' | 'roof'
  material: ResolvedHomeMaterial | undefined
  children: ReactNode
}

// The wear fields behind one line that says what they hold. Paint rated New and a missing material have no fields, so they
// have no fold either.
export function WearFold({ id, material, children }: WearFoldProps) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const recorded = useSceneInputs((state: TradeSceneInputs) => id === 'roof' ? state.homeMaterials.coveringWear : state.homeMaterials.paintWear)
  const roofType = useSceneInputs((state: TradeSceneInputs) => state.property.roofType ?? 'shingle')
  const fields = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(scrollTimer.current), [])
  const summary = wearFoldSummary(material, recorded, id === 'roof' ? 'covering' : 'paint', roofType)
  if (summary === null) {
    return null
  }
  // Only the chip's body scrolls: the chip's own box is still growing, and scrolling it would shift the name row.
  const scrollRowsIn = () => {
    const rows = fields.current
    const body = rows?.closest<HTMLElement>('[data-quick-edit-body]')
    if (!rows || !body) {
      return
    }
    const past = rows.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom
    if (past > 0) {
      body.scrollTo({ top: body.scrollTop + past, behavior: reduced ? 'instant' : 'smooth' })
    }
  }
  // Opened past the room left, the rows come into view once the region has grown to hold them.
  const toggle = () => {
    clearTimeout(scrollTimer.current)
    if (!open) {
      scrollTimer.current = setTimeout(scrollRowsIn, reduced ? 0 : SCENE_LAYOUT.spotChip.sizeMs)
    }
    setOpen(!open)
  }
  return (
    <div className="w-full">
      <button type="button" data-wear-fold aria-expanded={open} data-state={open ? 'open' : 'closed'} onClick={toggle} className={CONTROLS_CLASSES.wearFold}>
        {QUICK_EDIT_COPY.wearFold[id]}
        <span className={CONTROLS_CLASSES.wearFoldSummary}>{summary}</span>
        <ChevronDownIcon aria-hidden className={cn(CONTROLS_CLASSES.wearFoldChevron, open && 'rotate-180')} />
      </button>
      <CollapseRegion contentKey={open ? id : null}>
        <div ref={fields} className="grid gap-3 pt-1 pb-1">{children}</div>
      </CollapseRegion>
    </div>
  )
}
