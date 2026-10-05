import type { NextRequest } from 'next/server'
import type { UserRole } from '@/shared/constants/enums/user'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
/**
 * DEV-ONLY: mints a real better-auth session for the Playwright MCP browser, because Google
 * blocks OAuth inside automation-controlled browsers. Every guard failure is a 404, not a 403,
 * so the route's existence is never disclosed.
 */
import { serializeCookie, serializeSignedCookie } from 'better-call'
import { NextResponse } from 'next/server'
import { isProductionHost } from '@/shared/config/is-production-host'
import env from '@/shared/config/server-env'
import { userRoles } from '@/shared/constants/enums/user'
import { auth } from '@/shared/domains/auth/server'

const notFound = () => new NextResponse('Not found', { status: 404 })

// timingSafeEqual throws on length mismatch, so guard it first. Only called once DEV_LOGIN_SECRET
// is known set, so timing never reveals whether the secret is configured.
function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length)
    return false
  return timingSafeEqual(bufA, bufB)
}

function sanitizeRedirect(raw: string | null, origin: string): string {
  // Resolve, then compare origins: a naive startsWith('/') is bypassed by //evil.com and /\evil.com (browsers treat \ as /).
  if (raw) {
    try {
      const resolved = new URL(raw, origin)
      if (resolved.origin === origin) {
        return resolved.pathname + resolved.search + resolved.hash
      }
    }
    catch {
      // fall through to default
    }
  }
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const host = request.headers.get('host')

  if (env.VERCEL_ENV === 'production')
    return notFound()
  if (isProductionHost(host))
    return notFound()
  const secret = url.searchParams.get('secret')
  if (!env.DEV_LOGIN_SECRET || !secret || !timingSafeEqualStrings(secret, env.DEV_LOGIN_SECRET))
    return notFound()

  const ctx = await auth.$context
  const adapter = ctx.internalAdapter

  const asEmail = url.searchParams.get('as')
  const roleParam = url.searchParams.get('role')

  if (roleParam && !userRoles.includes(roleParam as UserRole)) {
    return new NextResponse(`Invalid role. One of: ${userRoles.join(', ')}`, {
      status: 400,
    })
  }

  let user: { id: string, role?: string | null } | null = null

  if (asEmail) {
    const found = await adapter.findUserByEmail(asEmail)
    if (!found?.user)
      return notFound()
    user = found.user // keep their real role + data scope
  }
  else {
    const desiredRole: UserRole = (roleParam as UserRole) ?? 'super-admin'
    const email = roleParam
      ? `dev+${roleParam}@triprosremodeling.com`
      : 'info@triprosremodeling.com'
    const name = roleParam ? `Dev ${roleParam}` : 'Oliver (dev)'

    const existing = await adapter.findUserByEmail(email)
    user = existing?.user
      ?? (await adapter.createUser({ email, name, emailVerified: true }))

    // Corporate-domain create hook forces role 'agent'; force desired role now.
    if (user && user.role !== desiredRole) {
      user = await adapter.updateUser(user.id, { role: desiredRole })
    }
  }

  if (!user)
    return notFound()

  const session = await adapter.createSession(user.id)
  const cookie = ctx.authCookies.sessionToken
  const setCookie = await serializeSignedCookie(
    cookie.name,
    session.token,
    ctx.secret,
    { ...cookie.attributes, maxAge: ctx.sessionConfig.expiresIn },
  )

  const redirectPath = sanitizeRedirect(url.searchParams.get('redirect'), url.origin)
  const response = NextResponse.redirect(new URL(redirectPath, url.origin))
  response.headers.append('set-cookie', setCookie)

  // Expire the session-data cache cookie, or the old identity shadows the new session for up to 5 min.
  // `ctx` is the static `auth.$context`, so its cookie attributes lack the per-request `domain`;
  // without a matching Domain the expiry is a different cookie identity and silently fails to clear.
  const dataCookie = ctx.authCookies.sessionData
  response.headers.append(
    'set-cookie',
    serializeCookie(dataCookie.name, '', { ...dataCookie.attributes, domain: url.hostname, maxAge: 0 }),
  )

  return response
}
