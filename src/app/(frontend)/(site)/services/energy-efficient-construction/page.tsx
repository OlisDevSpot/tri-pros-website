import { getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { PillarView } from '@/features/landing/ui/views/pillar-view'

export const revalidate = 180

export const metadata = {
  title: 'Energy-Efficient Construction | Tri Pros Remodeling',
  description: 'Complete energy envelope upgrades — HVAC, roofing, solar, windows, insulation — delivered by one licensed contractor with compounding savings.',
}

export default async function EnergyEfficiencyPillarPage() {
  const trades = await getTradesByPillar('energy-efficient-construction')
  return <PillarView pillarSlug="energy-efficient-construction" trades={trades} />
}
