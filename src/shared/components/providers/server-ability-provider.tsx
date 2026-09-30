'use client'

import type { UserRole } from '@/shared/constants/enums'

import { useMemo } from 'react'

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
 * and hydrates against the same ability. Signing out does a full page load, so a seeded ability
 * never outlives its session.
 */
export function ServerAbilityProvider({ user, children }: ServerAbilityProviderProps) {
  const userId = user?.id ?? null
  const userRole = user?.role ?? null
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
