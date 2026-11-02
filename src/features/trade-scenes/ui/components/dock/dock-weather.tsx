'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'

import { DOCK_COPY, WEATHER_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_WEATHERS } from '@/features/trade-scenes/constants/scene-controls'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { DockTray } from '@/features/trade-scenes/ui/components/dock/dock-tray'
import { WeatherTile } from '@/features/trade-scenes/ui/components/dock/weather-tile'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

const WEATHER_KEYS = SCENE_WEATHERS.map(weather => SCENE_SHORTCUT_KEYS[weather])

interface DockWeatherProps {
  // Where the strip has no room for four tiles, they wait in a tray beside one button.
  folded: boolean
}

export function DockWeather({ folded }: DockWeatherProps) {
  const weather = useSceneInputs((state: TradeSceneInputs) => state.weather)
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const currentId = useId()

  const tiles = (onPicked?: () => void) => SCENE_WEATHERS.map(option => (
    <WeatherTile
      key={option}
      weather={option}
      keyLabel={SCENE_SHORTCUT_KEYS[option]}
      aria-pressed={option === weather}
      aria-keyshortcuts={SCENE_SHORTCUT_KEYS[option]}
      onClick={() => {
        inputs.setState({ weather: option })
        onPicked?.()
      }}
    />
  ))

  if (!folded) {
    return <div role="group" aria-label={DOCK_COPY.weather} style={{ gap: SCENE_LAYOUT.dock.spacing }} className="grid">{tiles()}</div>
  }

  return (
    <DockTray
      label={DOCK_COPY.weather}
      opener={props => (
        <>
          {/* The keys pick a weather without opening the tray, so the cap is a hint and the button claims no key. */}
          <WeatherTile {...props} weather={weather} label={DOCK_COPY.weather} keyLabel={`${WEATHER_KEYS[0]}–${WEATHER_KEYS.at(-1)}`} aria-describedby={currentId} />
          <span id={currentId} className="sr-only">{WEATHER_LABELS[weather]}</span>
        </>
      )}
    >
      {tiles}
    </DockTray>
  )
}
