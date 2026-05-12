'use client'

import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { STAGGER_CONTAINER, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { testimonials } from '@/shared/constants/company/testimonials'
import { SectionHeading } from './section-heading'
import { VoiceQuote } from './voice-quote'

export function Voices() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })

  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container">
        <SectionHeading eyebrow="Voices">
          From the people we&apos;ve
          {' '}
          <em className="italic text-primary">built for</em>
          .
        </SectionHeading>

        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="max-w-4xl mx-auto divide-y divide-foreground/10"
        >
          {testimonials.map(t => (
            <VoiceQuote key={t.name} testimonial={t} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
