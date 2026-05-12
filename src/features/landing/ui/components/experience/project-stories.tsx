'use client'

import type { ProjectStorySlide } from '@/features/landing/lib/experience-project-stories'
import type { CarouselApi } from '@/shared/components/ui/carousel'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { motion, useInView } from 'motion/react'
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
            opts={{ align: 'start', loop: false }}
            setApi={setApi}
            className="w-full"
          >
            <CarouselContent className="-ml-4 lg:-ml-6">
              {slides.map((slide, index) => (
                <CarouselItem key={`${slide.homeowner}-${index}`} className="pl-4 lg:pl-6 basis-full">
                  <ProjectStoryCard slide={slide} index={index} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Controls */}
          <div className="mt-10 flex items-center justify-center gap-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 rounded-none border-foreground/15 bg-transparent hover:bg-foreground/[0.03] text-foreground disabled:opacity-30"
              onClick={() => api?.scrollPrev()}
              disabled={activeIndex === 0}
              aria-label="Previous story"
            >
              <ArrowLeft className="size-4" />
            </Button>

            <div className="flex items-center gap-2" role="tablist" aria-label="Project story navigation">
              {Array.from({ length: count }).map((_, i) => (
                <button
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === i}
                  aria-label={`Go to story ${i + 1}`}
                  onClick={() => api?.scrollTo(i)}
                  className="group/dot relative size-2 rounded-full bg-foreground/15 hover:bg-foreground/30 transition-colors"
                >
                  <span
                    className={`absolute inset-0 rounded-full bg-primary transition-transform duration-300 ${
                      activeIndex === i ? 'scale-100' : 'scale-0'
                    }`}
                  />
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 rounded-none border-foreground/15 bg-transparent hover:bg-foreground/[0.03] text-foreground disabled:opacity-30"
              onClick={() => api?.scrollNext()}
              disabled={activeIndex === count - 1}
              aria-label="Next story"
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>

          {/* Slide counter */}
          <div className="mt-6 flex justify-center text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span className="font-serif italic text-foreground/80 normal-case text-sm tracking-normal mr-2">
              {String(activeIndex + 1).padStart(2, '0')}
            </span>
            /
            <span className="ml-2 font-serif italic text-foreground/40 normal-case text-sm tracking-normal">
              {String(count).padStart(2, '0')}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
