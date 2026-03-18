import type { PillarSlug } from '@/features/landing/lib/notion-trade-helpers'

import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/shared/components/ui/button'

interface TradeHeroProps {
  tradeName: string
  outcomeStatement: string
  images: string[]
  defaultHeroImage: string
  pillarSlug: PillarSlug
  pillarTitle: string
}

export function TradeHero({
  tradeName,
  outcomeStatement,
  images,
  defaultHeroImage,
  pillarSlug,
  pillarTitle,
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
              <Link href="/services" className="hover:text-white transition-colors">
                Services
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={`/services/${pillarSlug}`}
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

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 max-w-4xl mx-auto">
          {tradeName}
        </h1>

        <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed">
          {outcomeStatement}
        </p>

        <Button asChild size="lg" variant="cta">
          <Link href="/contact">
            Schedule Your Free Consultation
          </Link>
        </Button>
      </div>
    </section>
  )
}
