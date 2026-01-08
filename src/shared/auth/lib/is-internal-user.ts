import type { BetterAuthUser } from '../server'

export function isInternalUser(user: BetterAuthUser | undefined) {
  return user?.role === 'agent' || user?.role === 'super-admin'
}
