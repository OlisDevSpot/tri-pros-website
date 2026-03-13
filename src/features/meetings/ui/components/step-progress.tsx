'use client'

import { CheckIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface StepProgressProps {
  className?: string
  currentStep: number
  onStepClick?: (step: number) => void
  stepCount: number
  stepLabels?: string[]
  stepTitles?: string[]
}

export function StepProgress({ className, currentStep, onStepClick, stepCount, stepLabels, stepTitles }: StepProgressProps) {
  return (
    <div className={cn('flex items-start gap-0', className)}>
      {Array.from({ length: stepCount }, (_, i) => {
        const stepNumber = i + 1
        const isCompleted = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep
        const label = stepLabels?.[i]

        return (
          <div key={stepNumber} className="flex items-start">
            {/* Step node: circle + optional label stacked vertically */}
            <div className="flex flex-col items-center gap-1">
              <Button
                className={cn(
                  'relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 p-0 text-sm font-bold transition-all',
                  onStepClick && 'cursor-pointer hover:scale-110 active:scale-95',
                  !onStepClick && 'cursor-default',
                  isCompleted && 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  isCurrent && 'border-primary bg-primary/20 text-primary hover:bg-primary/20',
                  !isCompleted && !isCurrent && 'border-muted-foreground/30 bg-transparent text-muted-foreground/50 hover:bg-transparent',
                )}
                disabled={!onStepClick}
                title={stepTitles?.[i]}
                type="button"
                variant="ghost"
                onClick={() => onStepClick?.(stepNumber)}
              >
                {isCompleted
                  ? (
                      <CheckIcon className="size-4" />
                    )
                  : (
                      <span>{stepNumber}</span>
                    )}
              </Button>
              {label && (
                <span
                  className={cn(
                    'text-[9px] font-semibold uppercase tracking-wide',
                    isCurrent && 'text-primary',
                    isCompleted && 'text-primary/70',
                    !isCompleted && !isCurrent && 'text-muted-foreground/40',
                  )}
                >
                  {label}
                </span>
              )}
            </div>

            {/* Connector line — mt-4 aligns to circle midpoint (size-8 = 32px) */}
            {i < stepCount - 1 && (
              <div
                className={cn(
                  'mt-4 h-0.5 w-8 transition-all',
                  stepNumber < currentStep ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
