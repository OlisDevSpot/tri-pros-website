'use client'

import type { ReactNode } from 'react'

import { use, useSyncExternalStore } from 'react'

import { ScenePinsContext } from '@/shared/components/scene/contexts/scene-pins-context'
import { cn } from '@/shared/lib/utils'

interface ScenePinsProps {
  render: (id: string) => ReactNode
  visible: (id: string) => boolean
}

const NO_IDS: readonly string[] = []
const NO_SUBSCRIPTION = () => () => {}
const NO_SNAPSHOT = () => NO_IDS

export function ScenePins({ render, visible }: ScenePinsProps) {
  const registry = use(ScenePinsContext)
  const ids = useSyncExternalStore(
    registry?.subscribe ?? NO_SUBSCRIPTION,
    registry?.getIds ?? NO_SNAPSHOT,
    NO_SNAPSHOT,
  )

  if (!registry) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {ids.map((id) => {
        const shown = visible(id)
        return (
          <div
            key={id}
            ref={(element) => {
              if (element) {
                registry.elements.set(id, element)
              }
              else {
                registry.elements.delete(id)
              }
            }}
            aria-hidden={!shown}
            className={cn(
              'absolute top-0 left-0 opacity-0 transition-opacity duration-300',
              shown && 'data-anchored:pointer-events-auto data-anchored:opacity-100',
            )}
          >
            {render(id)}
          </div>
        )
      })}
    </div>
  )
}
