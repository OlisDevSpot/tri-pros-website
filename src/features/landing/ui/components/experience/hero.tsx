'use client'

import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ACCENT_REVEAL,
  SECTION_ENTRANCE,
  STAGGER_CHILD,
  STAGGER_CONTAINER,
  WORD_REVEAL,
  WORD_STAGGER_CONTAINER,
} from '@/features/landing/constants/experience-motion'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { DrawnUnderline } from './drawn-underline'
import { EditorialEyebrow } from './editorial-eyebrow'

const HERO_WORDS_BEFORE = ['White-glove', 'construction,']

export function ExperienceHero() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-20 items-start lg:items-center lg:min-h-[88vh] pt-[calc(var(--navbar-height)+1.5rem)] lg:pt-[calc(var(--navbar-height)+4rem)] pb-16 lg:pb-32 xl:pb-40">

          {/* Copy */}
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="visible"
            className="lg:col-span-6 xl:col-span-5 z-10 flex flex-col items-center text-center lg:items-start lg:text-left space-y-7 lg:space-y-10"
          >
            <motion.div variants={STAGGER_CHILD}>
              <EditorialEyebrow>The Tri Pros Experience</EditorialEyebrow>
            </motion.div>

            <motion.h1
              variants={WORD_STAGGER_CONTAINER}
              className="font-serif text-[2.75rem] sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.04] tracking-[-0.02em] text-foreground"
            >
              {HERO_WORDS_BEFORE.map(word => (
                <motion.span
                  key={word}
                  variants={WORD_REVEAL}
                  className="inline-block mr-[0.25em]"
                >
                  {word}
                </motion.span>
              ))}
              <motion.span variants={ACCENT_REVEAL} className="inline-block">
                <em className="italic text-primary">uncompromised</em>
                .
              </motion.span>
            </motion.h1>

            <motion.p
              variants={STAGGER_CHILD}
              className="text-base lg:text-lg leading-[1.7] text-muted-foreground max-w-[58ch]"
            >
              For over two decades, Southern California homeowners have trusted us to build with the same care they&apos;d want for their own family. A dedicated project lead at every step. Fixed-price contracts. Transparent communication. The kind of build that ends with a handshake and a hug.
            </motion.p>

            <motion.div
              variants={STAGGER_CHILD}
              className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8 pt-2"
            >
              <Button asChild size="lg" className="h-12 px-7 text-sm tracking-wide">
                <a href="#inquiry">Schedule a Consultation</a>
              </Button>
              <Link
                href={ROOTS.landing.portfolioProjects()}
                className="group inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <DrawnUnderline>Explore Our Work</DrawnUnderline>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Image */}
          <motion.div
            variants={SECTION_ENTRANCE}
            initial="hidden"
            animate="visible"
            className="lg:col-span-6 xl:col-span-7 lg:col-start-7 xl:col-start-6 relative w-full"
          >
            <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[5/6] xl:aspect-[4/5] w-full overflow-hidden [clip-path:polygon(0%_8%,_100%_0%,_100%_100%,_0%_100%)] lg:[clip-path:polygon(18%_0%,_100%_0%,_100%_100%,_0%_100%)]">
              <motion.div
                className="absolute inset-0"
                animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
                transition={{
                  duration: 24,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  repeatType: 'mirror',
                }}
              >
                <Image
                  src="/hero-photos/modern-house-1.png"
                  alt="A completed Tri Pros residential project in Southern California"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                />
              </motion.div>
              <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/40" />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
