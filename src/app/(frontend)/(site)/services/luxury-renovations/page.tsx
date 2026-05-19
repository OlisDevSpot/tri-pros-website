import type { TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'
import { getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { PillarView } from '@/features/landing/ui/views/pillar-view'

export const revalidate = 180

export const metadata = {
  title: 'Luxury Renovations | Tri Pros Remodeling',
  description: 'Premium home renovations — kitchens, bathrooms, flooring, additions, and more. Every project backed by a licensed team and written warranty.',
}

export default async function LuxuryRenovationsPillarPage() {
  // Swallow Notion failures (e.g., CI placeholder token) so build doesn't fail
  // on external API outage; page renders empty trade list as graceful fallback.
  let trades: TradeWithScopes[] = []
  try {
    trades = await getTradesByPillar('luxury-renovations')
  }
  catch {
    // empty fallback
  }
  return <PillarView pillarSlug="luxury-renovations" trades={trades} />
}
