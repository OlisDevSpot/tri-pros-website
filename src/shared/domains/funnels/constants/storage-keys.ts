import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { STORAGE_KEY_PREFIX } from '@/shared/constants/storage-keys'

/** localStorage key for a funnel's resumable engine state. */
export function funnelStateKey(slug: FunnelSlug): string {
  return `${STORAGE_KEY_PREFIX}funnel:${slug}`
}

/** localStorage key for a funnel's captured UTM attribution. */
export function funnelUtmKey(slug: FunnelSlug): string {
  return `${STORAGE_KEY_PREFIX}funnel-utm:${slug}`
}
