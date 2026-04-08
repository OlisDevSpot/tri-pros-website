import env from '@/shared/config/server-env'
import { ZOHO_ACCOUNTS_URL } from '../constants'
import { getCachedAccessToken, setCachedAccessToken } from './access-token-cache'

export async function getZohoAccessToken(): Promise<string> {
  const cached = getCachedAccessToken()
  if (cached)
    return cached

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ZOHO_SIGN_CLIENT_ID,
      client_secret: env.ZOHO_SIGN_CLIENT_SECRET,
      refresh_token: env.ZOHO_SIGN_REFRESH_TOKEN,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Zoho Sign token refresh failed: ${error}`)
  }

  const data = await res.json() as { access_token: string, expires_in: number }
  setCachedAccessToken(data.access_token, data.expires_in * 1000)
  return data.access_token
}
