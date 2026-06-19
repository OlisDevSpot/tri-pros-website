import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { Button } from '@/shared/components/ui/button'
import { CARD_STAGGER_CONTAINER, CARD_STAGGER_ITEM } from '@/shared/domains/funnels/constants/funnel-motion'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
import { cn } from '@/shared/lib/utils'

export function CardSelectStepView({ step, content, value, isAnswered, isFirst, setValue, advance }: StepProps<CardSelectStep>) {
  const reduceMotion = useReducedMotion()

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
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle
          ? <p className="text-muted-foreground mt-1">{content.subtitle}</p>
          : null}
      </div>
      <motion.div
        variants={reduceMotion ? undefined : CARD_STAGGER_CONTAINER}
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? false : 'visible'}
        className="grid grid-cols-2 gap-3 sm:gap-4"
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
                'flex flex-col items-center overflow-hidden rounded-xl border-2 text-center transition-colors touch-manipulation hover:border-primary/60',
                selected ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              {asset
                ? (
                    <div className="bg-muted/40 flex aspect-3/2 w-full items-center justify-center sm:aspect-4/3">
                      {asset.kind === 'icon' && OPTION_ICONS[asset.name]
                        ? (() => {
                            const Icon = OPTION_ICONS[asset.name]
                            return <Icon className="text-primary size-9 sm:size-12" />
                          })()
                        : null}
                      {asset.kind === 'image'
                        ? <Image src={asset.src} alt={asset.alt} width={320} height={240} className="h-full w-full object-cover" />
                        : null}
                    </div>
                  )
                : null}
              <div className="flex flex-col items-center gap-1 p-2 sm:p-3">
                <span className="block text-sm font-medium sm:text-base">{option?.label ?? optionId}</span>
                {option?.description
                  ? <span className="text-muted-foreground hidden text-sm sm:block">{option.description}</span>
                  : null}
              </div>
            </motion.button>
          )
        })}
      </motion.div>
      {isFirst && isAnswered
        ? (
            <Button size="lg" onClick={advance} className="self-center">
              Continue
              <ArrowRight className="size-4" />
            </Button>
          )
        : null}
    </div>
  )
}
