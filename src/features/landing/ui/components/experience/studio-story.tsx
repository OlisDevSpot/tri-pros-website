'use client'

import { ArrowRight } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import Link from 'next/link'
import { useRef } from 'react'
import { STAGGER_CHILD, STAGGER_CONTAINER, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { FounderStory } from '@/features/landing/ui/components/about/founder-story'
import { ROOTS } from '@/shared/config/roots'
import { teamInfo } from '@/shared/constants/company/team-info'
import { DrawnUnderline } from './drawn-underline'
import { EditorialEyebrow } from './editorial-eyebrow'

export function StudioStory() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })
  const founder = teamInfo.owners[0]

  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container">
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="flex flex-col items-center text-center lg:items-start lg:text-left mb-12 lg:mb-16"
        >
          <motion.div variants={STAGGER_CHILD}>
            <EditorialEyebrow chapter="02">Our Studio</EditorialEyebrow>
          </motion.div>

          <motion.h2
            variants={STAGGER_CHILD}
            className="mt-5 font-serif text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.01em] text-foreground"
          >
            Built by people who treat your home like
            {' '}
            <em className="italic text-primary">their own</em>
            .
          </motion.h2>
        </motion.div>

        <FounderStory
          founderName={founder.name}
          founderImgSrc={`/${founder.image}`}
          isInView={isInView}
          mobileTextFirst
          Quote={() => (
            <figure className="relative pl-6 border-l-2 border-primary/40">
              <blockquote className="font-serif italic text-lg sm:text-xl text-foreground/90 leading-snug">
                &ldquo;We don&apos;t just build structures; we craft legacies
                that families will cherish for generations.&rdquo;
              </blockquote>
              <figcaption className="text-sm text-muted-foreground mt-3">
                —
                {' '}
                {founder.name}
                , Founder
              </figcaption>
            </figure>
          )}
        >
          <p>
            {founder.name}
            {' '}
            founded Tri Pros Remodeling with a simple conviction: homeowners deserve a contractor who communicates clearly, delivers on promises, and treats every project like it&apos;s their own home.
          </p>
          <p>
            Today our
            {' '}
            {teamInfo.numEmployees}
            -person team carries that same standard into every project: NARI-certified craftsmanship, BPI-trained efficiency, and a level of communication you&apos;d expect from a concierge — not a contractor.
          </p>
        </FounderStory>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex justify-center lg:justify-start"
        >
          <Link
            href={ROOTS.landing.about()}
            className="group inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <DrawnUnderline>Learn More About Our Studio</DrawnUnderline>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
