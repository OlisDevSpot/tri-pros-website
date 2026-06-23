import { ImageResponse } from 'next/og'
import { publicUrl } from '@/shared/config/public-url'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { fetchAsDataUri } from '@/shared/domains/funnels/lib/og/fetch-as-data-uri'
import { loadOgFonts } from '@/shared/domains/funnels/lib/og/load-og-fonts'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
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
  const spec = isFunnelSlug(trade) ? getFunnel(trade) : null

  const bgPath = spec?.meta.ogImage ?? spec?.hero.media?.src ?? null
  const background = bgPath
    ? await fetchAsDataUri(publicUrl(bgPath)).catch(() => null)
    : null
  const logo = await fetchAsDataUri(publicUrl('/company/logo/logo-light-512.png')).catch(() => null)
  const fonts = await loadOgFonts()
  const headline = spec?.meta.ogHeadline ?? spec?.hero.headline ?? 'Tri Pros Remodeling'

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
