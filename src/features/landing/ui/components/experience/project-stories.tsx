'use client'

import type { ProjectStorySlide } from '@/features/landing/lib/experience-project-stories'
import type { CarouselApi } from '@/shared/components/ui/carousel'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { SECTION_ENTRANCE, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { Button } from '@/shared/components/ui/button'
import { Carousel, CarouselContent, CarouselItem } from '@/shared/components/ui/carousel'
import { ProjectStoryCard } from './project-story-card'
import { SectionHeading } from './section-heading'

interface ProjectStoriesProps {
  slides: ProjectStorySlide[]
}

export function ProjectStories({ slides }: ProjectStoriesProps) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })
  const prefersReduced = useReducedMotion()

  const [api, setApi] = useState<CarouselApi>()
  const [activeIndex, setActiveIndex] = useState(0)
  const [count, setCount] = useState(slides.length)

  useEffect(() => {
    if (!api) {
      return
    }
    setCount(api.scrollSnapList().length)
    setActiveIndex(api.selectedScrollSnap())
    const onSelect = () => setActiveIndex(api.selectedScrollSnap())
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  if (slides.length === 0) {
    return null
  }

  // Single slide — render as static feature card, no carousel chrome
  if (slides.length === 1) {
    return (
      <section ref={ref} className="py-20 lg:py-32">
        <div className="container">
          <SectionHeading eyebrow="Project Stories" chapter="01">
            Real homes, real
            {' '}
            <em className="italic text-primary">homeowners</em>
            .
          </SectionHeading>

          <motion.div
            variants={SECTION_ENTRANCE}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
          >
            <ProjectStoryCard slide={slides[0]} index={0} />
          </motion.div>
        </div>
      </section>
    )
  }

  const activeSlide = slides[activeIndex]

  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container">
        <SectionHeading eyebrow="Project Stories" chapter="01">
          Real homes, real
          {' '}
          <em className="italic text-primary">homeowners</em>
          .
        </SectionHeading>

        <motion.div
          variants={SECTION_ENTRANCE}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          <Carousel
            opts={{
              align: 'start',
              loop: slides.length > 2,
              duration: prefersReduced ? 0 : undefined,
            }}
            setApi={setApi}
            className="w-full"
            aria-roledescription="carousel"
            aria-label="Project stories from real homeowners"
          >
            <CarouselContent className="-ml-4 lg:-ml-6">
              {slides.map((slide, index) => (
                <CarouselItem
                  key={`${slide.homeowner}-${index}`}
                  className="pl-4 lg:pl-6 basis-full"
                  aria-roledescription="slide"
                  aria-label={`${slide.homeowner}: ${slide.quote.slice(0, 80)}${slide.quote.length > 80 ? '...' : ''}`}
                >
                  <ProjectStoryCard slide={slide} index={index} isActive={activeIndex === index} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Navigation row: counter + progress bar + arrows */}
          <div className="mt-8 flex items-center justify-between lg:justify-start lg:gap-8">
            {/* Counter */}
            <span className="font-serif italic text-sm text-foreground/60 tabular-nums min-w-[4ch]">
              {String(activeIndex + 1).padStart(2, '0')}
              <span className="text-foreground/20 mx-1.5">/</span>
              {String(count).padStart(2, '0')}
            </span>

            {/* Progress bar — hidden on very small screens, visible sm+ */}
            {count > 2 && (
              <div className="hidden sm:block flex-1 max-w-48 h-px bg-foreground/10 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${((activeIndex + 1) / count) * 100}%` }}
                />
              </div>
            )}

            {/* Arrows */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 rounded-none border-foreground/10 bg-transparent hover:bg-foreground/[0.05] hover:border-foreground/20 text-foreground/70 hover:text-foreground disabled:opacity-25 transition-all duration-200"
                onClick={() => api?.scrollPrev()}
                disabled={!slides.length || (activeIndex === 0 && slides.length <= 2)}
                aria-label="Previous story"
              >
                <ArrowLeft className="size-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 rounded-none border-foreground/10 bg-transparent hover:bg-foreground/[0.05] hover:border-foreground/20 text-foreground/70 hover:text-foreground disabled:opacity-25 transition-all duration-200"
                onClick={() => api?.scrollNext()}
                disabled={!slides.length || (activeIndex === count - 1 && slides.length <= 2)}
                aria-label="Next story"
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Screen reader live region for slide changes */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {activeSlide
              ? `Slide ${activeIndex + 1} of ${count}: ${activeSlide.homeowner} — ${activeSlide.meta}`
              : null}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
