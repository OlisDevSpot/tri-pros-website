import type { PillarSlug, TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'

import Link from 'next/link'

import { pillarConfigs } from '@/features/landing/constants/pillar-config'
import { tradeBeforeAfter } from '@/features/landing/constants/trade-before-after'
import { tradeBenefits } from '@/features/landing/constants/trade-benefits'
import { tradeOutcomeStatements } from '@/features/landing/constants/trade-outcome-statements'
import { tradePainHeadlines } from '@/features/landing/constants/trade-pain-headlines'
import { tradePairings } from '@/features/landing/constants/trade-pairings'
import { tradeSymptoms } from '@/features/landing/constants/trade-symptoms'
import { NaturalPairings } from '@/features/landing/ui/components/services/natural-pairings'
import { NotionRefreshButton } from '@/features/landing/ui/components/services/notion-refresh-button'
import { PortfolioProof } from '@/features/landing/ui/components/services/portfolio-proof'
import { ProgramsTeaser } from '@/features/landing/ui/components/services/programs-teaser'
import { ScopesGrid } from '@/features/landing/ui/components/services/scopes-grid'
import { SwceSection } from '@/features/landing/ui/components/services/swce-section'
import { TradeBeforeAfter } from '@/features/landing/ui/components/services/trade-before-after'
import { TradeBenefitsSection } from '@/features/landing/ui/components/services/trade-benefits-section'
import { TradeHero } from '@/features/landing/ui/components/services/trade-hero'
import { TradeSymptomsBand } from '@/features/landing/ui/components/services/trade-symptoms-band'
import { BottomCTA } from '@/shared/components/cta'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'

interface TradeViewProps {
  trade: TradeWithScopes
  pillarSlug: PillarSlug
}

export function TradeView({ trade, pillarSlug }: TradeViewProps) {
  const pillarConfig = pillarConfigs[pillarSlug]
  const pillarType = pillarSlug === 'energy-efficient-construction' ? 'energy' : 'luxury'
  // PillarSlug is 'energy-efficient-construction' | 'luxury-renovations' — ternary is exhaustive
  const isEnergy = pillarSlug === 'energy-efficient-construction'

  const FALLBACK_HEADLINE = `Let's get your home where it should be.`
  const painHeadline = tradePainHeadlines[trade.slug] ?? FALLBACK_HEADLINE
  const symptoms = tradeSymptoms[trade.slug] ?? []
  const beforeAfter = tradeBeforeAfter[trade.slug]

  const outcomeStatement = tradeOutcomeStatements[trade.slug]
    ?? `Professional ${trade.name.toLowerCase()} services backed by a written workmanship warranty.`
  const benefits = tradeBenefits[trade.slug] ?? []
  const pairings = tradePairings[trade.slug] ?? []

  return (
    <main>
      <TradeHero
        tradeName={trade.name}
        outcomeStatement={outcomeStatement}
        images={trade.images}
        defaultHeroImage={pillarConfig.defaultHeroImage}
        pillarSlug={pillarSlug}
        pillarTitle={pillarConfig.title}
        painHeadline={painHeadline}
      />

      <NotionRefreshButton />

      {isEnergy
        ? <TradeSymptomsBand symptoms={symptoms} />
        : beforeAfter != null
          ? <TradeBeforeAfter before={beforeAfter.before} after={beforeAfter.after} />
          : null}

      {/* Social proof — real work closes faster than promises */}
      <PortfolioProof tradeName={trade.name} />

      {/* Mid-page CTA — catch visitors convinced by the portfolio */}
      <section className="border-y border-primary/10 bg-primary/5">
        <div className="container py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-lg text-foreground">
              Ready to see what we can do for your home?
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Free in-home consultation. No pressure, no obligation.
            </p>
          </div>
          <Button asChild size="lg" variant="cta" className="shrink-0">
            <Link href={ROOTS.landing.contact()}>
              Schedule Now
            </Link>
          </Button>
        </div>
      </section>

      <TradeBenefitsSection tradeName={trade.name} benefits={benefits} />

      <ScopesGrid scopes={trade.scopes} />

      <NaturalPairings pairings={pairings} />

      <SwceSection variant="compact" />

      <ProgramsTeaser pillarType={pillarType} />

      <BottomCTA />
    </main>
  )
}
