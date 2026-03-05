'use client'

import { CheckIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface StepProgressProps {
  className?: string
  currentStep: number
  stepCount: number
  stepTitles?: string[]
}

export function StepProgress({ className, currentStep, stepCount, stepTitles }: StepProgressProps) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {Array.from({ length: stepCount }, (_, i) => {
        const stepNumber = i + 1
        const isCompleted = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep

        return (
          <div key={stepNumber} className="flex items-center">
            {/* Step circle */}
            <div
              title={stepTitles?.[i]}
              className={cn(
                'relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                isCompleted && 'border-primary bg-primary text-primary-foreground',
                isCurrent && 'border-primary bg-primary/20 text-primary',
                !isCompleted && !isCurrent && 'border-muted-foreground/30 text-muted-foreground/50',
              )}
            >
              {isCompleted
                ? (
                    <CheckIcon className="size-4" />
                  )
                : (
                    <span>{stepNumber}</span>
                  )}
            </div>

            {/* Connector line */}
            {i < stepCount - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 transition-all',
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
