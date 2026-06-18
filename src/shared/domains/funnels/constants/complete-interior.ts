import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Complete-Interior Showcase funnel. Stub: content + theme only; Plan 2 fills steps/flow. */
export const completeInteriorFunnel: FunnelSpec = {
  slug: 'complete-interior',
  content: {
    title: 'Complete-Interior Showcase',
    headline: 'Get a AAA-grade whole-interior remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Complete-Interior Showcase spots.',
    scarcityLine: 'We’re selecting 5 homes in your area.',
  },
  theme: { accent: 'primary' },
  steps: [],
  flow: () => null,
  pixel: { contentCategory: 'complete-interior' },
}
