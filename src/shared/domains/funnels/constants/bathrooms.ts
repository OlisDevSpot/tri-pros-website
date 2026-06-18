import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Bathroom Showcase funnel. Stub: metadata only; Plan 2b/4 fills steps. */
export const bathroomsFunnel: FunnelSpec = {
  slug: 'bathrooms',
  offer: 'showcase',
  title: 'Bathroom Showcase',
  hero: {
    headline: 'A showcase bathroom remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase bathrooms.',
    scarcityLine: 'Limited Showcase spots in your area.',
  },
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'bathroom' },
  steps: [],
}
