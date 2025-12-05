'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ViewportHero } from '@/components/viewport-hero'
import { companyInfo } from '@/features/landing/data/company'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export function TopSpacer({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full pt-[calc(var(--navbar-height)+16px)]">
      {children}
    </div>
  )
}

export default function AboutHero() {
  const isMobile = useIsMobile()

  return (
    <ViewportHero>
      <TopSpacer>
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 lg:gap-24 items-center">
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <h1 className=" text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  Three Generations of
                  {' '}
                  <span className="text-secondary">Master Craftsmanship</span>
                </h1>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-xl text-muted-foreground leading-relaxed"
              >
                Founded in 1998 by master craftsman Robert Elite, our company has
                been built on a foundation of unwavering commitment to quality,
                innovation, and client satisfaction. Today, we continue this
                legacy of excellence with the next generation of skilled artisans
                and modern techniques.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="grid grid-cols-3 gap-6 pt-6"
              >
                <div className="text-center">
                  <div className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
                    1998
                  </div>
                  <div className="text-sm text-muted-foreground">Founded</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
                    500+
                  </div>
                  <div className="text-sm text-muted-foreground">Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
                    3
                  </div>
                  <div className="text-sm text-muted-foreground">Generations</div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="flex flex-row sm:flex-row gap-4 sm:justify-center sm:items-center w-full mx-auto"
              >
                <motion.div className="w-full">
                  <Button
                    asChild
                    size="lg"
                    variant="default"
                    className="text-lg h-16 w-full"
                  >
                    <Link href="/contact">Meet Our Team</Link>
                  </Button>
                </motion.div>
                <motion.div className="w-full">
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="text-lg h-16 w-full"
                  >
                    <Link href="/portfolio">View Our Legacy</Link>
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative h-full min-h-fit mb-4"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl h-full min-h-[400px]">
                <Image
                  src="/hero-photos/modern-house-2.png"
                  alt="Tri Pros Remodeling founder and team"
                  width={600}
                  height={700}
                  className="object-cover h-full"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
              </div>

              {/* Floating Award Card */}
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className={
                  cn(
                    'absolute -top-6 -right-6 bg-linear-to-br from-[color-mix(in_oklch,var(--secondary)_60%,black_20%,transparent_20%)] to-secondary text-white rounded-xl px-10 py-4 shadow-xl backdrop-blur-sm',
                    isMobile ? '-top-2 -right-2' : '',
                  )
                }
              >
                <div className="text-center">
                  <p className="text-lg font-bold">A+ BBB</p>
                  <p className="text-base">Rating</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className={
                  cn(
                    'absolute -top-6 -left-6 bg-linear-to-tl from-[color-mix(in_oklch,var(--primary)_60%,black_20%,transparent_20%)] to-primary text-white rounded-xl px-4 py-10 shadow-xl backdrop-blur-sm',
                    isMobile ? '-top-2 -left-2' : '',
                  )
                }
              >
                <div className="text-center">
                  <p className="text-lg font-bold">100% Licensed</p>
                  <p className="text-base">& Bonded</p>
                  <p className="text-base">Fully Compliant</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.4 }}
                className={
                  cn(
                    'absolute -bottom-6 -left-6 bg-linear-to-br from-neutral-300/70 to-white/70 text-neutral-900 rounded-xl px-10 py-4 shadow-xl backdrop-blur-sm',
                    isMobile ? '-bottom-2 -left-2' : '',
                  )
                }
              >
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    25+
                  </p>
                  <p className="text-base">
                    Years of Excellence
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.4 }}
                className={
                  cn(
                    'absolute -bottom-6 -right-6 bg-linear-to-br from-neutral-800/80 to-black/80 text-neutral-100 rounded-xl px-4 py-10 shadow-xl backdrop-blur-sm',
                    isMobile ? '-bottom-2 -right-2' : '',
                  )
                }
              >
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {`${companyInfo.numProjects}+`}
                  </p>
                  <p className="text-base">
                    Projects
                  </p>
                </div>
              </motion.div>

            </motion.div>
          </div>
        </div>
      </TopSpacer>
    </ViewportHero>
  )
}
