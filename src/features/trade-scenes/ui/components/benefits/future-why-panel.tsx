'use client'

import type { FutureYear, MonthlyCosts, TradeSceneInputs } from '@/features/trade-scenes/types'

import { XIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Fragment, useEffect, useId, useRef } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY, CONTROLS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { R_VALUE_SCOPES } from '@/features/trade-scenes/constants/r-value-scopes'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { CONTROLS_EASE } from '@/features/trade-scenes/constants/scene-layout'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { futureYear } from '@/features/trade-scenes/lib/future-year'
import { yearLabel } from '@/features/trade-scenes/lib/year-label'
import { WhyMathRow } from '@/features/trade-scenes/ui/components/benefits/why-math-row'
import { WhyUsesRow } from '@/features/trade-scenes/ui/components/benefits/why-uses-row'
import { BlockEyebrow } from '@/shared/components/block/block-eyebrow'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { BILL_CATEGORY_LABELS } from '@/shared/modules/construction/core/constants/bill-categories'
import { BILL_GROWTH_RATES_PERCENT } from '@/shared/modules/construction/core/constants/bill-growth-rates'
import { CONSTRUCTION_GROWTH_RATE_PERCENT } from '@/shared/modules/construction/core/constants/construction-growth-rate'
import { formatCompoundClaim } from '@/shared/modules/construction/core/lib/bill-cut-claims'

interface FutureWhyPanelProps {
  portrait: boolean
}

const { why } = BENEFITS_COPY
const LIST = new Intl.ListFormat('en', { type: 'conjunction' })
// The eyebrow's own size and ink are marketing tokens, unset in the dashboard, so it would print at body size: the panel
// sets the size, tracking and muted ink the window's other group heads use.
const EYEBROW = 'text-xs tracking-[.14em]'
const EYEBROW_INK = { color: 'var(--muted-foreground)' }

