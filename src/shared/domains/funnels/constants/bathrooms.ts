import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Bathroom Showcase funnel. Stub: metadata only; Plan 2b/4 fills steps. */
export const bathroomsFunnel: FunnelSpec = {
  slug: 'bathrooms',
  offer: 'showcase',
  title: 'Bathroom Showcase',
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'bathroom' },
  steps: [],
}
