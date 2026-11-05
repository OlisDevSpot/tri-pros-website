'use client'

import type { ReactNode, RefObject } from 'react'
import type { StoreApi } from 'zustand'
import type { SceneLoadState } from '@/features/trade-scenes/types'

import { createContext, use, useMemo } from 'react'
import { useStore } from 'zustand'

interface SceneLoadContextValue {
  store: StoreApi<SceneLoadState>
  lines: RefObject<HTMLCanvasElement | null>
}

// The store and the lines canvas, never the phase itself, so a phase change re-renders only the selectors that read it.
const SceneLoadContext = createContext<SceneLoadContextValue | null>(null)

interface SceneLoadProviderProps {
  store: StoreApi<SceneLoadState>
  // The DOM canvas the line image is copied into: it lives outside the WebGL canvas, which the pass draws through.
  lines: RefObject<HTMLCanvasElement | null>
  children: ReactNode
}

export function SceneLoadProvider({ store, lines, children }: SceneLoadProviderProps) {
  const value = useMemo(() => ({ store, lines }), [store, lines])
  return <SceneLoadContext value={value}>{children}</SceneLoadContext>
}

function useSceneLoadContext(): SceneLoadContextValue {
  const value = use(SceneLoadContext)
  if (!value) {
    throw new Error('The scene load hooks must be used inside a SceneLoadProvider')
  }
  return value
}

export function useSceneLoadApi(): StoreApi<SceneLoadState> {
  return useSceneLoadContext().store
}

export function useSceneLoad<U>(selector: (state: SceneLoadState) => U): U {
  return useStore(useSceneLoadApi(), selector)
}

export function useSceneLoadLines(): RefObject<HTMLCanvasElement | null> {
  return useSceneLoadContext().lines
}
