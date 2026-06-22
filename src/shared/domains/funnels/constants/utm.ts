import type { FunnelUtm } from '@/shared/domains/funnels/types'

/**
 * The zero-value attribution shape — no UTM/click-ids captured. Hook-free so
 * server code (e.g. lead handlers, the /test proof route) can import it without
 * pulling the client `useFunnelUtm` hook (and its `useEffect`) into the server
 * graph. The hook lives in `hooks/use-funnel-utm.ts`.
 */
export const EMPTY_UTM: FunnelUtm = {
  source: null,
  medium: null,
  campaign: null,
  content: null,
  term: null,
  fbclid: null,
  gclid: null,
}
