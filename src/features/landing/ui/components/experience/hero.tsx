'use client'

import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { SECTION_ENTRANCE, STAGGER_CHILD, STAGGER_CONTAINER } from '@/features/landing/constants/experience-motion'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { EditorialEyebrow } from './editorial-eyebrow'

export function ExperienceHero() {
  return (
    <section className="relative">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-20 items-center min-h-[88vh] pt-[calc(var(--navbar-height)+4rem)] pb-20 lg:pb-32 xl:pb-40">

          {/* Copy */}
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="visible"
            className="lg:col-span-6 xl:col-span-5 space-y-8 lg:space-y-10 z-10"
          >
            <motion.div variants={STAGGER_CHILD}>
              <EditorialEyebrow>The Tri Pros Experience</EditorialEyebrow>
            </motion.div>

            <motion.h1
              variants={STAGGER_CHILD}
              className="font-serif text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.02] tracking-[-0.02em] text-foreground"
            >
              White-glove construction,
              {' '}
              <em className="italic text-primary">uncompromised</em>
              .
            </motion.h1>

            <motion.p
              variants={STAGGER_CHILD}
              className="text-base lg:text-lg leading-[1.7] text-muted-foreground max-w-[58ch]"
            >
              For over two decades, Southern California homeowners have trusted us to build with the same care they&apos;d want for their own family. A dedicated project lead at every step. Fixed-price contracts. Transparent communication. The kind of build that ends with a handshake and a hug.
            </motion.p>

            <motion.div
              variants={STAGGER_CHILD}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-8 pt-2"
            >
              <Button asChild size="lg" className="h-12 px-7 text-sm tracking-wide">
                <a href="#inquiry">Schedule a Consultation</a>
              </Button>
              <Link
                href={ROOTS.landing.portfolioProjects()}
                className="group inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Explore Our Work
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Image */}
          <motion.div
            variants={SECTION_ENTRANCE}
            initial="hidden"
            animate="visible"
            className="lg:col-span-6 xl:col-span-7 lg:col-start-7 xl:col-start-6 relative"
          >
            <div className="relative aspect-[4/5] lg:aspect-[5/6] xl:aspect-[4/5] w-full overflow-hidden [clip-path:polygon(12%_0%,_100%_0%,_100%_100%,_0%_100%)] lg:[clip-path:polygon(18%_0%,_100%_0%,_100%_100%,_0%_100%)]">
              <Image
                src="/hero-photos/modern-house-1.png"
                alt="A completed Tri Pros residential project in Southern California"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/40" />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
