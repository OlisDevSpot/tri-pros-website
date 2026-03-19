import env from '@/shared/config/server-env'

import 'server-only'

interface RefreshInput {
  refreshToken: string
}

interface RefreshOutput {
  accessToken: string
  expiresAt: Date
}

export async function refreshAccessToken({ refreshToken }: RefreshInput): Promise<RefreshOutput> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error_description?: string, error?: string }
    throw new Error(
      `Failed to refresh Google token: ${error.error_description ?? error.error ?? response.statusText}`,
    )
  }

  const data = await response.json() as { access_token: string, expires_in: number }
  // expires_in is in seconds; Date.now() is in milliseconds
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}
