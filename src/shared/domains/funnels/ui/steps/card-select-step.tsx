import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import { ArrowRight, Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { Button } from '@/shared/components/ui/button'
import { FUNNEL_QUESTION_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { CARD_STAGGER_CONTAINER, CARD_STAGGER_ITEM } from '@/shared/domains/funnels/constants/funnel-motion'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
import { cn } from '@/shared/lib/utils'

/**
 * Card-select question — a grid of tappable option tiles.
 *
 * The FIRST question (`isFirst`) renders as the funnel's one DARK MOMENT: a
 * brand-blue→navy "spotlight" panel (`--q1-*` tokens) with glass tiles, so the
 * bright hero hands off into it and the eye lands on the section to act on.
 * Every later card-select stays on the light theme. All colors are tokens.
 */
export function CardSelectStepView({ step, content, value, isAnswered, isFirst, setValue, advance }: StepProps<CardSelectStep>) {
  const reduceMotion = useReducedMotion()
  const spotlight = isFirst

  function handleSelect(optionId: string) {
    setValue(optionId)
    // Micro-commitment: a first answer advances immediately. On a revisit
    // (already answered, reached via Back) selecting only changes the value;
    // the Continue button (landing) or shell Next (focused) advances.
    if (!isAnswered) {
      advance()
    }
  }

  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col',
        FUNNEL_QUESTION_MAX_W,
        spotlight
          ? 'gap-5 rounded-2xl bg-linear-to-b from-(--q1-from) to-(--q1-to) p-5 shadow-(--shadow-hero) ring-1 ring-white/10 sm:p-6'
          : 'gap-6',
      )}
    >
      <div className={cn('flex flex-col text-center', spotlight ? 'gap-1.5' : 'gap-1')}>
        {spotlight
          ? <span className="text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">Start here</span>
          : null}
        <h2 className={cn('text-2xl font-semibold', spotlight ? 'text-white' : 'text-foreground')}>{content.title}</h2>
        {content.subtitle
          ? <p className={spotlight ? 'text-white/70' : 'text-muted-foreground'}>{content.subtitle}</p>
          : null}
      </div>
      <motion.div
        variants={reduceMotion ? undefined : CARD_STAGGER_CONTAINER}
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? false : 'visible'}
        className="grid grid-cols-2 gap-2 sm:gap-3"
      >
        {step.optionIds.map((optionId) => {
          const option = content.options[optionId]
          const selected = value === optionId
          const asset = option?.asset
          return (
            <motion.button
              key={optionId}
              type="button"
              variants={reduceMotion ? undefined : CARD_STAGGER_ITEM}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              onClick={() => handleSelect(optionId)}
              className={cn(
                'flex flex-col items-center overflow-hidden rounded-lg border-2 text-center shadow-sm transition-colors touch-manipulation',
                spotlight
                  ? (selected ? 'border-(--q1-ring) bg-(--q1-tile-selected)' : 'border-white/15 bg-(--q1-tile) backdrop-blur-md hover:border-white/40')
                  : (selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'),
              )}
            >
              {asset
                ? (
                    <div className={cn('flex aspect-video w-full items-center justify-center', spotlight ? 'bg-black/15' : 'bg-muted/40')}>
                      {asset.kind === 'icon' && OPTION_ICONS[asset.name]
                        ? (() => {
                            const Icon = OPTION_ICONS[asset.name]
                            return <Icon className={cn('size-8 sm:size-10', spotlight ? 'text-white/90' : 'text-foreground')} />
                          })()
                        : null}
                      {asset.kind === 'image'
                        ? <Image src={asset.src} alt={asset.alt} width={600} height={282} sizes="(max-width: 640px) 45vw, 280px" className="h-full w-full object-cover object-center" />
                        : null}
                    </div>
                  )
                : null}
              <div className="flex flex-col items-center gap-1 p-2">
                <span className={cn('block text-sm font-medium', spotlight && 'text-white')}>{option?.label ?? optionId}</span>
                {option?.description
                  ? <span className={cn('hidden text-sm sm:block', spotlight ? 'text-white/70' : 'text-muted-foreground')}>{option.description}</span>
                  : null}
              </div>
            </motion.button>
          )
        })}
      </motion.div>
      {isFirst && isAnswered
        ? (
            <Button size="lg" onClick={advance} className="self-center bg-white text-(--q1-to) hover:bg-white/90">
              Continue
              <ArrowRight className="size-4" />
            </Button>
          )
        : null}
      {spotlight && !isAnswered
        ? (
            <p className="flex items-center justify-center gap-1.5 text-sm text-white/65">
              <Check className="size-3.5" aria-hidden="true" />
              Tap any option to begin — it only takes 60 seconds
            </p>
          )
        : null}
    </div>
  )
}
