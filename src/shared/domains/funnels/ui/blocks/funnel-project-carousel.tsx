'use client'

import type { CarouselApi } from '@/shared/components/ui/carousel'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useCallback, useMemo, useState } from 'react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/shared/components/ui/carousel'
import { ROOTS } from '@/shared/config/roots'
import { PORTFOLIO_FALLBACK_IMAGES } from '@/shared/domains/funnels/constants/portfolio-fallback-images'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { mainSiteUrl } from '@/shared/lib/main-site-url'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

const MAX_SLIDES = 8
const MIN_SLIDES = 3

interface Slide {
  title: string
  src: string
  href: string | null
}

/**
 * Funnel-local "finished kitchens" peek carousel for the confirmation step.
 * Mirrors the portfolio PhaseCarousel's peek feel using only shared primitives
 * (the funnel must not import from features/). Shows real trade-filtered
 * projects' hero photos; real slides link out to the full project story in a
 * new tab. Padded with on-brand fallbacks so it's never empty; `null` while the
 * queries load → skeleton.
 */
export function FunnelProjectCarousel({ slug }: { slug: string }) {
  const trpc = useTRPC()
  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())
  const tradeId = TRADE_BY_SLUG[slug as FunnelSlug]

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const handleSetApi = useCallback((newApi: CarouselApi) => {
    setApi(newApi)
    if (newApi) {
      newApi.on('select', () => setCurrent(newApi.selectedScrollSnap()))
    }
  }, [])

  const slides = useMemo<Slide[] | null>(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return null
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    const real: Slide[] = projects
      .filter((p): p is PortfolioProject & { heroImage: NonNullable<PortfolioProject['heroImage']> } =>
        p.heroImage !== null && p.scopeIds.some(id => scopeToTrade.get(id) === tradeId),
      )
      .slice(0, MAX_SLIDES)
      .map(p => ({ title: p.project.title, src: getOptimizedSrc(p.heroImage), href: mainSiteUrl(ROOTS.landing.portfolioProject(p.project.accessor)) }))
    const padded = [...real]
    for (let i = 0; padded.length < MIN_SLIDES; i++) {
      const fb = PORTFOLIO_FALLBACK_IMAGES[i % PORTFOLIO_FALLBACK_IMAGES.length]
      padded.push({ title: fb.alt, src: fb.src, href: null })
    }
    return padded
  }, [scopesQ.data, projectsQ.data, tradeId])

  if (slides === null) {
    return <div className="bg-muted/40 h-56 w-full animate-pulse rounded-2xl" />
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Carousel setApi={handleSetApi} opts={{ align: 'start', loop: slides.length > 1 }} className="w-full">
        <CarouselContent className="-ml-3">
          {slides.map((slide, i) => (
            <CarouselItem
              key={`${slide.src}-${i}`}
              className={cn('pl-3', slides.length === 1 ? 'basis-full' : 'basis-[85%] sm:basis-[70%] md:basis-[55%]')}
            >
              {slide.href
                ? (
                    <a
                      href={slide.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-video w-full overflow-hidden rounded-xl shadow-lg"
                    >
                      <Image src={slide.src} alt={slide.title} fill sizes="(max-width: 640px) 85vw, (max-width: 768px) 70vw, 55vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    </a>
                  )
                : (
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-lg">
                      <Image src={slide.src} alt={slide.title} fill sizes="(max-width: 640px) 85vw, (max-width: 768px) 70vw, 55vw" className="object-cover" />
                    </div>
                  )}
            </CarouselItem>
          ))}
        </CarouselContent>
        {slides.length > 1
          ? (
              <>
                <CarouselPrevious className="bg-background/80 -left-3 backdrop-blur-sm md:-left-5" />
                <CarouselNext className="bg-background/80 -right-3 backdrop-blur-sm md:-right-5" />
              </>
            )
          : null}
      </Carousel>

      {slides.length > 1
        ? (
            <div className="flex items-center justify-center gap-1.5">
              {slides.map((slide, i) => (
                <button
                  key={`dot-${slide.src}-${i}`}
                  type="button"
                  onClick={() => api?.scrollTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === current ? 'bg-primary w-6' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5',
                  )}
                  aria-label={`Go to project ${i + 1}`}
                />
              ))}
            </div>
          )
        : null}
    </div>
  )
}
