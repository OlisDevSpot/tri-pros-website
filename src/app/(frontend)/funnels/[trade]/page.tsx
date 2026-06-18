import { notFound } from 'next/navigation'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { FunnelEngine } from '@/shared/domains/funnels/ui/funnel-engine'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function FunnelTradePage({ params }: Props) {
  const { trade } = await params
  if (!isFunnelSlug(trade)) {
    notFound()
  }
  return <FunnelEngine slug={trade} />
}
