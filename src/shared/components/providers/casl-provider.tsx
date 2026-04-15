'use client'

// ─── AbilityProvider ────────────────────────────────────────────────────────
// Reads the current session and builds a CASL ability from it.
// Wraps the app so any component can call useAbility().
//
// How it works:
// 1. useSession() gives us the current user (or null)
// 2. defineAbilitiesFor() converts user → CASL ability
// 3. useMemo ensures we only rebuild when the user changes
// 4. AbilityContext.Provider makes it available to all children

import { useMemo } from 'react'
import { useSession } from '@/shared/domains/auth/client'

import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { AbilityContext } from '@/shared/domains/permissions/context'

export function AbilityProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const userId = session.data?.user?.id ?? null
  const userRole = session.data?.user?.role ?? null

  // Rebuild ability only when user id or role actually changes (primitives).
  // Using the user object directly would cause rebuilds on every session
  // refetch since better-auth returns a new object reference each time.
  const ability = useMemo(
    () => defineAbilitiesFor(userId ? { id: userId, role: userRole! } : null),
    [userId, userRole],
  )

  return (
    <AbilityContext value={ability}>
      {children}
    </AbilityContext>
  )
}
