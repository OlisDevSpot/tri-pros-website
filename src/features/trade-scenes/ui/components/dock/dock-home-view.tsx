'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'

import { DOCK_COPY, HOME_VIEW_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_VIEW_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { DOCK_BUTTON_CLASS, DOCK_SIZES } from '@/features/trade-scenes/constants/scene-dock'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { Keycap } from '@/features/trade-scenes/ui/components/keycap'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'

const VIEW_KEY = SCENE_SHORTCUT_KEYS.homeView

// One tile that names the view the home is in and flips it on a tap, the way the `V` key does.
export function DockHomeView() {
  const homeView = useSceneInputs((state: TradeSceneInputs) => state.homeView)
  const inputs = useSceneInputsApi<TradeSceneInputs>()
  const labelId = useId()
  const Icon = HOME_VIEW_ICONS[homeView]

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-labelledby={labelId}
      aria-keyshortcuts={VIEW_KEY}
      onClick={() => inputs.setState({ homeView: homeView === 'complete' ? 'partly-open' : 'complete' })}
      style={DOCK_SIZES.tile}
      className={DOCK_BUTTON_CLASS}
    >
      <Icon aria-hidden className="size-4.5" />
      <span aria-hidden>{HOME_VIEW_LABELS[homeView]}</span>
      <span id={labelId} className="sr-only">{`${DOCK_COPY.homeView}: ${HOME_VIEW_LABELS[homeView]}`}</span>
      <Keycap keyLabel={VIEW_KEY.toUpperCase()} />
    </Button>
  )
}
