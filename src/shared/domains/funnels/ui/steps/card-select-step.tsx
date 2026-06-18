import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import Image from 'next/image'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
import { cn } from '@/shared/lib/utils'

export function CardSelectStepView({ step, content, value, isAnswered, setValue, advance }: StepProps<CardSelectStep>) {
  function handleSelect(optionId: string) {
    setValue(optionId)
    // Micro-commitment: a first answer advances immediately. On a revisit
    // (already answered, reached via Back), selecting only changes the value —
    // the shell's Next advances, so the user can review.
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.optionIds.map((optionId) => {
          const option = content.options[optionId]
          const selected = value === optionId
          return (
            <button
              key={optionId}
              type="button"
              onClick={() => handleSelect(optionId)}
              className={cn(
                'rounded-xl border-2 p-5 text-left transition-colors hover:border-primary/60',
                selected ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              {option?.asset?.kind === 'icon' && OPTION_ICONS[option.asset.name]
                ? (() => {
                    const Icon = OPTION_ICONS[option.asset.name]
                    return <Icon className="text-primary mb-2 size-6" />
                  })()
                : null}
              {option?.asset?.kind === 'image'
                ? <Image src={option.asset.src} alt={option.asset.alt} width={48} height={48} className="mb-2" />
                : null}
              <span className="block font-medium">{option?.label ?? optionId}</span>
              {option?.description
                ? <span className="text-muted-foreground mt-1 block text-sm">{option.description}</span>
                : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
