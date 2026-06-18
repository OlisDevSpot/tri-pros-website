import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SUBDOMAIN_ROUTES } from '@/shared/config/subdomains'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const subdomain = host.split('.')[0]
  const basePath = SUBDOMAIN_ROUTES[subdomain]

  // Apex, www, localhost, or any unregistered host → untouched.
  if (!basePath) {
    return NextResponse.next()
  }

  // Registered subdomain → rewrite, preserving any sub-path. URL bar unchanged.
  //   kitchens.tripros.com/        → /funnels/kitchen
  //   kitchens.tripros.com/thanks  → /funnels/kitchen/thanks
  const url = request.nextUrl.clone()
  url.pathname = `${basePath}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Page requests only — skip API, static assets, image optimizer, SW.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)'],
}
