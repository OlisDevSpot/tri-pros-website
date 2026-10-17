'use client'

import { useEffect, useRef } from 'react'

import { proposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useActiveChapter } from '@/features/proposal-flow/contexts/active-chapter-context'
import { cn } from '@/shared/lib/utils'

interface Props {
  variant: 'rail' | 'tabs'
}

export function ChapterNav({ variant }: Props) {
  const { activeId, select } = useActiveChapter()
  const stripRef = useRef<HTMLOListElement>(null)

  // scrollIntoView would also move the page's vertical scroller; only the strip should move.
  useEffect(() => {
    const strip = stripRef.current
    const tab = strip?.querySelector<HTMLElement>('[aria-current]')
    if (variant !== 'tabs' || !strip || !tab) {
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const left = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2
    strip.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }, [activeId, variant])

  if (variant === 'rail') {
    return (
      <nav aria-label="Proposal chapters" className="sticky top-0 self-start py-10 pr-3 pl-6">
        <ol className="grid gap-0.5">
          {proposalSteps.map((step, i) => (
            <li key={step.accessor}>
              <button
                type="button"
                onClick={() => select(step.accessor)}
                aria-current={activeId === step.accessor ? 'true' : undefined}
                className={cn(
                  'flex w-full items-baseline gap-3 border-l-2 border-border-strong px-3 py-2 text-left text-sm leading-snug font-bold text-muted-foreground transition-colors hover:text-foreground pressed:text-foreground',
                  activeId === step.accessor && 'border-foreground text-foreground',
                )}
              >
                <span className="w-4 shrink-0 font-sans text-xs leading-none">{i + 1}</span>
                {step.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    )
  }

  return (
    <nav aria-label="Proposal chapters">
      <ol ref={stripRef} className="flex min-w-0 gap-0.5 overflow-x-auto px-1.5 scrollbar-none">
        {proposalSteps.map(step => (
          <li key={step.accessor} className="shrink-0">
            <button
              type="button"
              onClick={() => select(step.accessor)}
              aria-current={activeId === step.accessor ? 'true' : undefined}
              className={cn(
                'min-h-11 border-b-2 border-transparent px-2.75 text-sm font-bold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground pressed:text-foreground',
                activeId === step.accessor && 'border-foreground text-foreground',
              )}
            >
              {step.shortLabel}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
