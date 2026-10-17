'use client'

import { useEffect, useRef } from 'react'

import { proposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useActiveSection } from '@/shared/hooks/use-active-section'
import { cn } from '@/shared/lib/utils'

interface Props {
  variant: 'rail' | 'tabs'
}

const ids = proposalSteps.map(step => step.accessor)

export function ChapterNav({ variant }: Props) {
  const { rootEl } = useScrollRoot()
  const { activeId: active, select } = useActiveSection(ids, { rootEl })
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
  }, [active, variant])

  if (variant === 'rail') {
    return (
      <nav aria-label="Proposal chapters" className="sticky top-0 self-start py-8 pl-6 pr-4">
        <ol className="flex flex-col gap-1">
          {proposalSteps.map((step, i) => (
            <li key={step.accessor}>
              <button
                type="button"
                onClick={() => select(step.accessor)}
                aria-current={active === step.accessor ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground pressed:text-foreground',
                  active === step.accessor && 'border-foreground text-foreground',
                )}
              >
                <span className="w-4 text-xs tabular-nums">{i + 1}</span>
                {step.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    )
  }

  return (
    <nav aria-label="Proposal chapters" className="surface sticky top-0 z-10 border-b border-border">
      <ol ref={stripRef} className="flex overflow-x-auto [scrollbar-width:none]">
        {proposalSteps.map(step => (
          <li key={step.accessor} className="shrink-0">
            <button
              type="button"
              onClick={() => select(step.accessor)}
              aria-current={active === step.accessor ? 'true' : undefined}
              className={cn(
                'min-h-11 whitespace-nowrap border-b-2 border-transparent px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground pressed:text-foreground',
                active === step.accessor && 'border-foreground text-foreground',
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
