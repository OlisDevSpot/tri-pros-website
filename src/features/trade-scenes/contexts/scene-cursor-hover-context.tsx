'use client'

import { createContext, use } from 'react'

export type SceneCursorHover = (over: boolean) => void

const noHover: SceneCursorHover = () => {}

export const SceneCursorHoverContext = createContext<SceneCursorHover>(noHover)

export function useSceneCursorHover(): SceneCursorHover {
  return use(SceneCursorHoverContext)
}
