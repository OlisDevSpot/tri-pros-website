'use client'

import type { ReactNode } from 'react'
import type { StoreApi } from 'zustand'
import type { LayoutEditorState } from '@/features/trade-scenes/lib/create-layout-editor'

import { createContext, use } from 'react'
import { useStore } from 'zustand'

// The context carries the store, never its state, so a stroke's moves re-render only the selectors that read them.
const LayoutEditorContext = createContext<StoreApi<LayoutEditorState> | null>(null)

interface LayoutEditorProviderProps {
  store: StoreApi<LayoutEditorState>
  children: ReactNode
}

export function LayoutEditorProvider({ store, children }: LayoutEditorProviderProps) {
  return <LayoutEditorContext value={store}>{children}</LayoutEditorContext>
}

export function useLayoutEditorApi(): StoreApi<LayoutEditorState> {
  const store = use(LayoutEditorContext)
  if (!store) {
    throw new Error('useLayoutEditorApi must be used inside a LayoutEditorProvider')
  }
  return store
}

export function useLayoutEditor<U>(selector: (state: LayoutEditorState) => U): U {
  return useStore(useLayoutEditorApi(), selector)
}

// The Controls mount on routes with no lot as data, so they ask for the store this way and never throw.
export function useLayoutEditorStore(): StoreApi<LayoutEditorState> | null {
  return use(LayoutEditorContext)
}

export function useLotIsData(): boolean {
  return useLayoutEditorStore() !== null
}
