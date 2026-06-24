import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Complete-Interior Showcase funnel. Stub: metadata only; Plan 2b/4 fills steps. */
export const completeInteriorFunnel: FunnelSpec = {
  slug: 'complete-interior',
  offer: 'showcase',
  title: 'Complete-Interior Showcase',
  hero: {
    headline: 'A complete-interior remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Complete-Interior Showcase projects.',
    scarcityLine: 'Limited Showcase spots in your area.',
  },
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'complete-interior' },
  steps: [],
}
