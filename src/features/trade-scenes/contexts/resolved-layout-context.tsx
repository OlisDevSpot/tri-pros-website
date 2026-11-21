'use client'

import type { ReactNode } from 'react'
import type { StoreApi } from 'zustand'
import type { ResolvedLayout, TradeSceneInputs } from '@/features/trade-scenes/types'

import { createContext, use, useMemo } from 'react'
import { useStore } from 'zustand'

import { resolvePropertyLayout } from '@/features/trade-scenes/lib/resolve-property-layout'

const ResolvedLayoutContext = createContext<ResolvedLayout | null>(null)

interface ResolvedLayoutProviderProps {
  // Taken as a prop: the view that owns the store mounts this around the scene, outside its inputs provider.
  store: StoreApi<TradeSceneInputs>
  children: ReactNode
}

// One resolve per layout write, shared by the canvas and the panel alike, instead of one per reader.
export function ResolvedLayoutProvider({ store, children }: ResolvedLayoutProviderProps) {
  const layout = useStore(store, state => state.layout)
  const resolved = useMemo(() => resolvePropertyLayout(layout), [layout])
  return <ResolvedLayoutContext value={resolved}>{children}</ResolvedLayoutContext>
}

export function useResolvedLayout(): ResolvedLayout {
  const resolved = use(ResolvedLayoutContext)
  if (!resolved) {
    throw new Error('useResolvedLayout must be used inside a ResolvedLayoutProvider')
  }
  return resolved
}

// As the editor store: the Controls ask for it this way, since only the lab resolves a layout.
export function useResolvedLayoutOrNull(): ResolvedLayout | null {
  return use(ResolvedLayoutContext)
}
