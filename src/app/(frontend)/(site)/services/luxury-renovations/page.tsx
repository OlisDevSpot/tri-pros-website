import { getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { PillarView } from '@/features/landing/ui/views/pillar-view'

export const revalidate = 180

export const metadata = {
  title: 'Luxury Renovations | Tri Pros Remodeling',
  description: 'Premium home renovations — kitchens, bathrooms, flooring, additions, and more. Every project backed by a licensed team and written warranty.',
}

export default async function LuxuryRenovationsPillarPage() {
  const trades = await getTradesByPillar('luxury-renovations')
  return <PillarView pillarSlug="luxury-renovations" trades={trades} />
}
