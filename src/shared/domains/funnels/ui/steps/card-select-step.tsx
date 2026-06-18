import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function CardSelectStepView({ step, content, value, onChange, onAdvance, onBack, isFirst }: StepProps<CardSelectStep>) {
  function handleSelect(optionId: string) {
    onChange(optionId)
    // Micro-commitment: a tap advances immediately.
    onAdvance()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content?.title ?? ''}</h2>
        {content?.subtitle
          ? <p className="text-muted-foreground mt-1">{content.subtitle}</p>
          : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.optionIds.map((optionId) => {
          const option = content?.options?.[optionId]
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
              <span className="block font-medium">{option?.label ?? optionId}</span>
              {option?.description
                ? <span className="text-muted-foreground mt-1 block text-sm">{option.description}</span>
                : null}
            </button>
          )
        })}
      </div>
      {!isFirst
        ? (
            <div className="flex justify-start">
              <Button variant="ghost" onClick={onBack}>← Back</Button>
            </div>
          )
        : null}
    </div>
  )
}
