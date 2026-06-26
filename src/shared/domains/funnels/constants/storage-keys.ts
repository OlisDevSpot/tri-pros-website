import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { STORAGE_KEY_PREFIX } from '@/shared/constants/storage-keys'

/**
 * Schema/order version for a funnel's persisted engine state. BUMP THIS whenever
 * step order or the answer shape changes: the key changes with it, so every
 * visitor's stale state (which could resume onto the wrong/old step) is
 * abandoned and the funnel restarts clean. v2: homeowner question moved to Q1.
 */
const FUNNEL_STATE_VERSION = 2

/** localStorage key for a funnel's resumable engine state (version-scoped). */
export function funnelStateKey(slug: FunnelSlug): string {
  return `${STORAGE_KEY_PREFIX}funnel:v${FUNNEL_STATE_VERSION}:${slug}`
}

/** localStorage key for a funnel's captured UTM attribution. */
export function funnelUtmKey(slug: FunnelSlug): string {
  return `${STORAGE_KEY_PREFIX}funnel-utm:${slug}`
}
