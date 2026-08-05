import type { NextRequest } from 'next/server'
import type { UserRole } from '@/shared/constants/enums/user'
/**
 * ⚠️ DEV-ONLY OAuth-bypass login for the Playwright MCP browser. ⚠️
 *
 * The app's only interactive login is "Sign in with Google" (better-auth,
 * google-only). Google blocks OAuth inside automation-controlled browsers, so
 * the Playwright MCP browser cannot sign in the normal way. This route mints a
 * real better-auth session directly (our DB, our secret) and sets the session
 * cookie, letting the automated browser reach authenticated pages.
 *
 * It is the ENTIRE security boundary that keeps this out of production:
 *   1. env.VERCEL_ENV !== 'production'
 *   2. request host is not a production host (is-production-host)
 *   3. ?secret= matches env.DEV_LOGIN_SECRET (must be set + non-empty)
 * Any failure returns 404 (not 403) so the route's existence is never disclosed.
 *
 * Ritual: the Playwright browser navigates here FIRST each session, then works
 * authenticated. see docs/codebase-conventions/dev-auth-route.md
 */
import { serializeSignedCookie } from 'better-call'
import { NextResponse } from 'next/server'
import { isProductionHost } from '@/shared/config/is-production-host'
import env from '@/shared/config/server-env'
import { userRoles } from '@/shared/constants/enums/user'
import { auth } from '@/shared/domains/auth/server'

const notFound = () => new NextResponse('Not found', { status: 404 })

function sanitizeRedirect(raw: string | null): string {
  // relative paths only — reject absolute/protocol-relative to prevent open redirect
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const host = request.headers.get('host')

  // --- Guards (all required) ---
  if (env.VERCEL_ENV === 'production')
    return notFound()
  if (isProductionHost(host))
    return notFound()
  const secret = url.searchParams.get('secret')
  if (!env.DEV_LOGIN_SECRET || secret !== env.DEV_LOGIN_SECRET)
    return notFound()

  const ctx = await auth.$context
  const adapter = ctx.internalAdapter

  // --- Resolve target user: as > role > default ---
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

  // --- Mint session + set signed cookie (same as better-auth setSessionCookie) ---
  const session = await adapter.createSession(user.id)
  const cookie = ctx.authCookies.sessionToken
  const setCookie = await serializeSignedCookie(
    cookie.name,
    session.token,
    ctx.secret,
    { ...cookie.attributes, maxAge: ctx.sessionConfig.expiresIn },
  )

  const redirectPath = sanitizeRedirect(url.searchParams.get('redirect'))
  const response = NextResponse.redirect(new URL(redirectPath, url.origin))
  response.headers.append('set-cookie', setCookie)
  return response
}
