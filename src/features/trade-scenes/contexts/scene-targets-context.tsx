'use client'

import type { ReactNode } from 'react'
import type { SceneTargets } from '@/features/trade-scenes/types'

import { createContext, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { resolveScene } from '@/features/trade-scenes/lib/resolve-scene'
import { resolveInputsOf, selectResolveInputs } from '@/features/trade-scenes/lib/scene-resolve-inputs'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { resolveTradeBillCuts } from '@/shared/modules/construction/core/lib/resolve-trade-bill-cuts'

export const SceneTargetsContext = createContext<SceneTargets | null>(null)

interface SceneTargetsProviderProps {
  children: ReactNode
}

// One resolve per input write, shared by the canvas and the panel alike, instead of one per reader.
export function SceneTargetsProvider({ children }: SceneTargetsProviderProps) {
  // Shallow-equal slices keep their identity, so the memo below re-resolves only when one of these fields is written.
  const selection = useSceneInputs(useShallow(selectResolveInputs))
  // Parsed once per mount: the cuts are code defaults today, and read app settings once those exist.
  const cuts = useMemo(() => resolveTradeBillCuts(), [])
  const targets = useMemo(() => resolveScene(resolveInputsOf(selection), cuts), [selection, cuts])
  return <SceneTargetsContext value={targets}>{children}</SceneTargetsContext>
}
