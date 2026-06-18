import type { FunnelTrade } from '@/features/funnels/constants/funnel-hosts'
import { notFound } from 'next/navigation'
import { FUNNEL_TRADES } from '@/features/funnels/constants/funnel-hosts'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function FunnelTradePage({ params }: Props) {
  const { trade } = await params

  // Only the three known trades resolve; anything else 404s.
  if (!FUNNEL_TRADES.includes(trade as FunnelTrade)) {
    notFound()
  }

  // Plan 2 replaces this shell with the multi-step funnel engine.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold capitalize" data-funnel-trade={trade}>
        {`${trade} Showcase`}
      </h1>
      <p className="text-muted-foreground mt-2">Funnel shell — engine lands in Plan 2.</p>
    </main>
  )
}
