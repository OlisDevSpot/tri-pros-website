// see ../../../docs/codebase-conventions/urls-and-origins.md
import { ROOTS } from '@/shared/config/roots'
import { FUNNEL_SLUGS } from '@/shared/domains/funnels/constants/slugs'

/**
 * Single source of truth: subdomain label → internal base path the
 * middleware rewrites to. Adding a new funnel subdomain = one slug in
 * FUNNEL_SLUGS (src/shared/domains/funnels/constants/slugs.ts).
 *
 * `voip` is intentionally NOT registered yet — the `/voip` route group does
 * not exist. When it does, add: `voip: ROOTS.voip.root(),`
 */
export const SUBDOMAIN_ROUTES: Record<string, string> = Object.fromEntries(
  FUNNEL_SLUGS.map(slug => [slug, ROOTS.funnels.trade(slug)]),
)

/**
 * The subdomain labels that, if leading the host, mean we're on a subdomain
 * (the inverse of what the middleware rewrites). Consumed by `mainSiteUrl` to
 * strip back to the apex. Same source of truth as the middleware.
 */
export const SUBDOMAIN_LABELS = Object.keys(SUBDOMAIN_ROUTES)
