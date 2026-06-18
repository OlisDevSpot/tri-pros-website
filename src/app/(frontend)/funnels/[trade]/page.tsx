import { notFound } from 'next/navigation'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelEngine } from '@/shared/domains/funnels/ui/funnel-engine'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function FunnelTradePage({ params }: Props) {
  const { trade } = await params
  if (!isFunnelSlug(trade)) {
    notFound()
  }
  const spec = getFunnel(trade)
  return <FunnelEngine spec={spec} />
}
