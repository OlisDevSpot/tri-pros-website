/**
 * Canonical funnel slugs. Single source of truth, used identically as the
 * subdomain label, the route segment, the registry key, and the spec key.
 *
 * PURE LEAF — imports nothing. Consumed by the middleware, roots.ts, and
 * subdomains.ts (all shared), so it must never pull in the registry or specs
 * (which transitively reach React UI in Plan 2).
 */
export const FUNNEL_SLUGS = ['kitchens', 'bathrooms', 'complete-interior'] as const

export type FunnelSlug = (typeof FUNNEL_SLUGS)[number]

export function isFunnelSlug(value: string): value is FunnelSlug {
  return (FUNNEL_SLUGS as readonly string[]).includes(value)
}
