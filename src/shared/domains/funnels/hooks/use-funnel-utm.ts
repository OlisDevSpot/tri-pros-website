import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { useEffect } from 'react'
import { funnelUtmKey } from '@/shared/domains/funnels/constants/storage-keys'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'

export interface FunnelUtm {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  fbclid: string | null
  gclid: string | null
}

export const EMPTY_UTM: FunnelUtm = {
  source: null,
  medium: null,
  campaign: null,
  content: null,
  term: null,
  fbclid: null,
  gclid: null,
}

/**
 * Capture-once attribution: reads UTM/click-ids from the URL on mount and
 *  persists per funnel so they survive the multi-step flow + refresh.
 */
export function useFunnelUtm(slug: FunnelSlug): FunnelUtm {
  const [utm, setUtm] = usePersistedState<FunnelUtm>(funnelUtmKey(slug), EMPTY_UTM)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const p = new URLSearchParams(window.location.search)
    const captured: FunnelUtm = {
      source: p.get('utm_source'),
      medium: p.get('utm_medium'),
      campaign: p.get('utm_campaign'),
      content: p.get('utm_content'),
      term: p.get('utm_term'),
      fbclid: p.get('fbclid'),
      gclid: p.get('gclid'),
    }
    // Only overwrite if this visit carries attribution — don't wipe a prior
    // capture on an internal refresh with a clean URL.
    const hasAny = Object.values(captured).some(Boolean)
    if (hasAny) {
      setUtm(captured)
    }
  }, [setUtm])

  return utm
}
