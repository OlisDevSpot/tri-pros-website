import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { STORAGE_KEY_PREFIX } from '@/shared/constants/storage-keys'

/**
 * Per-funnel schema/order version for persisted engine state. BUMP A FUNNEL'S
 * entry whenever its step order or answer shape changes: the key changes with
 * it, so every visitor's stale state (which could resume onto the wrong/old
 * step) is abandoned and that funnel restarts clean. Versions are per-funnel so
 * bumping one never resets the others. Use minor bumps (2 → 2.01) for ordinary
 * reorders/copy-shape changes; reserve major bumps for sweeping rewrites.
 *
 * History:
 * - v2:    homeowner question moved to Q1 (all funnels).
 * - v2.01: kitchens & bathrooms — ZIP moved to Q2, home-type to Q3 (before PII),
 *          and the trade question moved to the first post-PII enrichment step.
 */
const FUNNEL_STATE_VERSION: Record<FunnelSlug, string> = {
  'kitchens': '2.01',
  'bathrooms': '2.01',
  'complete-interior': '2',
}

/** localStorage key for a funnel's resumable engine state (version-scoped). */
export function funnelStateKey(slug: FunnelSlug): string {
  return `${STORAGE_KEY_PREFIX}funnel:v${FUNNEL_STATE_VERSION[slug]}:${slug}`
}

/** localStorage key for a funnel's captured UTM attribution. */
export function funnelUtmKey(slug: FunnelSlug): string {
  return `${STORAGE_KEY_PREFIX}funnel-utm:${slug}`
}
