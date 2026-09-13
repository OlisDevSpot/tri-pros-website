'use client'

import type { MeetingStepLayout } from '@/features/meeting-flow/types'
import { ArrowLeftIcon, ArrowRightIcon, MinimizeIcon, PresentationIcon } from 'lucide-react'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/lib/utils'

interface StepCapsuleProps {
  currentStep: number
  stepTitle: string
  /** Dark glass over the presentation ground, light glass over page steps. */
  tone: MeetingStepLayout
  presenting: boolean
  onPrev: () => void
  onNext: () => void
  onTogglePresent: () => void
}

/**
 * Floating Previous / counter / Next / Present control, centred at the bottom of
 * the stage. Always visible; no idle fade (spec §2). The visually hidden live
 * region announces the step after each change.
 */
export function StepCapsule({ currentStep, stepTitle, tone, presenting, onPrev, onNext, onTogglePresent }: StepCapsuleProps) {
  const presentLabel = presenting ? SHELL_COPY.exitPresent : SHELL_COPY.present

  return (
    <div
      className={cn(
        'absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex h-12 -translate-x-1/2 items-center gap-0.5 rounded-full border p-0.5 shadow-lg backdrop-blur-md',
        tone === 'presentation'
          ? 'border-white/15 bg-(--presentation-ground)/70 text-white'
          : 'border-border bg-background/80 text-foreground',
      )}
    >
      <Button
        aria-keyshortcuts={KEY_SHORTCUTS.prevStep}
        className="size-11 rounded-full"
        disabled={currentStep === 1}
        size="icon"
        title={SHELL_COPY.prevStep}
        variant="ghost"
        onClick={onPrev}
      >
        <ArrowLeftIcon className="size-5" />
        <span className="sr-only">{SHELL_COPY.prevStep}</span>
      </Button>

      <span className="min-w-[3.25rem] text-center text-xs font-semibold tabular-nums">
        {`${currentStep} / ${TOTAL_STEPS}`}
      </span>
      <span aria-atomic="true" aria-live="polite" className="sr-only">
        {`Step ${currentStep} of ${TOTAL_STEPS}: ${stepTitle}`}
      </span>

      <Button
        aria-keyshortcuts={KEY_SHORTCUTS.nextStep}
        className="size-11 rounded-full"
        disabled={currentStep === TOTAL_STEPS}
        size="icon"
        title={SHELL_COPY.nextStep}
        variant="ghost"
        onClick={onNext}
      >
        <ArrowRightIcon className="size-5" />
        <span className="sr-only">{SHELL_COPY.nextStep}</span>
      </Button>

      <Separator className="mx-0.5 data-[orientation=vertical]:h-6" orientation="vertical" />

      <Button
        aria-keyshortcuts={KEY_SHORTCUTS.present}
        aria-pressed={presenting}
        className="size-11 rounded-full"
        size="icon"
        title={presentLabel}
        variant="ghost"
        onClick={onTogglePresent}
      >
        {presenting ? <MinimizeIcon className="size-5" /> : <PresentationIcon className="size-5" />}
        <span className="sr-only">{presentLabel}</span>
      </Button>
    </div>
  )
}
