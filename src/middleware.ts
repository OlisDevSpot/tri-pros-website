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
  // Page requests only. Skip API, the image optimizer, SW, AND any path with a
  // file extension (`.*\\..*`) — i.e. everything served from /public (images,
  // fonts, etc.). Without the extension guard, a subdomain rewrite prepends the
  // basePath to static-asset requests (e.g. /funnels/kitchens/before-1.webp →
  // /funnels/kitchens/funnels/kitchens/before-1.webp) and they 404.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|.*\\..*).*)'],
}
