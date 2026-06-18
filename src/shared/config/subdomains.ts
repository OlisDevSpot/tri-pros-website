import { FUNNEL_SUBDOMAINS } from '@/features/funnels/constants/funnel-hosts'
import { ROOTS } from '@/shared/config/roots'

/**
 * Single source of truth: subdomain label → internal base path the
 * middleware rewrites to. Adding a new subdomain = one entry here.
 *
 * `voip` is intentionally NOT registered yet — the `/voip` route group does
 * not exist. When it does, add: `voip: ROOTS.voip.root(),`
 */
export const SUBDOMAIN_ROUTES: Record<string, string> = Object.fromEntries(
  Object.entries(FUNNEL_SUBDOMAINS).map(([sub, trade]) => [sub, ROOTS.funnels.trade(trade)]),
)
