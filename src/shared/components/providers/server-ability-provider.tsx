'use client'

import type { UserRole } from '@/shared/constants/enums'

import { useMemo } from 'react'

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
 */
export function ServerAbilityProvider({ user, children }: ServerAbilityProviderProps) {
  const session = useSession()
  const current = session.isPending ? user : (session.data?.user ?? null)
  const userId = current?.id ?? null
  const userRole = current?.role ?? null
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
