'use client'

import type { ReactNode } from 'react'
import type { StoreApi } from 'zustand'

import { createContext, use } from 'react'
import { useStore } from 'zustand'

// The context carries the store, never its state, so a write re-renders only the selectors that read it.
const SceneInputsContext = createContext<StoreApi<object> | null>(null)

interface SceneInputsProviderProps<T extends object> {
  store: StoreApi<T>
  children: ReactNode
}

export function SceneInputsProvider<T extends object>({ store, children }: SceneInputsProviderProps<T>) {
  return <SceneInputsContext value={store as StoreApi<object>}>{children}</SceneInputsContext>
}

export function useSceneInputsApi<T extends object>(): StoreApi<T> {
  const store = use(SceneInputsContext)
  if (!store) {
    throw new Error('useSceneInputsApi must be used inside a SceneInputsProvider')
  }
  return store as StoreApi<T>
}

export function useSceneInputs<T extends object, S>(selector: (state: T) => S): S {
  return useStore(useSceneInputsApi<T>(), selector)
}
