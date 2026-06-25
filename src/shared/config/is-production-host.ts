import { APP_HOSTS } from '@/shared/config/roots'

/**
 * True only when the request is served from the real production domain — the
 * apex, `www`, or any funnel subdomain of a `APP_HOSTS.prod` entry.
 *
 * Host-based on purpose: `process.env.NODE_ENV` is `'production'` for Vercel
 * PREVIEW builds too, so it cannot tell preview from prod. The request host can.
 * `localhost`, `*.localhost`, the ngrok tunnel, and `*.vercel.app` previews all
 * return false. `APP_HOSTS.prod` (roots.ts) is the single source of truth — add
 * a new production registrable domain there, not here.
 */
export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) {
    return false
  }
  const hostname = host.split(':')[0].toLowerCase()
  return APP_HOSTS.prod.some(
    prod => hostname === prod || hostname.endsWith(`.${prod}`),
  )
}
