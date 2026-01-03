import { serialize } from 'cookie'

export function getCookiesFromHeaders(headers: Headers) {
  return headers.get('cookie')
    ?.split('; ')
    .map(cookie => cookie.split('='))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}) as Record<string, string>
}

interface SetCookieParams {
  name: string
  value: string
  options?: Partial<Parameters<typeof serialize>>
}

export function appendSetCookieHeader(headers: Headers, { name, value, options }: SetCookieParams) {
  headers.append('Set-Cookie', serialize(name, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    ...options,
  }))
}
