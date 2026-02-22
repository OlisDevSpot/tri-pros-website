'use client'

import { createContext, use, useMemo, useState } from 'react'

interface ScrollRootContextValue {
  rootEl: HTMLElement | null
  setRootEl: (el: HTMLElement | null) => void
}

const ScrollRootContext = createContext<ScrollRootContextValue | null>(null)

export function ScrollRootProvider({ children }: { children: React.ReactNode }) {
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null)
  const value = useMemo(() => ({ rootEl, setRootEl }), [rootEl])
  return (
    <ScrollRootContext value={value}>
      {children}
    </ScrollRootContext>
  )
}

export function useScrollRoot() {
  const ctx = use(ScrollRootContext)
  if (!ctx)
    throw new Error('useScrollRoot must be used within ScrollRootProvider')
  return ctx
}
