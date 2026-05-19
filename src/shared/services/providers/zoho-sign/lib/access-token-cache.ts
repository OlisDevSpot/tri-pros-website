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

export function setCachedAccessToken(accessToken: string, expiresInMs: number) {
  cachedToken = {
    accessToken,
    expiresAt: Date.now() + expiresInMs - 300_000,
  }
}
