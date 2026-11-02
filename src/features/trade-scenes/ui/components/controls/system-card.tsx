'use client'

import type { CSSProperties } from 'react'
import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { XIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, HOME_SYSTEM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SYSTEM_ICONS, YEAR_BUILT_ICON } from '@/features/trade-scenes/constants/scene-control-icons'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useSystemCardBottom } from '@/features/trade-scenes/contexts/system-card-bottom-context'
import { SystemCardBody } from '@/features/trade-scenes/ui/components/controls/system-card-body'
import { YearBuiltCardBody } from '@/features/trade-scenes/ui/components/controls/year-built-card-body'
import { focusFell } from '@/features/trade-scenes/ui/lib/leave-close-up'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

interface SystemCardProps {
  focus: HomeSystemId | 'year-built'
}

// Mounted once per focus, so a pick inside never replays its rise while a new system does. Beside the system on a wide
// stage, clear of the dock. A narrower stage has no room beside it, so the card spans the top (clear of the dock, which
// the phone has no width to spare for) and the camera frames the system below it, by its measured bottom, since its
// height follows its chips.
export function SystemCard({ focus }: SystemCardProps) {
  const { focusSystem } = useSceneControls()
  const { shape, stageElement } = useSceneVisibleArea()
  const { setBottom } = useSystemCardBottom()
  const view = useSceneInputs((state: TradeSceneInputs) => state.view)
  const reduceMotion = useReducedMotion()
  const card = useRef<HTMLElement>(null)
  const portrait = shape === 'portrait'
  const topStrip = shape !== 'landscape'
  const yearBuilt = focus === 'year-built'
  const title = yearBuilt ? CONTROLS_COPY.systems.yearBuilt : HOME_SYSTEM_LABELS[focus]
  const Icon = yearBuilt ? YEAR_BUILT_ICON : HOME_SYSTEM_ICONS[focus]
  const { dock, systemCard } = SCENE_LAYOUT
  const besideDock = dock.width + dock.gap + systemCard.dockGap
  const placement: CSSProperties = topStrip
    ? { top: systemCard.portraitTop, left: systemCard.portraitSide, right: portrait ? systemCard.portraitSide : besideDock }
    : { top: systemCard.top, right: besideDock, width: systemCard.width }

  // The x leaves with the card, so its focus goes to the system's rail chip.
  const letGo = () => {
    const held = document.activeElement
    // eslint-disable-next-line react-dom/no-flush-sync -- the card leaves only once this write renders
    flushSync(() => focusSystem(null))
    if (focusFell(held)) {
      stageElement!.querySelector<HTMLElement>(`[data-rail-chip="${focus}"]`)!.focus()
    }
  }

  // Year built holds no camera view, so it leaves the visible area alone.
  useLayoutEffect(() => {
    if (yearBuilt) {
      return
    }
    const element = card.current!
    const measure = () => setBottom(element.offsetTop + element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
      setBottom(null)
    }
  }, [yearBuilt, setBottom])

  return (
    <motion.section
      ref={card}
      data-system-card={focus}
      aria-label={title}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: CONTROLS_EASE }}
      style={placement}
      className={cn('absolute z-20 grid border bg-card shadow-2xl', portrait ? 'rounded-[20px]' : 'rounded-2xl')}
    >
      <div className="flex items-center gap-2.5 border-b border-border py-2.5 pr-2.5 pl-3">
        <span aria-hidden className={cn(CONTROLS_CLASSES.tile, 'size-9 rounded-[10px]')}><Icon /></span>
        <h2 className="text-base leading-none font-semibold whitespace-nowrap">{title}</h2>
        {!portrait && (
          <span data-system-tag className={cn(CONTROLS_CLASSES.tag, !yearBuilt && view === 'proposed' && CONTROLS_CLASSES.tagProposed)}>
            {yearBuilt ? CONTROLS_COPY.systems.setsToday : CONTROLS_COPY.systems.showing[view]}
          </span>
        )}
        {/* The 36 px button reaches 40 past its edge. */}
        <button type="button" aria-label={CONTROLS_COPY.close} onClick={letGo} className={cn(CONTROLS_CLASSES.closeButton, 'relative size-9 rounded-[10px] after:absolute after:-inset-0.5')}>
          <XIcon aria-hidden />
        </button>
      </div>
      <div className="grid gap-2.5 px-3.5 pt-3 pb-3.5">
        {yearBuilt ? <YearBuiltCardBody /> : <SystemCardBody system={focus} />}
      </div>
    </motion.section>
  )
}
