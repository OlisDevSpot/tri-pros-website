'use client'

import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { SECTION_ENTRANCE, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { stats } from '@/shared/constants/company/stats'
import { AccreditationsStrip } from './accreditations-strip'
import { EditorialEyebrow } from './editorial-eyebrow'

export function StatsRow() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })

  return (
    <section ref={ref} className="py-20 lg:py-32 border-t border-foreground/10">
      <div className="container">
        <motion.div
          variants={SECTION_ENTRANCE}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          <div className="text-center mb-12 lg:mb-16 flex justify-center">
            <EditorialEyebrow>Trusted. Insured. Accredited.</EditorialEyebrow>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-foreground/10 border-y border-foreground/10">
            {stats.map(stat => (
              <div key={stat.label} className="px-4 py-10 lg:py-12 text-center">
                <div className="font-serif text-5xl lg:text-7xl leading-none text-foreground mb-3 tracking-[-0.02em]">
                  {stat.number}
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  {stat.label}
                </div>
                <div className="text-xs text-muted-foreground/60 mt-1">
                  {stat.description}
                </div>
              </div>
            ))}
          </div>

          <AccreditationsStrip />
        </motion.div>
      </div>
    </section>
  )
}
