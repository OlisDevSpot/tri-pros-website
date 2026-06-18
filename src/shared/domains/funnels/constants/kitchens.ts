import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Kitchen Showcase funnel. Stub: content + theme only; Plan 2 fills steps/flow. */
export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  content: {
    title: 'Kitchen Showcase',
    headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase kitchens.',
    scarcityLine: 'We’re selecting 5 kitchens in your area.',
  },
  theme: { accent: 'primary' },
  steps: [],
  flow: () => null,
  pixel: { contentCategory: 'kitchen' },
}
