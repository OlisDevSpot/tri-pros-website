/**
 * Trusted client IP for rate-limiting. Trusts only edge-set headers
 * (`x-vercel-forwarded-for`, `x-real-ip`) — NOT raw `x-forwarded-for`, which a
 * client can spoof to rotate past per-IP limits. Falls back to a fixed key.
 */
export function clientIp(req: Request | undefined): string {
  return req?.headers.get('x-vercel-forwarded-for')
    ?? req?.headers.get('x-real-ip')
    ?? 'anonymous'
}
