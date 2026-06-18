import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Complete-Interior Showcase funnel. Stub: metadata only; Plan 2b/4 fills steps. */
export const completeInteriorFunnel: FunnelSpec = {
  slug: 'complete-interior',
  offer: 'showcase',
  title: 'Complete-Interior Showcase',
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'complete-interior' },
  steps: [],
}
