'use client'

import type { RefObject } from 'react'

import { useSceneShortcuts } from '@/features/trade-scenes/hooks/use-scene-shortcuts'

interface SceneShortcutsProps {
  stageRef: RefObject<HTMLElement | null>
  openSheet: () => void
}

// Apart from the stage, so the controls' state the keys read, the Modify query among it, re-renders only this and never
// the stage and the scene drawn inside it.
export function SceneShortcuts({ stageRef, openSheet }: SceneShortcutsProps) {
  useSceneShortcuts(stageRef, openSheet)
  return null
}
