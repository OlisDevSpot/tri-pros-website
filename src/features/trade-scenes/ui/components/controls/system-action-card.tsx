'use client'

import type { CSSProperties } from 'react'
import type { HomeSystemId, YardId } from '@/features/trade-scenes/types'

import { XIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, HOME_SYSTEM_LABELS, YARD_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { HOME_SYSTEM_ICONS, YARD_ICON, YEAR_BUILT_ICON } from '@/features/trade-scenes/constants/scene-control-icons'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { YARD_IDS } from '@/features/trade-scenes/constants/yards'
import { useLayoutEditorStore } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useSystemCardBottom } from '@/features/trade-scenes/contexts/system-card-bottom-context'
import { SystemActionsRow } from '@/features/trade-scenes/ui/components/controls/system-actions-row'
import { SystemCardBody } from '@/features/trade-scenes/ui/components/controls/system-card-body'
import { YardCardBody } from '@/features/trade-scenes/ui/components/controls/yard-card-body'
import { YearBuiltCardBody } from '@/features/trade-scenes/ui/components/controls/year-built-card-body'
import { focusFell } from '@/features/trade-scenes/ui/lib/leave-look-inside'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface SystemActionCardProps {
  // A yard is the Lot group's, and only where the lot is data.
  subject: HomeSystemId | 'year-built' | YardId
}

// Mounted once per subject, so a pick inside never replays its rise while a new system does. Beside the system on a wide
// stage, clear of the dock. A narrower stage has no room beside it, so the card spans the top (clear of the dock, which
// the phone has no width to spare for) and the picture's room follows the card, by its measured bottom, since its
// height follows its chips. Either way it stops short of what it must leave in sight (the rail, or the picture's system beneath it),
// and its body scrolls. A yard takes the same card: its rows are the yard's systems.
export function SystemActionCard({ subject }: SystemActionCardProps) {
  const { pickSystem } = useSceneControls()
  const { shape, stage, stageElement } = useSceneVisibleArea()
  const { setBottom } = useSystemCardBottom()
  const editor = useLayoutEditorStore()
  const reduceMotion = useReducedMotion()
  const card = useRef<HTMLElement>(null)
  const portrait = shape === 'portrait'
  const topStrip = shape !== 'landscape'
  const system = HOME_SYSTEM_IDS.find(id => id === subject) ?? null
  const yard = YARD_IDS.find(id => id === subject) ?? null
  const title = system !== null ? CONTROLS_COPY.systems.cardTitle(HOME_SYSTEM_LABELS[system]) : yard !== null ? YARD_LABELS[yard] : CONTROLS_COPY.systems.yearBuilt
  const Icon = system !== null ? HOME_SYSTEM_ICONS[system] : yard !== null ? YARD_ICON : YEAR_BUILT_ICON
  const { controls, dock, systemCard } = SCENE_LAYOUT
  const besideDock = dock.width + dock.gap + systemCard.dockGap
  const placement: CSSProperties = topStrip
    ? { top: systemCard.portraitTop, left: systemCard.portraitSide, right: portrait ? systemCard.portraitSide : besideDock, maxHeight: Math.round(stage.height * systemCard.topShare) }
    : { top: systemCard.top, right: besideDock, width: systemCard.width, maxHeight: stage.height - systemCard.top - controls.railBottom.wide - controls.railHeight - systemCard.visibleGap }

  // The x leaves with the card, so its focus goes to the system's or the yard's rail chip.
  const letGo = () => {
    const held = document.activeElement
    // eslint-disable-next-line react-dom/no-flush-sync -- the card leaves only once this write renders
    flushSync(() => yard === null ? pickSystem(null) : editor?.setState({ yard: null, selected: null }))
    if (focusFell(held)) {
      stageElement!.querySelector<HTMLElement>(`[data-rail-chip="${subject}"]`)!.focus()
    }
  }

  // Every card makes its room, so the picture slides aside for it and back when it closes.
  useLayoutEffect(() => {
    const element = card.current!
    const measure = () => setBottom(element.offsetTop + element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
      setBottom(null)
    }
  }, [setBottom])

  return (
    <motion.section
      ref={card}
      data-system-card={subject}
      aria-label={title}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: CONTROLS_EASE }}
      style={placement}
      className={cn('absolute z-20 grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden border bg-card shadow-2xl', portrait ? 'rounded-[20px]' : 'rounded-2xl')}
    >
      <div className="grid gap-2.5 border-b border-border py-2.5 pr-2.5 pl-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className={cn(CONTROLS_CLASSES.tile, 'size-9 rounded-[10px]')}><Icon /></span>
          <h2 className="text-base leading-none font-semibold whitespace-nowrap">{title}</h2>
          {/* The 36 px button reaches 40 past its edge. */}
          <Button type="button" variant="ghost" size="icon" aria-label={CONTROLS_COPY.close} onClick={letGo} className={cn(CONTROLS_CLASSES.closeButton, 'relative size-9 rounded-[10px] after:absolute after:-inset-0.5 hover:bg-muted')}>
            <XIcon aria-hidden />
          </Button>
        </div>
        <SystemActionsRow subject={subject} />
      </div>
      <div className="grid min-h-0 content-start gap-2.5 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-3.5">
        {system !== null ? <SystemCardBody system={system} /> : yard !== null ? <YardCardBody yard={yard} /> : <YearBuiltCardBody />}
      </div>
    </motion.section>
  )
}
