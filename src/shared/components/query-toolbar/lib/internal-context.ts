'use client'

import type { RefObject } from 'react'

import { createContext, use } from 'react'

/**
 * Toolbar-internal coordination state shared between sibling slots:
 *   - `entityName` — parameterizes aria-labels and live-status announcements
 *     (e.g. "Search proposals", "Showing 16 proposals")
 *   - `searchInputRef` — exposed so the `/` keyboard shortcut focuses the
 *     correct element from outside the Search slot
 *   - `filterOpen` / `setFilterOpen` — coordinates FilterTrigger ↔ its
 *     Popover (desktop) or Sheet (mobile); also driven by the `F` shortcut
 *
 * Mirrors the bundle pattern of `lib/context.ts` — Context object + Provider
 * alias + thin accessor hook in a single file.
 */
interface ToolbarInternalContextValue {
  entityName: string
  searchInputRef: RefObject<HTMLInputElement | null>
  filterOpen: boolean
  setFilterOpen: (open: boolean) => void
}

const ToolbarInternalContext = createContext<ToolbarInternalContextValue | null>(null)

export const ToolbarInternalProvider = ToolbarInternalContext.Provider

export function useToolbarInternal(): ToolbarInternalContextValue {
  const ctx = use(ToolbarInternalContext)
  if (!ctx) {
    throw new Error('QueryToolbar slot used outside of <QueryToolbar> root')
  }
  return ctx
}
