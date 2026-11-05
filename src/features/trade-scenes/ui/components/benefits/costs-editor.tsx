'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'

import { BENEFITS_COPY, CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { CONTROLS_EASE } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { CostsBillRow } from '@/features/trade-scenes/ui/components/benefits/costs-bill-row'
import { CostsRepairsRow } from '@/features/trade-scenes/ui/components/benefits/costs-repairs-row'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'
import { CLIMATE_LABELS, CLIMATES } from '@/shared/modules/construction/core/constants/climate-presets'

interface CostsEditorProps {
  // Named by Edit costs' aria-controls.
  id: string
}

const GROUP_HEAD = 'col-span-full pt-1 text-xs font-bold tracking-[.14em] text-muted-foreground uppercase'
// The editor's height caps (px), and the gap kept to the window's bottom edge when the window is the shorter.
const EDITOR_CAP = { portrait: 540, wide: 600, clearance: 8 } as const

// Opens over the window, so nothing under it moves. The area is set here only while it is missing; once set it belongs
// to Home facts, and the row says so.
export function CostsEditor({ id }: CostsEditorProps) {
  const { repairs, repairsResolved } = useBenefitsFigures()
  const climate = useSceneInputs((state: TradeSceneInputs) => state.climate)
  const applyChange = useApplySceneChange()
  const { shape, stage } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const gridRef = useRef<HTMLDivElement>(null)
  const portrait = shape === 'portrait'
  const wide = portrait ? 'col-span-full' : 'col-span-2'

  // A short phone's window ends above the editor's own cap: it stops short of the window's edge and scrolls. Read from
  // offsets, which the editor's entrance does not move.
  useLayoutEffect(() => {
    const editor = gridRef.current!
    const anchor = (editor.offsetParent as HTMLElement).getBoundingClientRect()
    const frame = editor.parentElement!.closest('[role="dialog"]')!.getBoundingClientRect()
    editor.style.maxHeight = `${Math.min(portrait ? EDITOR_CAP.portrait : EDITOR_CAP.wide, frame.bottom - anchor.top - editor.offsetTop - EDITOR_CAP.clearance)}px`
  }, [portrait, stage.height, stage.width])

  return (
    <motion.div
      ref={gridRef}
      id={id}
      role="group"
      aria-label={BENEFITS_COPY.editor.label}
      data-costs-editor
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: CONTROLS_EASE }}
      className={cn(
        'absolute grid items-center overflow-y-auto overscroll-contain rounded-[14px] border border-border-strong bg-popover px-4.5 pt-4 pb-3.5 text-popover-foreground shadow-2xl',
        portrait
          ? '-inset-x-1.75 top-[calc(100%+14px)] grid-cols-[minmax(0,1fr)_112px] gap-x-2.5 gap-y-1.5'
          : 'top-[calc(100%+18px)] right-0 w-140 grid-cols-[minmax(0,1fr)_132px_118px] gap-x-3.5 gap-y-2',
      )}
    >
      <span className={GROUP_HEAD}>{BENEFITS_COPY.editor.bills}</span>
      {climate === null
        ? (
            <div data-costs-area-row className="contents">
              <span className="grid text-sm leading-tight font-bold">
                {BENEFITS_COPY.editor.area}
                <small className={cn('text-xs font-bold', toneClasses('attention').text)}>{BENEFITS_COPY.editor.missing}</small>
              </span>
              <span className={cn(wide, 'justify-self-start')}>
                <ChoicePill
                  label={CONTROLS_COPY.facts.climate}
                  value={null}
                  options={CLIMATES}
                  labels={CLIMATE_LABELS}
                  onChange={(next) => {
                    // The pill leaves with the pick, so focus moves on to the first bill rather than falling to the page.
                    gridRef.current!.querySelector<HTMLInputElement>('[data-bill-row] input')!.focus()
                    applyChange({ kind: 'climate', climate: next })
                  }}
                />
              </span>
              <span data-costs-area-note className={cn(portrait ? 'col-span-full' : 'col-span-2 col-start-2', 'text-xs text-muted-foreground')}>{BENEFITS_COPY.editor.missingNote}</span>
            </div>
          )
        : (
            <div data-costs-area-row className="contents">
              <span className="text-sm font-bold">{BENEFITS_COPY.editor.area}</span>
              <b data-costs-area-value className="text-sm">{CLIMATE_LABELS[climate]}</b>
              <span data-costs-area-note className={cn(portrait && 'col-span-full', 'text-xs text-muted-foreground')}>{BENEFITS_COPY.editor.setNote}</span>
            </div>
          )}
      {SAVINGS_CATEGORIES.map(category => <CostsBillRow key={category} category={category} />)}
      <span className={cn(GROUP_HEAD, 'mt-1 border-t border-border-strong pt-2.5')}>{BENEFITS_COPY.editor.repairs}</span>
      {repairs.map(row => <CostsRepairsRow key={row.material} row={row} source={repairsResolved[row.trade]!.source} />)}
      <p data-costs-foot className="col-span-full pt-1 text-xs text-muted-foreground">{BENEFITS_COPY.editor.foot}</p>
    </motion.div>
  )
}
