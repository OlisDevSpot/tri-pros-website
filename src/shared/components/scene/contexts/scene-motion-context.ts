'use client'

import { createContext, use } from 'react'

export const SceneMotionContext = createContext<{ reducedMotion: boolean }>({ reducedMotion: false })

export function useSceneMotion(): { reducedMotion: boolean } {
  return use(SceneMotionContext)
}
