// scripts/meta/lib/client.ts
import { metaEnv } from './env.js'

const API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

interface MetaErrorShape {
  message: string
  type: string
  code: number
  fbtrace_id: string
}

export class MetaApiError extends Error {
  constructor(
    public code: number,
    public type: string,
    message: string,
    public fbtrace_id: string,
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  params?: Record<string, string | number | boolean>
  body?: Record<string, unknown>
}

export async function metaFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', params = {}, body } = options

  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('access_token', metaEnv.accessToken)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new MetaApiError(
      res.status,
      'ParseError',
      `Meta API returned non-JSON response (HTTP ${res.status} ${res.statusText})`,
      '',
    )
  }

  if (!res.ok || (typeof json === 'object' && json !== null && 'error' in json)) {
    const err = (json as { error?: MetaErrorShape }).error
    if (!err) {
      throw new MetaApiError(res.status, 'UnknownError', `Meta API error (HTTP ${res.status})`, '')
    }
    throw new MetaApiError(err.code, err.type, err.message, err.fbtrace_id)
  }

  return json as T
}
