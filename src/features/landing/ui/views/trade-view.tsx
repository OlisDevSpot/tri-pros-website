import type { PillarSlug, TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'

import { pillarConfigs } from '@/features/landing/constants/pillar-config'
import { tradeBenefits } from '@/features/landing/constants/trade-benefits'
import { tradeOutcomeStatements } from '@/features/landing/constants/trade-outcome-statements'
import { tradePairings } from '@/features/landing/constants/trade-pairings'
import { NaturalPairings } from '@/features/landing/ui/components/services/natural-pairings'
import { NotionRefreshButton } from '@/features/landing/ui/components/services/notion-refresh-button'
import { PortfolioProof } from '@/features/landing/ui/components/services/portfolio-proof'
import { ProgramsTeaser } from '@/features/landing/ui/components/services/programs-teaser'
import { ScopesGrid } from '@/features/landing/ui/components/services/scopes-grid'
import { SwceSection } from '@/features/landing/ui/components/services/swce-section'
import { TradeBenefitsSection } from '@/features/landing/ui/components/services/trade-benefits-section'
import { TradeHero } from '@/features/landing/ui/components/services/trade-hero'
import { BottomCTA } from '@/shared/components/cta'

interface TradeViewProps {
  trade: TradeWithScopes
  pillarSlug: PillarSlug
}

export function TradeView({ trade, pillarSlug }: TradeViewProps) {
  const pillarConfig = pillarConfigs[pillarSlug]
  const pillarType = pillarSlug === 'energy-efficient-construction' ? 'energy' : 'luxury'
  const outcomeStatement = tradeOutcomeStatements[trade.slug]
    ?? `Professional ${trade.name.toLowerCase()} services backed by a written workmanship warranty.`
  const benefits = tradeBenefits[trade.slug] ?? []
  const pairings = tradePairings[trade.slug] ?? []

  return (
    <main>
      <TradeHero
        tradeName={trade.name}
        outcomeStatement={outcomeStatement}
        coverImageUrl={trade.coverImageUrl}
        defaultHeroImage={pillarConfig.defaultHeroImage}
        pillarSlug={pillarSlug}
        pillarTitle={pillarConfig.title}
      />

      <NotionRefreshButton />

      <TradeBenefitsSection benefits={benefits} />

      <ScopesGrid scopes={trade.scopes} />

      <NaturalPairings pairings={pairings} />

      <SwceSection variant="compact" />

      <ProgramsTeaser pillarType={pillarType} />

      <PortfolioProof tradeName={trade.name} />

      <BottomCTA />
    </main>
  )
}
