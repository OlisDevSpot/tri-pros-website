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
    <section className="relative min-h-screen h-auto lg:h-screen w-full overflow-hidden">

      {/* ── Top scrim: ensures navbar buttons are legible over the hero image (dark mode only) ── */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-background/60 to-transparent dark:from-background/70 dark:to-transparent hidden dark:block" />

      {/* ── Desktop: image fills the right ~55% of viewport, full height ── */}
      <motion.div
        variants={SECTION_ENTRANCE}
        initial="hidden"
        animate="visible"
        className="hidden lg:block absolute inset-0 left-[45%] overflow-hidden [clip-path:polygon(12%_0%,_100%_0%,_100%_100%,_0%_100%)]"
      >
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
            sizes="60vw"
            className="object-cover"
          />
        </motion.div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent pointer-events-none" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/40 pointer-events-none" />
      </motion.div>

      {/* ── Content ── */}
      <div className="relative z-10 container flex flex-col lg:justify-center min-h-screen h-auto lg:h-screen">
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
          className="w-full lg:w-[45%] flex flex-col items-center text-center lg:items-start lg:text-left space-y-7 lg:space-y-10 py-24 lg:py-0"
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

        {/* ── Mobile: image below copy ── */}
        <motion.div
          variants={SECTION_ENTRANCE}
          initial="hidden"
          animate="visible"
          className="lg:hidden w-full pb-12"
        >
          <div className="relative aspect-[4/5] sm:aspect-[16/10] w-full overflow-hidden [clip-path:polygon(0%_8%,_100%_0%,_100%_100%,_0%_100%)]">
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
                sizes="100vw"
                className="object-cover"
              />
            </motion.div>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/40" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
