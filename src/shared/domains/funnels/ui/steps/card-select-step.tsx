import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { CARD_SELECT_SINGLE_COLUMN_THRESHOLD, FUNNEL_QUESTION_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { CARD_STAGGER_CONTAINER, CARD_STAGGER_ITEM } from '@/shared/domains/funnels/constants/funnel-motion'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
import { cn } from '@/shared/lib/utils'

/**
 * Card-select question. Layout is chosen by option count, identically across all
 * funnels (the rule lives here, not in any spec):
 *   • ≤ THRESHOLD options → 2-column card grid (vertical tiles, equal-height rows)
 *   • >  THRESHOLD options → single-column list of rows (leading thumbnail + label)
 * Both layouts share ONE selection language — `primary` border + tint. Picking
 * IS proceeding: tapping any option always sets the value and advances, whether
 * it's a first answer or a revisit reached via Back (re-tapping the current
 * selection also advances — tap = confirm + proceed). The shell's Next is hidden
 * for this step kind; the user never needs it.
 * see ../../../../../docs/superpowers/specs/2026-06-26-funnel-card-select-layout-system-design.md
 */
export function CardSelectStepView({ content, value, setValue, advance }: StepProps<CardSelectStep>) {
  const reduceMotion = useReducedMotion()
  const singleColumn = content.options.length > CARD_SELECT_SINGLE_COLUMN_THRESHOLD

  function handleSelect(optionId: string) {
    setValue(optionId)
    advance()
  }

  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6', FUNNEL_QUESTION_MAX_W)}>
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-foreground text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground">{content.subtitle}</p> : null}
      </div>
      <motion.div
        variants={reduceMotion ? undefined : CARD_STAGGER_CONTAINER}
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? false : 'visible'}
        className={cn(singleColumn ? 'flex flex-col gap-2 sm:gap-3' : 'grid auto-rows-fr grid-cols-2 gap-2 sm:gap-3')}
      >
        {content.options.map((option) => {
          const selected = value === option.id
          const asset = option.asset
          const selectionClass = selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'
          return singleColumn
            ? (
                <motion.button
                  key={option.id}
                  type="button"
                  variants={reduceMotion ? undefined : CARD_STAGGER_ITEM}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  onClick={() => handleSelect(option.id)}
                  className={cn('flex items-center gap-3 overflow-hidden rounded-lg border-2 p-2 text-left shadow-sm transition-colors touch-manipulation', selectionClass)}
                >
                  {asset
                    ? (
                        <div className="bg-muted/40 flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-md">
                          {asset.kind === 'icon' && OPTION_ICONS[asset.name]
                            ? (() => {
                                const Icon = OPTION_ICONS[asset.name]
                                return <Icon className="text-foreground size-7" />
                              })()
                            : null}
                          {asset.kind === 'image'
                            ? <Image src={asset.src} alt={asset.alt} width={600} height={282} sizes="96px" className="h-full w-full object-cover object-center" />
                            : null}
                        </div>
                      )
                    : null}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{option.label}</span>
                    {option.description ? <span className="text-muted-foreground text-sm">{option.description}</span> : null}
                  </div>
                </motion.button>
              )
            : (
                <motion.button
                  key={option.id}
                  type="button"
                  variants={reduceMotion ? undefined : CARD_STAGGER_ITEM}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  onClick={() => handleSelect(option.id)}
                  className={cn('flex flex-col items-center overflow-hidden rounded-lg border-2 text-center shadow-sm transition-colors touch-manipulation', selectionClass)}
                >
                  {asset
                    ? (
                        <div className="bg-muted/40 flex aspect-video w-full items-center justify-center">
                          {asset.kind === 'icon' && OPTION_ICONS[asset.name]
                            ? (() => {
                                const Icon = OPTION_ICONS[asset.name]
                                return <Icon className="text-foreground size-8 sm:size-10" />
                              })()
                            : null}
                          {asset.kind === 'image'
                            ? <Image src={asset.src} alt={asset.alt} width={600} height={282} sizes="(max-width: 640px) 45vw, 280px" className="h-full w-full object-cover object-center" />
                            : null}
                        </div>
                      )
                    : null}
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2">
                    <span className="block text-sm font-medium">{option.label}</span>
                    {option.description ? <span className="text-muted-foreground hidden text-sm sm:block">{option.description}</span> : null}
                  </div>
                </motion.button>
              )
        })}
      </motion.div>
    </div>
  )
}
