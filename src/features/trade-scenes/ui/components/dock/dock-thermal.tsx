'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'

import { DOCK_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_THERMAL_PALETTE } from '@/features/trade-scenes/constants/home-temperatures'
import { THERMAL_ICON } from '@/features/trade-scenes/constants/scene-control-icons'
import { DOCK_BUTTON_CLASS, DOCK_SIZES } from '@/features/trade-scenes/constants/scene-dock'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { Keycap } from '@/features/trade-scenes/ui/components/keycap'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

const RAMP = `linear-gradient(to right, ${HOME_THERMAL_PALETTE.join(', ')})`

export function DockThermal() {
  const thermalCamera = useSceneInputs((state: TradeSceneInputs) => state.thermalCamera)
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const hintId = useId()

  return (
    <button
      type="button"
      aria-pressed={thermalCamera}
      aria-describedby={hintId}
      aria-keyshortcuts={SCENE_SHORTCUT_KEYS.thermal}
      title={DOCK_COPY.thermalHint}
      onClick={() => inputs.setState({ thermalCamera: !thermalCamera })}
      style={DOCK_SIZES.tile}
      className={DOCK_BUTTON_CLASS}
    >
      <THERMAL_ICON aria-hidden className="size-4.5" />
      {DOCK_COPY.thermal}
      {/* The camera's own ramp, lit when it is on; no text sits on it, so the label reads the same either way. */}
      <span aria-hidden style={{ backgroundImage: RAMP }} className="h-1 w-7 rounded-full opacity-35 group-aria-pressed/dock:opacity-100" />
      <span id={hintId} className="sr-only">{DOCK_COPY.thermalHint}</span>
      <Keycap keyLabel={SCENE_SHORTCUT_KEYS.thermal.toUpperCase()} />
    </button>
  )
}
