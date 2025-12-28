'use client'

import type { Variants } from 'motion/react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useMemo } from 'react'
import { CompanySocialButtons } from '@/components/company-social-buttons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { ViewportHero } from '@/components/viewport-hero'
import { companyInfo } from '@/features/landing/data/company'

const parentVariant: Variants = {
  initial: {
    opacity: 0,
    y: 30,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      delayChildren: 0.4,
      staggerChildren: 0.4,
    },
  },
}

const highlightVariants: Variants = {
  highlight: {
    scale: 1.2,
  },
}

export default function HomeHero() {
  const pillsData = useMemo(() => {
    return [`${companyInfo.combinedYearsExperience}+ Years Combined Experience`, `${companyInfo.numProjects}+ Projects Delivered`, `${companyInfo.clientSatisfaction * 100}% Client Satisfaction`, `${companyInfo.generations} Generations`]
  }, [])
  return (
    <ViewportHero className="lg:absolute lg:inset-0 z-50">
      {/* Content */}
      <div className="absolute inset-0 mx-auto w-full h-full lg:p-6">
        <div
          className="relative flex flex-col items-center justify-center h-full lg:rounded-3xl shadow-2xl"
          style={{
            backgroundImage: `radial-gradient(circle, color-mix(in oklab, var(--background) 80%, transparent), color-mix(in oklab, var(--background) 50%, transparent)), url("/hero-photos/modern-house-1.png")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="container text-center text-foreground">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-2 lg:space-y-8"
            >
              {/* Main Headline */}
              <motion.h1
                variants={parentVariant}
                initial="initial"
                animate="animate"
                className="font-serif text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight"
              >
                Crafting Architectural
                {' '}
                <motion.span
                  variants={highlightVariants}
                  initial="initial"
                  animate="highlight"
                  className="bg-linear-to-r from-primary to-[color-mix(in_oklch,var(--primary)_70%,var(--foreground))] bg-clip-text text-transparent font-extrabold"
                >
                  Masterpieces
                </motion.span>
                {' '}
                That Stand the Test of Time
              </motion.h1>

              <CompanySocialButtons onHero />

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-xl sm:text-2xl text-foreground max-w-4xl mx-auto leading-relaxed"
              >
                Premium construction services for discerning homeowners and
                businesses who demand excellence
              </motion.p>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-wrap justify-center items-center gap-2 text-foreground"
              >
                {pillsData.map(pill => (
                  <Badge
                    key={pill}
                    variant="outline"
                    className="py-2 px-4 rounded-3xl grow border-background/40 bg-foreground/10 backdrop-blur-sm lg:flex-1"
                  >
                    <div className="w-2 h-2 bg-foreground rounded-full" />
                    <span className="font-semibold">{pill}</span>
                  </Badge>
                ))}
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="flex flex-row sm:flex-row gap-4 sm:justify-center sm:items-center max-w-2xl mx-auto"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1"
                >
                  <Button
                    asChild
                    variant="default"
                    size="lg"
                    className="h-14 text-lg w-full"
                  >
                    <Link href="/contact">Schedule</Link>
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1"
                >
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-14 text-lg w-full"
                  >
                    <Link href="/portfolio">View Portfolio</Link>
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>

          {/* BUSINESS CARD */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="hidden lg:block absolute bottom-6 left-6 w-fit h-fit font-mono"
          >
            <p>
              CA Lic #
              {companyInfo.licenses[0].licenseNumber}
            </p>
            <p>
              License Type:
              {' '}
              {companyInfo.licenses[0].type}
            </p>
          </motion.div>
        </div>

      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-6 lg:bottom-16 left-1/2 transform -translate-x-1/2 text-white z-10"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center space-y-2"
        >
          <span className="text-sm font-medium">Scroll to explore</span>
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-white/70 rounded-full mt-2"
            />
          </div>
        </motion.div>
      </motion.div>
    </ViewportHero>
  )
}
