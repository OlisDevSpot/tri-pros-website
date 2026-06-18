import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

/** localStorage key for a funnel's resumable engine state. */
export function funnelStateKey(slug: FunnelSlug): string {
  return `tri-pros:funnel:${slug}`
}
