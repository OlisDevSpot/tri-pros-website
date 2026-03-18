import { notFound } from 'next/navigation'

import { getTradeBySlug, getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { TradeView } from '@/features/landing/ui/views/trade-view'

export const revalidate = 180

export async function generateStaticParams() {
  const trades = await getTradesByPillar('energy-efficient-construction')
  return trades.map(trade => ({ tradeSlug: trade.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ tradeSlug: string }> }) {
  const { tradeSlug } = await params
  const trade = await getTradeBySlug('energy-efficient-construction', tradeSlug)
  if (!trade) {
    return {}
  }
  return {
    title: `${trade.name} | Energy-Efficient Construction | Tri Pros Remodeling`,
    description: `Professional ${trade.name.toLowerCase()} services in Southern California. Licensed, insured, and backed by a written workmanship warranty.`,
  }
}

export default async function EnergyTradeDetailPage({ params }: { params: Promise<{ tradeSlug: string }> }) {
  const { tradeSlug } = await params
  const trade = await getTradeBySlug('energy-efficient-construction', tradeSlug)
  if (!trade) {
    notFound()
  }
  return <TradeView trade={trade} pillarSlug="energy-efficient-construction" />
}
