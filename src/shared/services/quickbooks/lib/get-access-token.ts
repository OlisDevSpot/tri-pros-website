import type { QBTokenResponse } from '../types'
import { Buffer } from 'node:buffer'
import env from '@/shared/config/server-env'
import { QB_TOKEN_URL } from '../constants'
import { getStoredTokens, upsertTokens } from './access-token-cache'

let inflightRefresh: Promise<{ accessToken: string, realmId: string }> | null = null

async function refreshToken(): Promise<{ accessToken: string, realmId: string }> {
  const stored = await getStoredTokens()

  if (!stored) {
    throw new Error('No QuickBooks tokens found. Complete OAuth setup at /api/quickbooks/callback first.')
  }

  const expiresAt = new Date(stored.expiresAt).getTime()
  const isExpired = Date.now() > expiresAt - 300_000

  if (!isExpired) {
    return { accessToken: stored.accessToken, realmId: stored.realmId }
  }

  const credentials = Buffer.from(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`).toString('base64')

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`QuickBooks token refresh failed: ${error}`)
  }

  const data = await res.json() as QBTokenResponse
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await upsertTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId: stored.realmId,
    expiresAt: newExpiresAt,
  })

  return { accessToken: data.access_token, realmId: stored.realmId }
}

export async function getQBAccessToken(): Promise<{ accessToken: string, realmId: string }> {
  if (inflightRefresh) {
    return inflightRefresh
  }

  inflightRefresh = refreshToken().finally(() => {
    inflightRefresh = null
  })

  return inflightRefresh
}
