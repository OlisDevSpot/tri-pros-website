import { notFound } from 'next/navigation'

import { getTradeBySlug, getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { TradeView } from '@/features/landing/ui/views/trade-view'

export const revalidate = 180

export async function generateStaticParams() {
  const trades = await getTradesByPillar('luxury-renovations')
  return trades.map(trade => ({ tradeSlug: trade.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ tradeSlug: string }> }) {
  const { tradeSlug } = await params
  const trade = await getTradeBySlug('luxury-renovations', tradeSlug)
  if (!trade) {
    return {}
  }
  return {
    title: `${trade.name} | Luxury Renovations | Tri Pros Remodeling`,
    description: `Professional ${trade.name.toLowerCase()} services in Southern California. Licensed, insured, and backed by a written workmanship warranty.`,
  }
}

export default async function LuxuryTradeDetailPage({ params }: { params: Promise<{ tradeSlug: string }> }) {
  const { tradeSlug } = await params
  const trade = await getTradeBySlug('luxury-renovations', tradeSlug)
  if (!trade) {
    notFound()
  }
  return <TradeView trade={trade} pillarSlug="luxury-renovations" />
}
