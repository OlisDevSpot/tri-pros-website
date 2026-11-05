'use client'

import type { RefObject } from 'react'

import { animate, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'

import { BENEFITS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE } from '@/features/trade-scenes/constants/scene-layout'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { futureYear } from '@/features/trade-scenes/lib/future-year'
import { yearLabel } from '@/features/trade-scenes/lib/year-label'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface TwoFuturesReadoutProps {
  portrait: boolean
}

type Figures = Record<'without' | 'with' | 'saves', number>

const KEY = 'inline-flex items-center gap-1.5 text-xs font-bold tracking-[.08em] whitespace-nowrap text-muted-foreground uppercase'
const SWATCH = 'inline-block h-0.75 w-3.5 rounded-xs'

// The picked year's three figures count from the ones drawn to the new ones, written straight to their nodes so a count
// re-renders nothing; each keeps a reserved width, so a count never nudges its neighbours. The live region reads the
// settled figures, never the steps between.
export function TwoFuturesReadout({ portrait }: TwoFuturesReadoutProps) {
  const { today, after, now } = useBenefitsFigures()
  const { lookAhead } = useBenefits()
  const reduceMotion = useReducedMotion()
  const picked = futureYear(today, after, lookAhead)
  const without = picked.without.total
  const withBuild = picked.with.total
  const saves = picked.saves
  const withoutRef = useRef<HTMLSpanElement>(null)
  const withRef = useRef<HTMLSpanElement>(null)
  const savesRef = useRef<HTMLSpanElement>(null)
  const drawn = useRef<Figures | null>(null)

  useLayoutEffect(() => {
    const to: Figures = { without, with: withBuild, saves }
    const from = drawn.current ?? to
    const draw = (figures: Figures) => {
      drawn.current = figures
      withoutRef.current!.textContent = formatAsDollars(figures.without)
      withRef.current!.textContent = formatAsDollars(figures.with)
      savesRef.current!.textContent = formatAsDollars(figures.saves)
    }
    if (reduceMotion) {
      draw(to)
      return
    }
    draw(from)
    const controls = animate(0, 1, {
      duration: 0.52,
      ease: CONTROLS_EASE,
      onUpdate: share => draw({
        without: Math.round(from.without + (to.without - from.without) * share),
        with: Math.round(from.with + (to.with - from.with) * share),
        saves: Math.round(from.saves + (to.saves - from.saves) * share),
      }),
    })
    return () => controls.stop()
  }, [without, withBuild, saves, reduceMotion])

  const figure = (key: keyof Figures, ref: RefObject<HTMLSpanElement | null>, value: number, className?: string) => (
    <b data-futures-figure={key} className={cn('font-bold whitespace-nowrap tabular-nums', portrait ? 'min-w-[4.4ch] text-lg leading-tight' : 'min-w-[5.6ch] text-2xl leading-tight', className)}>
      {/* The display face goes on the count, not the <b>, so the suffix keeps the body's. */}
      <span aria-hidden ref={ref} data-futures-count className="font-sans font-semibold" />
      <small aria-hidden className={cn('ml-0.5 text-xs font-bold text-muted-foreground', portrait && 'hidden')}>{SAVINGS_COPY.billSuffix}</small>
      <span data-futures-value className="sr-only">{`${formatAsDollars(value)}${SAVINGS_COPY.billSuffix}`}</span>
    </b>
  )
  const theBuild = !portrait && BENEFITS_COPY.futures.theBuild

  return (
    <div
      data-futures-readout
      aria-live="polite"
      className={cn('flex items-center', portrait ? 'h-14 flex-wrap content-start gap-x-3 gap-y-0.5' : 'h-11.5 gap-6.5')}
    >
      <span
        data-futures-chip
        className={cn(
          'relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-popover font-bold tabular-nums inset-ring-[1.5px] inset-ring-primary before:absolute before:inset-x-0 before:top-0 before:bg-primary',
          portrait ? 'h-9 min-w-13.5 px-1.5 pt-1.75 text-xs before:h-1.75' : 'h-11 min-w-18.5 px-2 pt-2.25 text-sm before:h-2.25',
        )}
      >
        {lookAhead === 1 ? yearLabel(1) : BENEFITS_COPY.futures.by(yearLabel(lookAhead))}
      </span>
      <span className="grid gap-px">
        <span className={KEY}>
          <i aria-hidden className={cn(SWATCH, 'bg-chart-5')} />
          {BENEFITS_COPY.futures.without}
          {theBuild}
        </span>
        {figure('without', withoutRef, without)}
      </span>
      <span className="grid gap-px">
        <span className={KEY}>
          <i aria-hidden className={cn(SWATCH, 'bg-primary')} />
          {BENEFITS_COPY.futures.with}
          {theBuild}
        </span>
        {figure('with', withRef, withBuild)}
      </span>
      <span className="grid gap-px">
        <span className={KEY}>
          <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-xs border border-status-success-fg bg-status-success-bg" />
          {BENEFITS_COPY.futures.saves}
        </span>
        {figure('saves', savesRef, saves, toneClasses('success').text)}
      </span>
      <span data-futures-today className={cn('text-xs whitespace-nowrap text-muted-foreground', portrait ? 'basis-full' : 'ml-auto text-sm')}>
        {BENEFITS_COPY.futures.today.lead}
        <b className="text-foreground tabular-nums">{formatAsDollars(now.without.total)}</b>
        {BENEFITS_COPY.futures.today.to}
        <b className="text-foreground tabular-nums">{formatAsDollars(now.with.total)}</b>
        {BENEFITS_COPY.futures.today.saves}
        <b className="text-foreground tabular-nums">{formatAsDollars(now.saves)}</b>
        {BENEFITS_COPY.futures.today.tail}
      </span>
    </div>
  )
}
