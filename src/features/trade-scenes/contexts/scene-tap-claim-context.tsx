'use client'

import type { ReactNode } from 'react'

import { createContext, useEffect, useState } from 'react'

export interface SceneTapClaim {
  // A tap on the house that answers itself (a part emphasised, the pins a spot shows) keeps the tap-away from undoing it.
  claimTap: () => void
  claimed: () => boolean
}

export const SceneTapClaimContext = createContext<SceneTapClaim | null>(null)

interface SceneTapClaimProviderProps {
  children: ReactNode
}

export function createTapClaim(): SceneTapClaim & { release: () => void } {
  let held = false
  return {
    claimTap: () => {
      held = true
    },
    claimed: () => held,
    release: () => {
      held = false
    },
  }
}

// A claim lasts one gesture: R3F runs a mesh's onClick on the click that ends a tap, and the tap-away acts on that same
// click after it, so every press starts unclaimed. Captured on the document, so it lands before any press is heard.
export function SceneTapClaimProvider({ children }: SceneTapClaimProviderProps) {
  const [claim] = useState(createTapClaim)
  useEffect(() => {
    document.addEventListener('pointerdown', claim.release, true)
    return () => document.removeEventListener('pointerdown', claim.release, true)
  }, [claim])
  return <SceneTapClaimContext value={claim}>{children}</SceneTapClaimContext>
}
