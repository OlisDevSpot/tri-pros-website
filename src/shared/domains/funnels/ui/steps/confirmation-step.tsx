'use client'

import type { ConfirmationStep, FunnelContext, PiiAnswer, StepProps } from '@/shared/domains/funnels/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQueries, useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useEffect, useMemo, useRef } from 'react'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'
import { PortfolioBlock } from '@/shared/domains/funnels/ui/blocks/portfolio-block'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { useTRPC } from '@/trpc/helpers'

const MAX_PAIRS = 3

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function ConfirmationStepView({ content, answers, ctx }: StepProps<ConfirmationStep>) {
  const trpc = useTRPC()
  const enrich = useEnrichLead()
  const firedRef = useRef(false)

  // Fire enrichment exactly once on mount, from the typed answer slots.
  useEffect(() => {
    if (firedRef.current) {
      return
    }
    firedRef.current = true
    const leadId = (answers.pii as PiiAnswer | null)?.leadId
    if (!leadId) {
      return
    }
    enrich({
      leadId,
      enrichment: {
        homeType: asString(answers.homeType),
        age: asString(answers.age),
        scope: asString(answers.scope),
        timeline: asString(answers.timeline),
      },
    })
  }, [answers, enrich])

  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())
  const tradeId = TRADE_BY_SLUG[ctx.slug]

  // Top kitchen accessors (same trade-filter the bento block uses).
  const accessors = useMemo(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return []
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    return projects
      .filter((p: PortfolioProject) => p.scopeIds.some(id => scopeToTrade.get(id) === tradeId))
      .map((p: PortfolioProject) => p.project.accessor)
      .slice(0, MAX_PAIRS)
  }, [scopesQ.data, projectsQ.data, tradeId])

  const detailQs = useQueries({
    queries: accessors.map(accessor => trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor })),
  })

  // Pairs where BOTH before and after media exist.
  const pairs = useMemo(() => {
    return detailQs
      .map((q) => {
        const before = q.data?.media.before[0]
        const after = q.data?.media.after[0]
        if (!before || !after) {
          return null
        }
        return { title: q.data!.project.title, before: getOptimizedSrc(before), after: getOptimizedSrc(after) }
      })
      .filter((p): p is { title: string, before: string, after: string } => p !== null)
  }, [detailQs])

  return (
    <div className="flex flex-col items-center gap-8 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground max-w-prose">{content.subtitle}</p> : null}
      </div>

      {content.whatNext && content.whatNext.length > 0
        ? (
            <ol className="border-border bg-card flex w-full max-w-md flex-col gap-3 rounded-2xl border p-5 text-left text-sm">
              {content.whatNext.map((line, i) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{i + 1}</span>
                  <span className="text-foreground">{line}</span>
                </li>
              ))}
            </ol>
          )
        : null}

      {pairs.length > 0
        ? (
            <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
              {pairs.map(pair => (
                <figure key={pair.title} className="border-border overflow-hidden rounded-2xl border">
                  <div className="grid grid-cols-2">
                    <div className="relative aspect-square">
                      <Image src={pair.before} alt={`${pair.title} — before`} fill sizes="33vw" className="object-cover" />
                      <span className="bg-background/80 text-foreground absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium">Before</span>
                    </div>
                    <div className="relative aspect-square">
                      <Image src={pair.after} alt={`${pair.title} — after`} fill sizes="33vw" className="object-cover" />
                      <span className="bg-primary text-primary-foreground absolute right-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium">After</span>
                    </div>
                  </div>
                </figure>
              ))}
            </div>
          )
        : <PortfolioBlock content={{ title: 'Recent Tri Pros work' }} ctx={ctx} />}

      {content.scarcityLine
        ? <p className="text-muted-foreground text-sm font-medium">{content.scarcityLine}</p>
        : null}
    </div>
  )
}

/** Importable prebuilt step (Seam A). Terminal — no advance. */
export const CONFIRMATION_STEP: ConfirmationStep = {
  id: 'confirmation',
  kind: 'confirmation',
  content: {
    title: 'You\'re on the Showcase list.',
    subtitle: 'We review every home for fit and call within 24 hours to confirm your spot.',
    whatNext: [
      'We review your home against this round\'s Showcase criteria.',
      'A Tri Pros specialist calls within 24 hours to confirm fit.',
      'If selected, we schedule your in-home design visit.',
    ],
    scarcityLine: 'Spots are limited — selected homes are confirmed first-come.',
  },
}
