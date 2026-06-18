import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Bathroom Showcase funnel. Stub: content + theme only; Plan 2 fills steps/flow. */
export const bathroomsFunnel: FunnelSpec = {
  slug: 'bathrooms',
  content: {
    title: 'Bathroom Showcase',
    headline: 'Get a AAA-grade bathroom remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase bathrooms.',
    scarcityLine: 'We\'re selecting 5 bathrooms in your area.',
    copy: {},
  },
  theme: { accent: 'primary' },
  steps: [],
  pixel: { contentCategory: 'bathroom' },
}
