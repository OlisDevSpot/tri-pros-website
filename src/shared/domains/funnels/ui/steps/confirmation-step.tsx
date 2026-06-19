'use client'

import type { ConfirmationStep, PiiAnswer, StepProps } from '@/shared/domains/funnels/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQueries, useQuery } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { contactInfo } from '@/shared/constants/company/contact-info'
import { PORTFOLIO_FALLBACK_IMAGES } from '@/shared/domains/funnels/constants/portfolio-fallback-images'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { toDialString } from '@/shared/lib/phone'
import { useTRPC } from '@/trpc/helpers'

const MAX_PAIRS = 3

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function ConfirmationStepView({ content, answers, ctx }: StepProps<ConfirmationStep>) {
  const trpc = useTRPC()
  const enrich = useEnrichLead()
  const firedRef = useRef(false)

  // Fire enrichment exactly once on mount, fire-and-forget.
  // Empty dep array = run-once-on-mount; firedRef is belt-and-suspenders
  // (fire exactly once on mount; never re-fire — do NOT remove the guard).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phone = contactInfo.find(info => info.accessor === 'phone')!.value

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

  // Fallback gallery when no before/after pairs resolve: a uniform 3-up grid of
  // project hero photos (padded with on-brand fallbacks so it's never empty),
  // in the SAME card language as the pairs grid — never the marketing bento.
  // `null` = still loading (show skeleton); a filled array = ready.
  const heroTiles = useMemo(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return null
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    const real = projects
      .filter((p): p is PortfolioProject & { heroImage: NonNullable<PortfolioProject['heroImage']> } =>
        p.heroImage !== null && p.scopeIds.some(id => scopeToTrade.get(id) === tradeId),
      )
      .map(p => ({ title: p.project.title, src: getOptimizedSrc(p.heroImage) }))
    const padded = [...real]
    for (let i = 0; padded.length < MAX_PAIRS; i++) {
      const fb = PORTFOLIO_FALLBACK_IMAGES[i % PORTFOLIO_FALLBACK_IMAGES.length]
      padded.push({ title: fb.alt, src: fb.src })
    }
    return padded.slice(0, MAX_PAIRS)
  }, [scopesQ.data, projectsQ.data, tradeId])

  return (
    <div className="flex flex-col items-center gap-8 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
          <CircleCheck className="size-8" aria-hidden />
        </span>
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground max-w-prose">{content.subtitle}</p> : null}
      </div>

      {content.whatNext && content.whatNext.length > 0
        ? (
            <ol className="border-border bg-card flex w-full flex-col gap-3 rounded-2xl border p-5 text-left text-sm">
              {content.whatNext.map((line, i) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{i + 1}</span>
                  <span className="text-foreground">{line}</span>
                </li>
              ))}
            </ol>
          )
        : null}

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-14 flex-1 text-base">
          <a href={`tel:${toDialString(phone)}`}>{`Call ${phone}`}</a>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-14 flex-1 text-base">
          {/* eslint-disable-next-line node/prefer-global/process */}
          <a href={process.env.NEXT_PUBLIC_BASE_URL ?? '/'} target="_blank" rel="noopener noreferrer">See our work</a>
        </Button>
      </div>

      {content.scarcityLine
        ? <p className="text-muted-foreground text-sm font-medium">{content.scarcityLine}</p>
        : null}

      <section className="flex w-full flex-col gap-4">
        <h3 className="text-foreground text-lg font-semibold">Recent Tri Pros work</h3>
        {pairs.length > 0
          ? (
              <div className="grid w-full gap-4 sm:grid-cols-3">
                {pairs.map(pair => (
                  <figure key={pair.title} className="border-border overflow-hidden rounded-2xl border">
                    <div className="grid grid-cols-2">
                      <div className="relative aspect-square">
                        <Image src={pair.before} alt={`${pair.title} — before`} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
                        <span className="bg-background/80 text-foreground absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium">Before</span>
                      </div>
                      <div className="relative aspect-square">
                        <Image src={pair.after} alt={`${pair.title} — after`} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
                        <span className="bg-foreground/85 text-background absolute right-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium">After</span>
                      </div>
                    </div>
                  </figure>
                ))}
              </div>
            )
          : heroTiles === null
            ? <div className="bg-muted/40 h-44 w-full animate-pulse rounded-2xl" />
            : (
                <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
                  {heroTiles.map((tile, i) => (
                    <figure key={`${tile.src}-${i}`} className="border-border relative aspect-square overflow-hidden rounded-2xl border">
                      <Image src={tile.src} alt={tile.title} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
                    </figure>
                  ))}
                </div>
              )}
      </section>
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
