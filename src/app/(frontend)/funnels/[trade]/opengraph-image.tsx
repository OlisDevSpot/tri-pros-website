import { ImageResponse } from 'next/og'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { getTradeFacts } from '@/shared/domains/funnels/constants/trade-facts'
import { loadOgFonts } from '@/shared/domains/funnels/lib/og/load-og-fonts'
import { readPublicDataUri } from '@/shared/domains/funnels/lib/og/og-assets'
import { FunnelOgCard } from '@/shared/domains/funnels/ui/og/funnel-og-card'

export const runtime = 'nodejs'
export const alt = 'Tri Pros Remodeling — see if your home qualifies'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function Image({ params }: Props) {
  const { trade } = await params
  const meta = isFunnelSlug(trade) ? getTradeFacts(trade).meta : null

  const background = meta?.ogImage
    ? await readPublicDataUri(meta.ogImage).catch(() => null)
    : null
  const logo = await readPublicDataUri('/company/logo/logo-light-right.png').catch(() => null)
  const fonts = await loadOgFonts()
  const headline = meta?.ogHeadline ?? meta?.title ?? 'Tri Pros Remodeling'

  return new ImageResponse(
    (
      <FunnelOgCard
        background={background}
        logo={logo}
        headline={headline}
        trustLine="Licensed, Bonded & Insured"
      />
    ),
    { ...size, fonts },
  )
}
