import { Buffer } from 'node:buffer'
import 'server-only'

/**
 * Fetch an absolute image URL and return a base64 data URI Satori can embed.
 * Throws on non-2xx so callers can fall back to the brand gradient.
 */
export async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`OG asset ${url} → ${res.status}`)
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
  return `data:${contentType};base64,${base64}`
}
