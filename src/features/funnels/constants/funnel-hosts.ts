/**
 * Subdomain label → internal trade slug. Single source of truth for which
 * funnel subdomains exist. Consumed by the subdomain registry
 * (src/shared/config/subdomains.ts) and the `(funnels)/[trade]` route.
 */
export const FUNNEL_SUBDOMAINS = {
  kitchens: 'kitchen',
  bathrooms: 'bathroom',
  interiors: 'interior',
} as const

export type FunnelSubdomain = keyof typeof FUNNEL_SUBDOMAINS
export type FunnelTrade = (typeof FUNNEL_SUBDOMAINS)[FunnelSubdomain]

/** The three valid trade slugs, derived from the map (for runtime validation). */
export const FUNNEL_TRADES = Object.values(FUNNEL_SUBDOMAINS) as FunnelTrade[]
