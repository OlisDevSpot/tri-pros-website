import type { QBTokenResponse } from '@/shared/services/quickbooks/types'
import { Buffer } from 'node:buffer'
import { NextResponse } from 'next/server'
import env from '@/shared/config/server-env'
import { QB_TOKEN_URL } from '@/shared/services/quickbooks/constants'
import { upsertTokens } from '@/shared/services/quickbooks/lib/access-token-cache'

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

  const credentials = Buffer.from(
    `${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`,
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
      redirect_uri: env.QB_REDIRECT_URI,
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
