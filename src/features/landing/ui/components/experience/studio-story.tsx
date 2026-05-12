'use client'

import { ArrowRight } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { SECTION_ENTRANCE, STAGGER_CHILD, STAGGER_CONTAINER, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { ROOTS } from '@/shared/config/roots'
import { teamInfo } from '@/shared/constants/company/team-info'
import { EditorialEyebrow } from './editorial-eyebrow'

export function StudioStory() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })
  const founder = teamInfo.owners[0]

  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 xl:gap-24 items-center">

          <motion.div
            variants={SECTION_ENTRANCE}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="lg:col-span-5 lg:col-start-1 order-first"
          >
            <div className="relative aspect-[4/5] w-full max-w-md lg:max-w-none mx-auto overflow-hidden">
              <Image
                src={`/${founder.image}`}
                alt={`${founder.name}, Co-founder of Tri Pros Remodeling`}
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover grayscale-[0.15]"
              />
            </div>
          </motion.div>

          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="lg:col-span-6 lg:col-start-7 space-y-7"
          >
            <motion.div variants={STAGGER_CHILD}>
              <EditorialEyebrow>Our Studio</EditorialEyebrow>
            </motion.div>

            <motion.h2
              variants={STAGGER_CHILD}
              className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.01em] text-foreground"
            >
              Built by people who treat your home like
              {' '}
              <em className="italic text-primary">their own</em>
              .
            </motion.h2>

            <motion.div
              variants={STAGGER_CHILD}
              className="space-y-5 text-base lg:text-lg leading-[1.75] text-muted-foreground max-w-[58ch]"
            >
              <p>
                Tri Pros was founded by Oliver Porat and Sean Phil — two licensed contractors with over twenty years of construction experience between them, and a shared belief that the industry needed to grow up.
              </p>
              <p>
                Today our
                {' '}
                {teamInfo.numEmployees}
                -person team carries that same standard into every project: NARI-certified craftsmanship, BPI-trained efficiency, and a level of communication you&apos;d expect from a concierge — not a contractor.
              </p>
            </motion.div>

            <motion.div variants={STAGGER_CHILD}>
              <Link
                href={ROOTS.landing.about()}
                className="group inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Learn More About Our Studio
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
