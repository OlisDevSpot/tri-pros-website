'use client'

import { MEETING_STEPS } from '@/features/meetings/constants/step-config'
import { cn } from '@/shared/lib/utils'

interface StepNavProps {
  currentStep: number
  onStepClick: (step: number) => void
}

export function StepNav({ currentStep, onStepClick }: StepNavProps) {
  return (
    <nav className="flex items-center gap-1">
      {MEETING_STEPS.map((step) => {
        const isActive = step.stepNumber === currentStep
        const isCompleted = step.stepNumber < currentStep

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.stepNumber)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all',
              isActive && 'bg-primary/10 text-primary',
              isCompleted && 'text-muted-foreground hover:text-foreground',
              !isActive && !isCompleted && 'text-muted-foreground/50 hover:text-muted-foreground',
            )}
            title={step.title}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                isActive && 'bg-primary text-primary-foreground',
                isCompleted && 'bg-muted-foreground/20 text-muted-foreground',
                !isActive && !isCompleted && 'bg-muted/50 text-muted-foreground/50',
              )}
            >
              {step.stepNumber}
            </span>
            <span className="hidden lg:inline">{step.shortLabel}</span>
          </button>
        )
      })}
    </nav>
  )
}
