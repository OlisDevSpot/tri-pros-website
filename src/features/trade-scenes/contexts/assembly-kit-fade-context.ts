'use client'

import type { RefObject } from 'react'

import { createContext, use } from 'react'

// The host's crossfade, live 0..1: read in useFrame only, so the fade never re-renders a part.
export const AssemblyKitFadeContext = createContext<RefObject<number>>({ current: 1 })

export function useAssemblyKitFade(): RefObject<number> {
  return use(AssemblyKitFadeContext)
}
