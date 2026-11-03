'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { KeyboardIcon } from 'lucide-react'

import { SHORTCUT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { useControlsOpen } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useOpenShortcutSheet } from '@/features/trade-scenes/contexts/shortcut-sheet-context'
import { useKeysInUse } from '@/features/trade-scenes/hooks/use-keys-in-use'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { Button } from '@/shared/components/ui/button'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

const { controls, keysButton } = SCENE_LAYOUT

// The stage's bottom-right corner; on portrait it stands on the band, where the dock's region leaves it room, and steps
// away while the rail, a window or the close-up card spans the band. A touch screen has no use for it until a key is
// pressed; the `?` key opens the sheet either way.
export function SceneKeysButton() {
  const { shape } = useSceneVisibleArea()
  const open = useControlsOpen()
  const zoomed = useSceneInputs((state: TradeSceneInputs) => state.zoom !== null)
  const [keysInUse] = useKeysInUse()
  const finePointer = useMediaQuery('(pointer: fine)')
  const openSheet = useOpenShortcutSheet()
  const portrait = shape === 'portrait'
  if ((!finePointer && !keysInUse) || (portrait && (open !== null || zoomed))) {
    return null
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={SHORTCUT_COPY.title}
      aria-keyshortcuts={SCENE_SHORTCUT_KEYS.sheet}
      title={SHORTCUT_COPY.title}
      onClick={openSheet}
      style={{
        right: keysButton.gap,
        bottom: portrait ? controls.modalBottom.portrait + keysButton.gap : keysButton.gap,
        width: keysButton.size,
        height: keysButton.size,
      }}
      className="absolute z-10 grid place-items-center rounded-[12px] border bg-card text-muted-foreground shadow-lg hover:text-foreground"
    >
      <KeyboardIcon aria-hidden className="size-4.5" />
    </Button>
  )
}
