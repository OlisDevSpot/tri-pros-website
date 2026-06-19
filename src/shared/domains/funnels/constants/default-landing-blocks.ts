import type { MarketingBlock } from '@/shared/domains/funnels/types'

/**
 * Default ordered landing blocks, used when a FunnelSpec omits `landing`.
 * A funnel may override by setting its own `landing.blocks` (defaults-with-override).
 */
export const DEFAULT_LANDING_BLOCKS: MarketingBlock[] = [
  { kind: 'reviews', content: { rating: 4.9, count: 200 } },
  { kind: 'portfolio', content: { title: 'Recent projects in your area' } },
  { kind: 'testimonials', content: { title: 'What homeowners say' } },
  {
    kind: 'guarantee',
    content: {
      body: 'Every Showcase project is backed by our workmanship guarantee.',
      headline: 'Showcase-grade work, guaranteed',
      scarcityLine: 'Limited Showcase spots remain this month.',
    },
  },
  { kind: 'licensing', content: {} },
]
