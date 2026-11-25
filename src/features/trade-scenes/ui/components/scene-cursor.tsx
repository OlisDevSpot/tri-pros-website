'use client'

import type { ReactNode } from 'react'

import { SceneCursorHoverContext } from '@/features/trade-scenes/contexts/scene-cursor-hover-context'
import { useSceneCursor } from '@/features/trade-scenes/hooks/use-scene-cursor'

interface SceneCursorProps {
  children: ReactNode
}

// Wraps the house so its parts can say they are tappable; the setter is stable, so a hover re-renders nothing.
export function SceneCursor({ children }: SceneCursorProps) {
  const hover = useSceneCursor()
  return <SceneCursorHoverContext value={hover}>{children}</SceneCursorHoverContext>
}
