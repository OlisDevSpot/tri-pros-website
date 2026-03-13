'use client'

import type { JsonbSection } from '@/features/meetings/types'
import type { Meeting } from '@/shared/db/schema'
import { AnimatePresence, motion } from 'motion/react'
import { INTAKE_STEPS } from '@/features/meetings/constants/intake-steps'
import { stepCompletionCount } from '@/features/meetings/lib/step-completion'
import { FieldRenderer } from '@/features/meetings/ui/components/field-renderer'
import { StepProgress } from '@/features/meetings/ui/components/step-progress'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/lib/utils'

interface MeetingIntakeViewProps {
  currentStep: number
  meeting: Meeting
  onCompleteIntake: () => void
  onFieldSave: (jsonbKey: JsonbSection, fieldId: string, value: string | number) => void
  onStepChange: (step: number) => void
}

export function MeetingIntakeView({
  currentStep,
  meeting,
  onCompleteIntake,
  onFieldSave,
  onStepChange,
}: MeetingIntakeViewProps) {
  const stepCount = INTAKE_STEPS.length
  const stepIndex = Math.min(Math.max(currentStep - 1, 0), stepCount - 1)
  const step = INTAKE_STEPS[stepIndex]!

  const filledCount = stepCompletionCount(step, meeting)
  const totalFields = step.fields.length

  function handleNext() {
    if (currentStep < stepCount) {
      onStepChange(currentStep + 1)
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      onStepChange(currentStep - 1)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Step progress */}
      <div className="shrink-0 px-4 py-3 md:px-6">
        <StepProgress
          currentStep={currentStep}
          onStepClick={onStepChange}
          stepCount={stepCount}
          stepLabels={INTAKE_STEPS.map(s => s.title.split(' ')[0]!)}
          stepTitles={INTAKE_STEPS.map(s => s.title)}
        />
      </div>

      <Separator className="shrink-0" />

      {/* Step content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            initial={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {`Step ${currentStep} of ${stepCount}`}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">{step.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs text-muted-foreground">
                  {filledCount}
                  {' / '}
                  {totalFields}
                  {' filled'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {step.fields.map(field => (
                <div
                  key={field.id}
                  className={cn(
                    field.type === 'rating' && 'sm:col-span-2',
                    field.options && field.options.length > 6 && 'sm:col-span-2',
                  )}
                >
                  <FieldRenderer field={field} meeting={meeting} onSave={onFieldSave} />
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <Separator className="shrink-0" />

      {/* Footer navigation */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 md:px-6">
        <Button
          className="gap-2"
          disabled={currentStep === 1}
          size="sm"
          variant="outline"
          onClick={handlePrev}
        >
          ← Previous
        </Button>

        {currentStep < stepCount
          ? (
              <Button className="gap-2" size="sm" onClick={handleNext}>
                Next →
              </Button>
            )
          : (
              <Button size="sm" onClick={onCompleteIntake}>
                Run Meeting →
              </Button>
            )}
      </div>
    </div>
  )
}
