'use client'

import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { STAGGER_CONTAINER, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { services } from '@/shared/constants/company/services'
import { SectionHeading } from './section-heading'
import { ServiceTile } from './service-tile'

export function ServicesGrid() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })

  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container">
        <SectionHeading eyebrow="Our Services">
          Four disciplines, one
          {' '}
          <em className="italic text-primary">standard</em>
          .
        </SectionHeading>

        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10 border-y border-foreground/10"
        >
          {services.map(service => (
            <ServiceTile key={service.slug} service={service} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
