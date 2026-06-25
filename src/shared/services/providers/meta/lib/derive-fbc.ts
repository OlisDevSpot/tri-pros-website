/**
 * Resolve Meta's `fbc` click identifier for CAPI, reconstructing it from a raw
 * `fbclid` when the browser `_fbc` cookie is absent.
 *
 * The pixel writes `_fbc` only when it actually runs — on a mobile-only funnel,
 * iOS Safari ITP and ad blockers frequently suppress it, even though the click
 * carried an `fbclid` we already persisted from the URL. Without `fbc`, Meta
 * loses the strongest click-attribution signal. Meta's documented cookie format
 * is `fb.<subdomainIndex>.<creationUnixMs>.<fbclid>`; `subdomainIndex` is 1 for
 * the registrable domain and reconstruction with the current timestamp is the
 * vendor-sanctioned fallback (the `fbclid` is the load-bearing part — the
 * timestamp only needs to be when we observed the click).
 *
 * Pure + primitive-only so it crosses the server-only provider boundary cleanly.
 */
export function deriveFbc(args: {
  fbc?: string | null
  fbclid?: string | null
  nowMs: number
}): string | null {
  if (args.fbc) {
    return args.fbc
  }
  if (args.fbclid) {
    return `fb.1.${args.nowMs}.${args.fbclid}`
  }
  return null
}
