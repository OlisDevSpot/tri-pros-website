'use client'

import type { ReactNode } from 'react'
import type { ReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { Weather } from '@/shared/modules/construction/core/types'

import Image from 'next/image'

import { READING_IDS } from '@/features/trade-scenes/constants/home-anchors'
import { SCENE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_STILLS } from '@/features/trade-scenes/constants/home-scene-stills'

interface HomeSceneFallbackProps {
  weather: Weather
  renderReading: (reading: ReadingId) => ReactNode
}

// Without 3D the readings have no thermal camera to switch on and no point of the house to pin to, so they all stand listed
// over the weather's still: the same pins, values and disclosures the scene would show.
export function HomeSceneFallback({ weather, renderReading }: HomeSceneFallbackProps) {
  const readings = READING_IDS.map(reading => ({ reading, pin: renderReading(reading) })).filter(entry => entry.pin !== null)
  return (
    <div className="absolute top-(--scene-visible-top) right-(--scene-visible-right) bottom-(--scene-visible-bottom) left-[calc(var(--scene-visible-left)+var(--scene-canvas-overhang))] overflow-hidden">
      {/* Captured in a landscape pane; centred cover keeps the whole house in a portrait pane's wider, shorter crop too. */}
      <Image alt={SCENE_COPY.stillAlt(weather)} className="object-cover" fill priority sizes="(min-width: 60rem) 62vw, 100vw" src={HOME_SCENE_STILLS[weather]} />
      {/* Bottom right: the thermal camera's scale bar keeps the bottom-left corner even over a still. */}
      <div className="absolute inset-x-4 bottom-4 grid justify-items-end gap-2">
        {readings.length > 0 && (
          <ul className="grid justify-items-end gap-1.5">
            {readings.map(({ reading, pin }) => <li key={reading}>{pin}</li>)}
          </ul>
        )}
        <p className="rounded-md bg-scrim/80 px-3 py-1.5 text-xs text-on-media">{SCENE_COPY.fallback}</p>
      </div>
    </div>
  )
}
