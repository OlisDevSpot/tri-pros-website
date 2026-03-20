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
import { useSession } from '@/shared/auth/client'

import { defineAbilitiesFor } from '../../permissions/abilities'
import { AbilityContext } from '../../permissions/context'

export function AbilityProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const user = session.data?.user ?? null

  // Rebuild ability when user identity or role changes.
  // useMemo prevents unnecessary rebuilds on every render.
  const ability = useMemo(
    () => defineAbilitiesFor(user ? { id: user.id, role: user.role } : null),
    [user],
  )

  return (
    <AbilityContext value={ability}>
      {children}
    </AbilityContext>
  )
}
