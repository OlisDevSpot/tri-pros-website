'use client'

import type { ReactNode } from 'react'
import type { StoreApi } from 'zustand'
import type { SceneCameraState } from '@/shared/components/scene/types'

import { createContext, use } from 'react'
import { useStore } from 'zustand'

// The context carries the store, never its state, so a write re-renders only the selectors that read it.
const SceneCameraContext = createContext<StoreApi<SceneCameraState> | null>(null)

interface SceneCameraProviderProps {
  store: StoreApi<SceneCameraState>
  children: ReactNode
}

export function SceneCameraProvider({ store, children }: SceneCameraProviderProps) {
  return <SceneCameraContext value={store}>{children}</SceneCameraContext>
}

// The rig keeps working without a provider when it is given no pan, so it reads the context without throwing.
export function useOptionalSceneCameraApi(): StoreApi<SceneCameraState> | null {
  return use(SceneCameraContext)
}

export function useSceneCameraApi(): StoreApi<SceneCameraState> {
  const store = useOptionalSceneCameraApi()
  if (!store) {
    throw new Error('useSceneCameraApi must be used inside a SceneCameraProvider')
  }
  return store
}

export function useSceneCamera<U>(selector: (state: SceneCameraState) => U): U {
  return useStore(useSceneCameraApi(), selector)
}
