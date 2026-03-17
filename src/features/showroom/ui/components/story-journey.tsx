'use client'

import type { MediaFile } from '@/shared/db/schema'
import { motion, useInView } from 'motion/react'
import Image from 'next/image'
import { useRef } from 'react'
import { JOURNEY_STEPS } from '@/features/showroom/constants/journey-steps'

interface Props {
  duringPhotos: MediaFile[]
}

export function StoryJourney({ duringPhotos }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  if (duringPhotos.length === 0) {
    return null
  }

  return (
    <section ref={ref} className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="mb-2 text-2xl font-bold text-foreground lg:text-3xl">
            The Process
          </h2>
          <p className="text-muted-foreground">Follow the journey from start to finish</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Center line - desktop only */}
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border lg:block" />

          {/* Mobile left line */}
          <div className="absolute left-6 top-0 h-full w-px bg-border lg:hidden" />

          <div className="space-y-12">
            {duringPhotos.map((photo, index) => {
              const step = JOURNEY_STEPS[index % JOURNEY_STEPS.length]
              const isLeft = index % 2 === 0

              return (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="relative"
                >
                  {/* Timeline dot */}
                  <div className="absolute left-6 top-6 z-10 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background lg:left-1/2" />

                  <div className={`lg:grid lg:grid-cols-2 lg:gap-8 ${isLeft ? '' : 'lg:direction-rtl'}`}>
                    {/* Content side */}
                    <div className={`mb-4 pl-12 lg:mb-0 lg:pl-0 ${isLeft ? 'lg:pr-12 lg:text-right' : 'lg:pl-12 lg:order-2 lg:text-left'}`}>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Step
                        {' '}
                        {index + 1}
                      </span>
                      <h3 className="mt-1 text-lg font-semibold text-foreground">{step.label}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{photo.name}</p>
                    </div>

                    {/* Image side */}
                    <div className={`pl-12 lg:pl-0 ${isLeft ? 'lg:pl-12 lg:order-2' : 'lg:pr-12'}`}>
                      <div className="relative aspect-video overflow-hidden rounded-xl shadow-lg">
                        <Image
                          src={photo.url}
                          alt={photo.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
