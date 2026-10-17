'use client'

import type { NextStepState } from '@/features/proposal-flow/lib/derive-next-steps'

import { CheckIcon } from 'lucide-react'
import { useMemo } from 'react'

import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { RevealGroup } from '@/shared/components/reveal/reveal-group'
import { RevealItem } from '@/shared/components/reveal/reveal-item'
import { cn } from '@/shared/lib/utils'

interface Props {
  states: NextStepState[]
  repsLine: string
}

export function NextStepsTimeline({ states, repsLine }: Props) {
  const { rootEl } = useScrollRoot()
  const rootRef = useMemo(() => ({ current: rootEl }), [rootEl])
  const steps = [
    { title: 'Review your proposal', body: 'Take your time; it’s saved here.' },
    { title: 'Tell us you’re ready', body: repsLine },
    { title: 'Sign your agreement', body: 'An email from Zoho Sign with your signing link.' },
    { title: 'Project kickoff', body: 'We schedule your start date with you.' },
  ]

  return (
    <RevealGroup root={rootRef} role="list" className="grid gap-0 @min-[800px]/proposal:grid-cols-4 @min-[800px]/proposal:gap-3">
      {steps.map((step, i) => {
        const state = states[i] ?? 'upcoming'
        return (
          <RevealItem
            role="listitem"
            key={step.title}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'relative grid content-start grid-cols-[34px_minmax(0,1fr)] gap-3 pb-4.5 last:pb-0 @min-[800px]/proposal:grid-cols-1 @min-[800px]/proposal:pb-0',
              'not-last:before:absolute not-last:before:top-8.5 not-last:before:bottom-0 not-last:before:left-4 not-last:before:w-0.5 not-last:before:bg-current not-last:before:opacity-20 not-last:before:content-[""]',
              '@min-[800px]/proposal:not-last:before:top-4 @min-[800px]/proposal:not-last:before:right-[-6px] @min-[800px]/proposal:not-last:before:bottom-auto @min-[800px]/proposal:not-last:before:left-10 @min-[800px]/proposal:not-last:before:h-0.5 @min-[800px]/proposal:not-last:before:w-auto',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'relative z-1 grid size-8.5 place-items-center rounded-full border-2 border-current font-sans text-sm leading-none font-bold',
                state === 'done' && 'border-(--presentation-accent) bg-(--presentation-accent) text-(--presentation-ground)',
                state === 'current' && 'border-(--presentation-accent) text-(--presentation-accent)',
                state === 'upcoming' && 'opacity-60',
              )}
            >
              {state === 'done' ? <CheckIcon className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className={cn('grid content-start gap-0.5', state === 'upcoming' && 'opacity-80')}>
              <b className="font-sans text-base leading-snug font-semibold">{step.title}</b>
              <p className="text-sm text-on-media-muted">{step.body}</p>
            </div>
          </RevealItem>
        )
      })}
    </RevealGroup>
  )
}
