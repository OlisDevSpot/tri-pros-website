'use client'

import type { PillarSlug } from '@/features/landing/lib/notion-trade-helpers'

import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'

interface TradeHeroProps {
  tradeName: string
  images: string[]
  defaultHeroImage: string
  pillarSlug: PillarSlug
  pillarTitle: string
  painHeadline: string
}

const trustItems = [
  `CA Lic. #${companyInfo.licenses[0].licenseNumber}`,
  'A+ BBB Rating',
  `${companyInfo.combinedYearsExperience}+ Years Combined Experience`,
  `${companyInfo.numProjects}+ Projects Completed`,
]

export function TradeHero({
  tradeName,
  images,
  defaultHeroImage,
  pillarSlug,
  pillarTitle,
  painHeadline,
}: TradeHeroProps) {
  const imageUrl = images[0] ?? defaultHeroImage

  return (
    <section className="relative flex min-h-[70vh] w-full items-center justify-center overflow-hidden bg-black">
      {/* Background image with cinematic entrance */}
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className="absolute inset-0"
      >
        <Image
          src={imageUrl}
          alt={`${tradeName} project`}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      </motion.div>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.5)_100%)]" />

      <div className="relative z-10 container pb-16 pt-[calc(var(--navbar-height)+32px)] text-center text-white">
        {/* Breadcrumb */}
        <motion.nav
          aria-label="Breadcrumb"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-8"
        >
          <ol className="flex items-center justify-center gap-2 text-sm text-white/50">
            <li>
              <Link href={ROOTS.landing.services()} className="transition-colors hover:text-white/80">
                Services
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={ROOTS.landing.servicesPillar(pillarSlug)}
                className="transition-colors hover:text-white/80"
              >
                {pillarTitle}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-white/80" aria-current="page">
              {tradeName}
            </li>
          </ol>
        </motion.nav>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2 backdrop-blur-md"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
            {pillarTitle}
          </span>
        </motion.div>

        {/* Trade name */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mx-auto mb-5 max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-8xl"
        >
          {tradeName}
        </motion.h1>

        {/* Pain headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mx-auto mb-8 max-w-2xl text-lg font-light text-white/70 sm:text-xl"
        >
          {painHeadline}
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="mb-8"
        >
          <Button asChild size="lg" variant="cta">
            <Link href={ROOTS.landing.contact()}>
              Schedule Your Free Consultation
            </Link>
          </Button>
        </motion.div>

        {/* Trust strip — frosted glass */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-2 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 backdrop-blur-md"
        >
          {trustItems.map((item, i) => (
            <span key={item} className="flex items-center gap-1.5 text-sm text-white/60">
              {i > 0 && <span className="text-white/20" aria-hidden="true">·</span>}
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
