import type { TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'
import { getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { PillarView } from '@/features/landing/ui/views/pillar-view'

export const revalidate = 180

export const metadata = {
  title: 'Energy-Efficient Construction | Tri Pros Remodeling',
  description: 'Complete energy envelope upgrades — HVAC, roofing, solar, windows, insulation — delivered by one licensed contractor with compounding savings.',
}

export default async function EnergyEfficiencyPillarPage() {
  // Swallow Notion failures (e.g., CI placeholder token) so build doesn't fail
  // on external API outage; page renders empty trade list as graceful fallback.
  let trades: TradeWithScopes[] = []
  try {
    trades = await getTradesByPillar('energy-efficient-construction')
  }
  catch {
    // empty fallback
  }
  return <PillarView pillarSlug="energy-efficient-construction" trades={trades} />
}
