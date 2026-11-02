'use client'

import type { SceneChangeSlot, TradeSceneInputs } from '@/features/trade-scenes/types'

import { CheckIcon, InfoIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY, SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { climateDefaultBill } from '@/features/trade-scenes/lib/climate-default-bill'
import { UnitMoneyField } from '@/features/trade-scenes/ui/components/fields/unit-money-field'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface ModifyResultRowProps {
  slot: SceneChangeSlot
  // The value the query picked out, if one.
  hit: string | null
  // The top row an Enter can apply.
  lead: boolean
  // Counts up each time this row's change is applied, replaying its flash.
  flash: number
  onApply: (value: string) => void
  // Enter in a bill's field: the bill is already written, so the field hands back to the search.
  onBillEntered: () => void
}

export function ModifyResultRow({ slot, hit, lead, flash, onApply, onBillEntered }: ModifyResultRowProps) {
  const { shape } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const climate = useSceneInputs((state: TradeSceneInputs) => state.climate)
  const bills = useSceneInputs((state: TradeSceneInputs) => state.bills)
  const applyChange = useApplySceneChange()
  const attention = toneClasses('attention')
  // Enter sets the hit only where it changes something.
  const target = hit !== slot.current ? hit : null
  // A bill always has one in force: typed, or its climate's default.
  const missing = slot.current === null && slot.bill === null
  const current = slot.bill !== null
    ? `${formatAsDollars(Number(slot.current))}${SAVINGS_COPY.billSuffix}`
    : slot.options.find(option => option.value === slot.current)?.label ?? CONTROLS_COPY.facts.missing

  return (
    <div data-result-row={slot.id} className="relative grid gap-2 border-b border-border py-2.5 last:border-b-0">
      {flash > 0 && !reduceMotion && (
        <motion.span
          key={flash}
          data-flash={flash}
          aria-hidden
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 0] }}
          transition={{ duration: 1.1, times: [0, 0.35, 1], ease: 'easeOut' }}
          // Under the row's text: the body's scroll mask makes it a layer of its own.
          className={cn('pointer-events-none absolute inset-0 -z-10', toneClasses('success').wash)}
        />
      )}
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn(CONTROLS_CLASSES.tag, 'shrink-0 px-1.75 py-px', slot.group === 'proposed' && 'border-primary/45 text-primary')}>
          {CONTROLS_COPY.modify.groupTags[slot.group]}
        </span>
        <span className="min-w-0 truncate text-sm font-bold">{slot.name}</span>
        {/* No keyboard on a phone. */}
        {lead && target !== null && shape !== 'portrait' && (
          <kbd data-enter-mark className="shrink-0 rounded-[5px] bg-muted px-1.5 py-px font-sans text-xs font-bold text-muted-foreground">
            {CONTROLS_COPY.modify.enter}
          </kbd>
        )}
        {slot.unavailable === null && (
          <span data-result-current className={cn('ml-auto shrink-0 text-sm whitespace-nowrap', missing ? cn(attention.text, 'font-bold') : 'text-muted-foreground')}>
            {current}
          </span>
        )}
      </div>
      {slot.bill !== null
        ? (
            <UnitMoneyField
              compact
              aria-label={slot.name}
              value={bills[slot.bill].now}
              placeholder={formatAsDollars(climateDefaultBill(climate, slot.bill))}
              unit={SAVINGS_COPY.billSuffix}
              onChange={now => applyChange(slot.change(now === null ? '' : String(now)))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onBillEntered()
                }
              }}
            />
          )
        : slot.unavailable !== null
          ? (
              <p data-result-hint className="flex items-center gap-1.5 text-xs text-pretty text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
                <InfoIcon aria-hidden />
                {slot.unavailable}
              </p>
            )
          : (
              <div className="flex flex-wrap gap-1">
                {slot.options.map((option) => {
                  const isCurrent = option.value === slot.current
                  const isTarget = option.value === target
                  return (
                    <button
                      key={option.value}
                      type="button"
                      data-hit={isTarget || undefined}
                      aria-pressed={isCurrent}
                      onClick={() => onApply(option.value)}
                      className={cn(CONTROLS_CLASSES.option, isCurrent && CONTROLS_CLASSES.optionCurrent, isTarget && CONTROLS_CLASSES.optionHit)}
                    >
                      {isCurrent && <CheckIcon aria-hidden />}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}
    </div>
  )
}
