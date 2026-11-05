'use client'

import type { BenefitSelection } from '@/features/trade-scenes/types'

import { ChevronLeftIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { BENEFIT_KIND_ICONS } from '@/features/trade-scenes/constants/benefit-kind-icons'
import { BENEFITS_RAIL } from '@/features/trade-scenes/constants/benefits-rail'
import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { R_VALUE_SCOPES } from '@/features/trade-scenes/constants/r-value-scopes'
import { CONTROLS_EASE } from '@/features/trade-scenes/constants/scene-layout'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { railGroups } from '@/features/trade-scenes/lib/rail-groups'
import { RailBenefit } from '@/features/trade-scenes/ui/components/benefits/rail-benefit'
import { Button } from '@/shared/components/ui/button'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'
import { BENEFIT_KINDS } from '@/shared/modules/construction/core/constants/benefit-kinds'

interface BenefitsRailProps {
  // Handed down rather than read, so the rail keeps drawing its selection while it closes.
  selection: BenefitSelection
  portrait: boolean
}

// What is picked in plain words, then its benefits under small subheads. Its content keeps its own width, so the text
// never reflows while the wrapper opens; a new pick fades the old content out before the new one comes in.
export function BenefitsRail({ selection, portrait }: BenefitsRailProps) {
  const { lines, picks, now } = useBenefitsFigures()
  const { select, openers } = useBenefits()
  const reduceMotion = useReducedMotion()
  const { header, title, count, savings, groups } = railGroups(lines, selection, now.saves)
  // The FTC R-value Rule's line stands in for "Savings vary." once insulation is part of the build.
  const disclosure = Object.values(picks).flat().some(scopeId => R_VALUE_SCOPES.includes(scopeId)) ? SAVINGS_COPY.disclosure.rValue : SAVINGS_COPY.disclosure.vary
  // Every Savings group closes with it: a system's Savings group, or each system's group under the Savings kind.
  const closesWithDisclosure = (id: string) => selection.type === 'system' ? id === 'savings' : selection.kind === 'savings'
  const close = () => {
    select(null)
    openers.selection.current!.focus()
  }

  return (
    <aside
      data-benefits-rail
      aria-label={header}
      style={portrait ? undefined : { width: BENEFITS_RAIL.width }}
      className={cn('flex h-full flex-col overflow-hidden rounded-[14px] border border-border bg-band', portrait && 'w-full shadow-2xl')}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={header}
          initial={reduceMotion ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0, transition: { duration: reduceMotion ? 0 : 0.18, ease: CONTROLS_EASE } }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.12, ease: CONTROLS_EASE } }}
          className="flex min-h-0 flex-1 flex-col px-3.5 pt-1.5"
        >
          <Button type="button" variant="ghost" size="sm" data-rail-back onClick={close} className="-ml-2 h-10 self-start px-2 font-bold text-primary">
            <ChevronLeftIcon aria-hidden />
            {BENEFITS_COPY.rail.back}
          </Button>
          <div data-rail-header className="shrink-0 border-b border-border pb-2">
            <h3 className="text-lg leading-tight font-bold">{title}</h3>
            <p className="pt-0.5 text-sm text-muted-foreground">
              {count}
              {savings !== null && (
                <>
                  {BENEFITS_COPY.rail.join}
                  <b className={cn('font-bold tabular-nums', toneClasses('success').text)}>{savings}</b>
                </>
              )}
            </p>
          </div>
          <div data-rail-list className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
            {groups.map((group) => {
              const kind = BENEFIT_KINDS.find(id => id === group.id)
              const Icon = kind && BENEFIT_KIND_ICONS[kind]
              return (
                <section key={group.id} data-rail-group={group.id} className="grid pt-2">
                  {selection.type !== 'dot' && (
                    <h4 className={cn(CONTROLS_CLASSES.capsLabel, 'inline-flex items-center gap-1.5 pt-1.5 pb-0.5')}>
                      {Icon && <Icon aria-hidden className="size-3.5 text-primary" />}
                      {group.label}
                    </h4>
                  )}
                  {group.lines.map(line => <RailBenefit key={`${line.from}:${line.title}`} line={line} />)}
                  {closesWithDisclosure(group.id) && <p data-rail-disclosure className="pt-1 pb-2 text-xs text-muted-foreground">{disclosure}</p>}
                </section>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}
