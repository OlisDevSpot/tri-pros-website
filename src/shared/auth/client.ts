import type { auth } from './server'
import { genericOAuthClient, inferAdditionalFields, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const {
  useSession,
  signOut,
  signIn,
  signUp,
  updateUser,
  oauth2,
  getAccessToken,
  listAccounts,
  unlinkAccount,
} = createAuthClient({
  // eslint-disable-next-line node/prefer-global/process
  baseURL: process.env.NEXT_PUBLIC_BASE_URL!,
  plugins: [
    organizationClient(),
    inferAdditionalFields<typeof auth>(),
    genericOAuthClient(),
  ],
  fetchOptions: {
    credentials: 'include',
  },
})
