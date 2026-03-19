import type { PillarSlug } from '@/features/landing/lib/notion-trade-helpers'

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
    <section className="relative min-h-[70vh] w-full flex items-center justify-center overflow-hidden">
      <Image
        src={imageUrl}
        alt={`${tradeName} project`}
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />

      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/50 to-black/30" />

      <div className="relative z-10 container text-center text-white pt-[calc(var(--navbar-height)+32px)] pb-16">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center justify-center gap-2 text-sm text-white/70">
            <li>
              <Link href={ROOTS.landing.services()} className="hover:text-white transition-colors">
                Services
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={ROOTS.landing.servicesPillar(pillarSlug)}
                className="hover:text-white transition-colors"
              >
                {pillarTitle}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-white font-medium" aria-current="page">
              {tradeName}
            </li>
          </ol>
        </nav>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 max-w-4xl mx-auto">
          {tradeName}
        </h1>

        <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed">
          {painHeadline}
        </p>

        <div className="flex flex-col items-center gap-6">
          <Button asChild size="lg" variant="cta">
            <Link href={ROOTS.landing.contact()}>
              Schedule Your Free Consultation
            </Link>
          </Button>

          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {trustItems.map((item, i) => (
              <li key={item} className="flex items-center gap-2 text-sm text-white/75">
                {i > 0 && <span className="hidden sm:block text-white/40" aria-hidden="true">·</span>}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
