import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ROOTS } from '@/shared/config/roots'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { getTradeFacts } from '@/shared/domains/funnels/constants/trade-facts'
import { FunnelEngine } from '@/shared/domains/funnels/ui/funnel-engine'

interface Props {
  params: Promise<{ trade: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trade } = await params
  if (!isFunnelSlug(trade)) {
    return {}
  }
  const meta = getTradeFacts(trade).meta
  const url = ROOTS.subdomainUrl(trade)
  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      type: 'website',
      siteName: 'Tri Pros Remodeling',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
    },
    alternates: { canonical: url },
  }
}

export default async function FunnelTradePage({ params, searchParams }: Props) {
  const { trade } = await params
  const sp = await searchParams
  if (!isFunnelSlug(trade)) {
    notFound()
  }
  const variantRaw = sp.v
  const variant = typeof variantRaw === 'string' ? variantRaw : undefined
  return <FunnelEngine slug={trade} variant={variant} />
}
