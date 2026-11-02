'use client'

import type { ReactNode } from 'react'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useEffect } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { useSceneLoadApi } from '@/features/trade-scenes/contexts/scene-load-context'
import { advanceSceneLoad } from '@/features/trade-scenes/lib/create-scene-load'
import { HomeSceneFallback } from '@/features/trade-scenes/ui/components/home-scene-fallback'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

// Without the 3D chunk there is no thermal camera, so the still carries no readings.
const noReading = () => null

// Outside the 3D chunk on purpose: SceneShell's own boundary and watchdog live inside it, so a chunk that never arrives
// (offline, or an installed app holding a deploy whose chunks are gone) or throws while mounting would otherwise reach
// Next's error page and take the dashboard down with it. Here the stills take over and the stage goes live instead.
export function HomeSceneBoundary({ children }: { children: ReactNode }) {
  const load = useSceneLoadApi()
  const weather = useSceneInputs((state: TradeSceneInputs) => state.weather)

  // Whatever stalls, the chunk download included, the stage never stays covered.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (load.getState().phase !== 'live') {
        console.warn('The scene took too long to load; showing it as it is.')
        advanceSceneLoad(load, 'live')
      }
    }, SCENE_LOAD.watchdogMs)
    const unsubscribe = load.subscribe((state) => {
      if (state.phase === 'live') {
        clearTimeout(timer)
      }
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [load])

  return (
    <ErrorBoundary fallback={<HomeSceneFallback weather={weather} renderReading={noReading} />} onError={() => advanceSceneLoad(load, 'live')}>
      {children}
    </ErrorBoundary>
  )
}
