import { QB_API_MINOR_VERSION, QB_BASE_URL } from './constants'
import { getQBAccessToken } from './lib/get-access-token'

export async function qbRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken, realmId } = await getQBAccessToken()
  const separator = path.includes('?') ? '&' : '?'
  const url = `${QB_BASE_URL}/v3/company/${realmId}${path}${separator}minorversion=${QB_API_MINOR_VERSION}`

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`QuickBooks API error (${res.status}): ${error}`)
  }

  return res.json() as Promise<T>
}
