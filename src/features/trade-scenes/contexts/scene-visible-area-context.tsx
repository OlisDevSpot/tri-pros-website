'use client'

import type { ReactNode } from 'react'
import type { SceneVisibleArea, StageShape } from '@/features/trade-scenes/types'

import { createContext, use } from 'react'

export interface SceneVisibleAreaValue {
  area: SceneVisibleArea
  shape: StageShape
  stage: { width: number, height: number }
  // A close-up is open: its card covers part of the stage, so what places itself by the area reads this too.
  zoomed: boolean
  // The strip of canvas left of the stage, under the dashboard sidebar: the canvas spans it so a sidebar slide never
  // resizes the canvas. 0 until the stage is measured.
  canvasOverhang: number
  // The layer the controls portal into, so they are placed in stage pixels and the shortcut guard still counts them as
  // the stage's. Null until the stage mounts.
  stageElement: HTMLDivElement | null
}

const SceneVisibleAreaContext = createContext<SceneVisibleAreaValue | null>(null)

interface SceneVisibleAreaProviderProps {
  value: SceneVisibleAreaValue
  children: ReactNode
}

// One measure of the stage for the DOM layers and the camera alike, so the card and the framing never disagree.
export function SceneVisibleAreaProvider({ value, children }: SceneVisibleAreaProviderProps) {
  return <SceneVisibleAreaContext value={value}>{children}</SceneVisibleAreaContext>
}

export function useSceneVisibleArea(): SceneVisibleAreaValue {
  const value = use(SceneVisibleAreaContext)
  if (!value) {
    throw new Error('useSceneVisibleArea must be used inside a SceneVisibleAreaProvider')
  }
  return value
}
