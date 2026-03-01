import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import jwt from 'jsonwebtoken'
import env from '@/shared/config/server-env'
import { DS_OAUTH_BASE_URL } from '../constants'
import { getCachedAccessToken, setCachedAccessToken } from './access-token-cache'

export async function getAccessToken() {
  const cachedToken = getCachedAccessToken()
  if (cachedToken) {
    return cachedToken
  }

  const privateKey = env.NODE_ENV === 'production'
    ? Buffer.from(env.DS_JWT_PRIVATE_KEY, 'base64').toString('utf-8')
    : await fs.readFile(
        env.DS_JWT_PRIVATE_KEY_PATH,
        'utf-8',
      )

  const now = Math.floor(Date.now() / 1000)

  const assertion = jwt.sign(
    {
      iss: env.DS_INTEGRATION_KEY,
      sub: env.DS_USER_ID,
      aud: DS_OAUTH_BASE_URL,
      iat: now,
      exp: now + 3600,
      scope: 'signature impersonation',
    },
    privateKey,
    {
      algorithm: 'RS256',
    },
  )

  const res = await fetch(`https://${DS_OAUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    const error = await res.json() as { error: string, error_description: string }
    throw new Error(error.error_description)
  }

  const data = await res.json() as { access_token: string, expires_in: number }

  setCachedAccessToken(data.access_token, data.expires_in)

  return data.access_token // access_token, expires_in
}
