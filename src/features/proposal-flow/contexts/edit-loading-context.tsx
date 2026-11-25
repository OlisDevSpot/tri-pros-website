'use client'

import type { ReactNode } from 'react'
import { createContext, use } from 'react'

// Defaults to false so the create page, which renders the same fields, needs no provider.
const EditLoadingContext = createContext(false)

export function EditLoadingProvider({ loading, children }: { loading: boolean, children: ReactNode }) {
  return <EditLoadingContext value={loading}>{children}</EditLoadingContext>
}

export function useEditLoading(): boolean {
  return use(EditLoadingContext)
}