// The calculator's info sheet, inside the window over the band and the matrix: the question, its answer for the picked
// year, what it uses, how it is worked out, and the math for today and that year.
export function FutureWhyPanel({ portrait }: FutureWhyPanelProps) {
  const { today, after, now: first, repairs, repairsResolved, picks } = useBenefitsFigures()
  const { lookAhead, setWhyOpen, openers } = useBenefits()
  const { savings } = useSceneTargets()
  const bills = useSceneInputs((state: TradeSceneInputs) => state.bills)
  const reduceMotion = useReducedMotion()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const when = yearLabel(lookAhead)
  const then = futureYear(today, after, lookAhead)
  // The copy writes the dollar sign; this adds the thousands separator.
  const money = (amount: number) => amount.toLocaleString('en-US')
  const monthly = (amount: number) => `${formatAsDollars(amount)}${SAVINGS_COPY.billSuffix}`

  // The panel takes focus from the "?", and gives it back on every way out.
  useEffect(() => {
    closeRef.current!.focus()
  }, [])
  const close = () => {
    setWhyOpen(false)
    openers.why.current!.focus()
  }

  const claims = SAVINGS_CATEGORIES
    .filter(category => savings.cuts[category].bill > 0 && savings.cuts[category].combined > 0)
    .map(category => why.rows.cutOf(formatCompoundClaim(Math.round(savings.cuts[category].combined * 100)), BILL_CATEGORY_LABELS[category]))
  const savesNote = LIST.format(today.repairs > after.repairs ? [...claims, why.rows.repairsEnded] : claims)
  const years = lookAhead - 1
  const factor = (percent: number, of: string) => (
    <>
      {why.rows.times}
      {/* 7.57 %/yr reads as the factor the math multiplies by: 1.0757. */}
      {String(Number(((100 + percent) / 100).toFixed(4)))}
      <sup>{years}</sup>
      {` ${of}`}
    </>
  )
  const growthNote = (
    <>
      {why.rows.growthLead}
      {factor(BILL_GROWTH_RATES_PERCENT.electric, BILL_CATEGORY_LABELS.electric.toLowerCase())}
      {why.rows.next}
      {factor(BILL_GROWTH_RATES_PERCENT.gas, BILL_CATEGORY_LABELS.gas.toLowerCase())}
      {why.rows.next}
      {factor(CONSTRUCTION_GROWTH_RATE_PERCENT, why.rows.repairs)}
    </>
  )
  const parts = (costs: MonthlyCosts) => why.rows.parts(money(costs.electric), money(costs.gas), money(costs.repairs))
  const block = (year: number, figures: FutureYear) => (
    <div data-why-block={year}>
      <BlockEyebrow className={cn(EYEBROW, 'pt-3 pb-0.5')} style={EYEBROW_INK}>{year === 1 ? why.blocks.today : why.blocks.year(when, String(year))}</BlockEyebrow>
      <WhyMathRow name="without" label={why.rows.without} note={parts(figures.without)} value={monthly(figures.without.total)} />
      <WhyMathRow name="with" label={why.rows.with} note={parts(figures.with)} value={monthly(figures.with.total)} />
      <WhyMathRow name="saves" op={why.rows.equals} label={why.rows.saves} note={year === 1 ? savesNote : growthNote} value={monthly(figures.saves)} strong />
    </div>
  )
  const success = cn('not-italic', toneClasses('success').text)

  return (
    <>
      <motion.div
        aria-hidden
        data-why-scrim
        onClick={close}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.16, ease: CONTROLS_EASE }}
        className="absolute inset-0 z-20 bg-scrim/55"
      />
      <motion.div
        data-why-panel
        role="dialog"
        aria-labelledby={titleId}
        initial={reduceMotion ? false : portrait ? { opacity: 0, y: 28 } : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : portrait ? { opacity: 0, y: 28 } : { opacity: 0, x: 28 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, ease: CONTROLS_EASE }}
        className={cn(
          'absolute z-30 flex flex-col border-border-strong bg-popover text-popover-foreground shadow-2xl',
          portrait ? 'inset-x-0 bottom-0 max-h-[92%] rounded-t-[18px] border-t' : 'inset-y-0 right-0 w-117.5 border-l',
        )}
      >
        <div className="flex shrink-0 items-start gap-2.5 pt-4 pr-3.5 pl-5">
          <h3 id={titleId} className="flex-1 text-xl leading-tight font-bold">{BENEFITS_COPY.head.why}</h3>
          <button ref={closeRef} type="button" aria-label={CONTROLS_COPY.close} onClick={close} className={CONTROLS_CLASSES.closeButton}>
            <XIcon aria-hidden />
          </button>
        </div>
        {/* The head's gap moves into the scroll's own padding, so its fades sit over padding at rest and the text slips
            under the title rather than being cut at it. */}
        <div data-why-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-5.5 [mask-image:linear-gradient(to_bottom,transparent,black_0.5rem,black_calc(100%_-_1rem),transparent)]">
          <p data-why-section="answer" className="text-base leading-snug font-bold">
            {lookAhead === 1
              ? (
                  <>
                    {why.answer.withoutNow(money(first.without.total))}
                    {why.answer.withNow(money(first.with.total))}
                    {why.answer.saves}
                    <em className={success}>{why.answer.savesNow(money(first.saves))}</em>
                  </>
                )
              : (
                  <>
                    {why.answer.without(money(first.without.total), money(then.without.total), when)}
                    {why.answer.with(money(first.with.total), money(then.with.total), when)}
                    {why.answer.saves}
                    <em className={success}>{why.answer.savesNow(money(first.saves))}</em>
                    {why.answer.and}
                    <em className={success}>{why.answer.savesBy(money(then.saves), when)}</em>
                  </>
                )}
            {why.answer.end}
          </p>
          <section data-why-section="uses">
            <BlockEyebrow className={cn(EYEBROW, 'pt-4 pb-1.5')} style={EYEBROW_INK}>{why.heads.uses}</BlockEyebrow>
            <div className="grid border-t border-border">
              {SAVINGS_CATEGORIES.map((category) => {
                const cut = savings.cuts[category]
                const label = BILL_CATEGORY_LABELS[category]
                return (
                  <Fragment key={category}>
                    <WhyUsesRow portrait={portrait} label={why.uses.bill(label)} value={monthly(today[category])} tag={bills[category].now === null ? 'working' : 'typed'} />
                    {cut.bill > 0 && cut.combined > 0 && (
                      <WhyUsesRow portrait={portrait} label={why.uses.cut(label)} value={formatCompoundClaim(Math.round(cut.combined * 100))} tag={cut.typed ? 'typed' : 'calculated'} />
                    )}
                    {cut.bill > 0 && <WhyUsesRow portrait={portrait} label={why.uses.rise(label)} value={why.uses.rate(String(BILL_GROWTH_RATES_PERCENT[category]))} tag="working" />}
                  </Fragment>
                )
              })}
              {repairs.map((row) => {
                const resolved = repairsResolved[row.trade]!
                return (
                  <WhyUsesRow
                    key={row.material}
                    portrait={portrait}
                    label={row.trade in savings.repairsByTrade ? why.uses.repairsEnded(row.label) : why.uses.repairs(row.label)}
                    value={`${formatAsDollars(resolved.value)}${SAVINGS_COPY.repairsSuffix}`}
                    tag={resolved.source === 'input' ? 'typed' : 'working'}
                  />
                )
              })}
              {repairs.length > 0 && <WhyUsesRow portrait={portrait} label={why.uses.construction} value={why.uses.rate(String(CONSTRUCTION_GROWTH_RATE_PERCENT))} tag="working" />}
            </div>
          </section>
          <section data-why-section="method">
            <BlockEyebrow className={cn(EYEBROW, 'pt-4 pb-1.5')} style={EYEBROW_INK}>{why.heads.method}</BlockEyebrow>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {why.methodText}
              {lookAhead === 1 ? why.methodNow : why.methodYear(when, String(lookAhead))}
              {why.methodRates}
            </p>
          </section>
          <section data-why-section="math">
            <BlockEyebrow className={cn(EYEBROW, 'pt-4 pb-1.5')} style={EYEBROW_INK}>{why.heads.math}</BlockEyebrow>
            {block(1, first)}
            {lookAhead > 1 && block(lookAhead, then)}
          </section>
          {/* The FTC R-value Rule's line stands in for "Savings vary." once insulation is part of the build. */}
          <p data-why-disclosure className="pt-4 text-xs text-muted-foreground">
            {Object.values(picks).flat().some(scopeId => R_VALUE_SCOPES.includes(scopeId)) ? SAVINGS_COPY.disclosure.rValue : SAVINGS_COPY.disclosure.vary}
          </p>
        </div>
      </motion.div>
    </>
  )
}
