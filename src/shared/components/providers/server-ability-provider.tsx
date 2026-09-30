'use client'

import type { UserRole } from '@/shared/constants/enums'

import { useMemo, useState } from 'react'

import { useSession } from '@/shared/domains/auth/client'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { AbilityContext } from '@/shared/domains/permissions/context'

interface ServerAbilityProviderProps {
  /** The user from the session the server already read for this request; null when signed out. */
  user: { id: string, role: UserRole } | null
  children: React.ReactNode
}

/**
 * Overrides the root `AbilityProvider` below a server layout that has read the session. The root
 * provider builds the ability from the browser's session fetch, which lands after hydration, so
 * gated UI renders signed-out in the HTML and pops in late. Seeded here, it is in the first paint
 * and hydrates against the same ability. The layout outlives its request, so once the browser's
 * session read lands it takes over: a role change, a ban or an expired session shows without a reload.
 *
 * `isPending` is not "first read": better-auth raises it again on every refetch while its data is
 * null, so after a sign-out it would bring the server's stale user back. And a 5xx or network
 * failure settles with null data, which is not a sign-out. So the last settled answer is kept:
 * the seed until the first read lands, then each successful or 401 read, never a failed one.
 */
export function ServerAbilityProvider({ user, children }: ServerAbilityProviderProps) {
  const session = useSession()
  const [known, setKnown] = useState(user)

  const readFailed = session.error != null && session.error.status !== 401
  if (!session.isPending && !readFailed) {
    const read = session.data?.user ?? null
    if (read?.id !== known?.id || read?.role !== known?.role) {
      setKnown(read ? { id: read.id, role: read.role } : null)
    }
  }

  const userId = known?.id ?? null
  const userRole = known?.role ?? null
  const ability = useMemo(
    () => defineAbilitiesFor(userId && userRole ? { id: userId, role: userRole } : null),
    [userId, userRole],
  )

  return (
    <AbilityContext value={ability}>
      {children}
    </AbilityContext>
  )
}
