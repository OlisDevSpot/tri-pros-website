// scripts/meta/lib/client.ts
import { META_GRAPH_BASE_URL } from '@/shared/services/providers/meta/constants'
import { metaEnv } from './env.js'

const BASE_URL = META_GRAPH_BASE_URL

interface MetaErrorShape {
  message: string
  type: string
  code: number
  fbtrace_id: string
  error_subcode?: number
  error_user_msg?: string
  error_user_title?: string
}

export class MetaApiError extends Error {
  constructor(
    public code: number,
    public type: string,
    message: string,
    public fbtrace_id: string,
    public subcode?: number,
    public userMsg?: string,
  ) {
    // Include user-friendly message in the error text when available
    super(userMsg ? `${message} — ${userMsg}` : message)
    this.name = 'MetaApiError'
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  params?: Record<string, string | number | boolean>
  body?: Record<string, unknown>
}

function buildUrl(endpoint: string, params: Record<string, string | number | boolean> = {}): URL {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('access_token', metaEnv.accessToken)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return url
}

async function parseMetaResponse<T>(res: Response): Promise<T> {
  let json: unknown
  try {
    json = await res.json()
  }
  catch {
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
    throw new MetaApiError(err.code, err.type, err.message, err.fbtrace_id, err.error_subcode, err.error_user_msg)
  }

  return json as T
}

export async function metaFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', params = {}, body } = options

  const res = await fetch(buildUrl(endpoint, params).toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  return parseMetaResponse<T>(res)
}

/**
 * Multipart POST for Graph file endpoints (e.g. /advideos). metaFetch sends
 * JSON, which file uploads reject — this sends FormData and lets fetch set the
 * multipart boundary header. Same URL/auth construction and error handling.
 */
export async function metaUpload<T>(endpoint: string, form: FormData): Promise<T> {
  const res = await fetch(buildUrl(endpoint).toString(), { method: 'POST', body: form })
  return parseMetaResponse<T>(res)
}
