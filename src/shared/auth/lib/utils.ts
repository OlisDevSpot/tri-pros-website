import { auth } from '@/shared/auth/server'

export async function requireAuth(headers: Headers, onNotAuthenticated: () => void) {
  const session = await auth.api.getSession({
    headers,
  })

  if (!session) {
    onNotAuthenticated()
  }

  return session
}

export async function requireUnauth(headers: Headers, onAuthenticated: () => void) {
  const session = await auth.api.getSession({
    headers,
  })

  if (session) {
    onAuthenticated()
  }
}
