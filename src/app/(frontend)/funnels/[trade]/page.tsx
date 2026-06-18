import { notFound } from 'next/navigation'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function FunnelPage({ params }: Props) {
  const { trade } = await params

  // Only the three canonical funnel slugs resolve; anything else 404s.
  if (!isFunnelSlug(trade)) {
    notFound()
  }

  const funnel = getFunnel(trade)

  // Plan 2 replaces this shell with the multi-step funnel engine.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold" data-funnel-slug={funnel.slug}>
        {funnel.content.title}
      </h1>
      <p className="text-muted-foreground mt-2">{funnel.content.subhead}</p>
    </main>
  )
}
