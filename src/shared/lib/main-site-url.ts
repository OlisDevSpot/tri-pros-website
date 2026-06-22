// see ../../../docs/codebase-conventions/urls-and-origins.md
import { SUBDOMAIN_LABELS } from '@/shared/config/subdomains'

/**
 * Absolute URL on the MAIN SITE (the apex app), built from wherever the user
 * currently is. On a subdomain (e.g. kitchens.localhost:3000) it strips the
 * registered subdomain label to return to the apex; on the apex it's a no-op.
 * Reads the live origin, so it is automatically correct across dev, any
 * worktree port, the https tunnel, and prod. Client-only; SSR falls back to
 * NEXT_PUBLIC_BASE_URL. For a link that must be reachable from a server
 * context, use publicUrl() instead. see ../config/subdomains.ts
 */
export function mainSiteUrl(path?: string): string {
  const origin = resolveMainSiteOrigin()
  return path ? `${origin}${path}` : origin
}

function resolveMainSiteOrigin(): string {
  if (typeof window === 'undefined') {
    // eslint-disable-next-line node/prefer-global/process
    return process.env.NEXT_PUBLIC_BASE_URL ?? ''
  }
  const { protocol, host } = window.location
  const [label, ...rest] = host.split('.')
  const apexHost = rest.length > 0 && SUBDOMAIN_LABELS.includes(label) ? rest.join('.') : host
  return `${protocol}//${apexHost}`
}
