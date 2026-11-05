'use client'

import type { ReactNode } from 'react'

import { createContext, use, useMemo, useState } from 'react'

interface SystemCardBottomValue {
  // Stage pixels; null while no system card is drawn.
  bottom: number | null
  setBottom: (bottom: number | null) => void
}

const SystemCardBottomContext = createContext<SystemCardBottomValue | null>(null)

interface SystemCardBottomProviderProps {
  children: ReactNode
}

// Apart from the controls' state: the stage reads the card's bottom to frame the camera, and a keystroke in Modify must not
// re-render the stage and the canvas under it.
export function SystemCardBottomProvider({ children }: SystemCardBottomProviderProps) {
  const [bottom, setBottom] = useState<number | null>(null)
  const value = useMemo(() => ({ bottom, setBottom }), [bottom])
  return <SystemCardBottomContext value={value}>{children}</SystemCardBottomContext>
}

export function useSystemCardBottom(): SystemCardBottomValue {
  const value = use(SystemCardBottomContext)
  if (!value) {
    throw new Error('useSystemCardBottom must be used inside a SystemCardBottomProvider')
  }
  return value
}
