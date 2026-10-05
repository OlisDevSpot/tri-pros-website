'use client'

import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { MEETING_STEPS } from '@/features/meeting-flow/constants/step-config'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface StepTabsProps {
  currentStep: number
  onStepClick: (step: number) => void
}

/**
 * Step tabs for the top bar. The short label shows only while the top bar's
 * container (`@container/topbar`) is at least 81.25rem (1300px) wide; below that
 * the numbered roundel carries the tab. The full title is always in the accessible
 * name (visually hidden) and the tooltip, so the visible label stays inside the name.
 * Each tab is at least 44px wide; seven of them cannot sit beside the back link and
 * the hamburger in a top bar under 42rem (phones, or md tablets with the sidebar
 * expanded), so the strip is hidden there and the capsule carries step navigation.
 * The active tab is the top bar's one primary-colour moment.
 */
export function StepTabs({ currentStep, onStepClick }: StepTabsProps) {
  return (
    <nav aria-label={SHELL_COPY.stepsNavLabel} className="hidden items-center gap-0.5 @2xl/topbar:flex">
      {MEETING_STEPS.map((step) => {
        const isActive = step.stepNumber === currentStep
        const isDone = step.stepNumber < currentStep

        return (
          <Button
            key={step.id}
            aria-current={isActive ? 'step' : undefined}
            aria-keyshortcuts={String(step.stepNumber)}
            className={cn(
              'h-11 min-w-11 gap-2 rounded-md px-2 text-xs font-semibold motion-safe:transition-colors',
              isActive && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              isDone && 'text-foreground hover:bg-muted hover:text-foreground',
              !isActive && !isDone && 'text-muted-foreground/70 hover:bg-muted hover:text-foreground',
            )}
            size="sm"
            title={step.title}
            variant="ghost"
            onClick={() => onStepClick(step.stepNumber)}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                isActive && 'bg-primary text-primary-foreground',
                isDone && 'bg-foreground/10 text-foreground',
                !isActive && !isDone && 'bg-muted text-muted-foreground',
              )}
            >
              {step.stepNumber}
            </span>
            <span className="hidden @[81.25rem]/topbar:inline">{step.shortLabel}</span>
            <span className="sr-only">{step.title}</span>
          </Button>
        )
      })}
    </nav>
  )
}
