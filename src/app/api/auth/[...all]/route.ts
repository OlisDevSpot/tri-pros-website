import { toNextJsHandler } from 'better-auth/next-js'
import { APP_HOSTS } from '@/shared/config/roots'
import { auth } from '@/shared/domains/auth/server'

const handler = toNextJsHandler(auth)
const TUNNEL_HOSTS: readonly string[] = APP_HOSTS.tunnel

// Next builds request.url from its own listen address (localhost:PORT), not the
// host the browser used, and oAuthProxy hands a relayed sign-in back to
// request.url's origin: behind the ngrok tunnel it would send the phone to
// https://localhost:PORT. Only our own tunnel's forwarded host is honoured, so a
// made-up x-forwarded-host can never steer where a sign-in is handed back.
async function withForwardedOrigin(request: Request): Promise<Request> {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const url = new URL(request.url)
  if (!forwardedHost || forwardedHost === url.host || !TUNNEL_HOSTS.includes(forwardedHost)) {
    return request
  }
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const protocol = forwardedProto === 'http' || forwardedProto === 'https' ? `${forwardedProto}:` : url.protocol
  const publicURL = new URL(`${url.pathname}${url.search}`, `${protocol}//${forwardedHost}`)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  return new Request(publicURL, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    signal: request.signal,
  })
}

export async function GET(request: Request) {
  return handler.GET(await withForwardedOrigin(request))
}

export async function POST(request: Request) {
  return handler.POST(await withForwardedOrigin(request))
}
