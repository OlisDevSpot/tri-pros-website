'use client'

import type { ReactNode } from 'react'

import { createContext, use } from 'react'

const ShortcutSheetContext = createContext<(() => void) | null>(null)

interface ShortcutSheetProviderProps {
  openSheet: () => void
  children: ReactNode
}

// The stage holds the one sheet, so the `?` key and the dock's button open the same dialog.
export function ShortcutSheetProvider({ openSheet, children }: ShortcutSheetProviderProps) {
  return <ShortcutSheetContext value={openSheet}>{children}</ShortcutSheetContext>
}

export function useOpenShortcutSheet(): () => void {
  const openSheet = use(ShortcutSheetContext)
  if (!openSheet) {
    throw new Error('useOpenShortcutSheet must be used inside a ShortcutSheetProvider')
  }
  return openSheet
}
