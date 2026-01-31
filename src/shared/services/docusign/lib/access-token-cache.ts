let cachedToken: {
  accessToken: string
  expiresAt: number
} | null = null

export function getCachedAccessToken() {
  if (!cachedToken)
    return null
  if (Date.now() > cachedToken.expiresAt)
    return null
  return cachedToken.accessToken
}

export function setCachedAccessToken(accessToken: string, expiresAt: number) {
  cachedToken = {
    accessToken,
    expiresAt: Date.now() + (expiresAt - 300) * 1000, // 5 minutes before expiration
  }
}
