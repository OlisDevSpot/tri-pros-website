'use client'

import type { ReactNode } from 'react'

import { createContext, use, useMemo, useState } from 'react'

interface CockpitOpenValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const CockpitOpenContext = createContext<CockpitOpenValue | null>(null)

// Its own provider, so a toggle re-renders the button and the sheet and never the document passed in as children.
export function CockpitOpenProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return <CockpitOpenContext value={value}>{children}</CockpitOpenContext>
}

export function useCockpitOpen(): CockpitOpenValue {
  const value = use(CockpitOpenContext)
  if (!value) {
    throw new Error('useCockpitOpen needs a <CockpitOpenProvider> above it')
  }
  return value
}
