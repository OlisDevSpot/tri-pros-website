import type { QBTokenResponse } from '@/shared/services/providers/quickbooks/types'
import { Buffer } from 'node:buffer'
import { NextResponse } from 'next/server'
import { QB_TOKEN_URL } from '@/shared/services/providers/quickbooks/constants'
import { upsertTokens } from '@/shared/services/providers/quickbooks/lib/access-token-cache'
import { getQuickbooksConfig } from '@/shared/services/providers/quickbooks/lib/config'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')

  if (!code || !realmId) {
    return NextResponse.json(
      { error: 'Missing code or realmId query parameters' },
      { status: 400 },
    )
  }

  const { clientId, clientSecret, redirectUri } = getQuickbooksConfig()
  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
  ).toString('base64')

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    return NextResponse.json(
      { error: `Token exchange failed: ${error}` },
      { status: 500 },
    )
  }

  const data = await res.json() as QBTokenResponse
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await upsertTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId,
    expiresAt,
  })

  return NextResponse.json({
    success: true,
    message: 'QuickBooks connected successfully',
    realmId,
  })
}
