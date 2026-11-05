'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { LocateFixedIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Toolbar } from 'radix-ui'
import { useLayoutEffect, useRef } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { SCENE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { keycapLabel } from '@/features/trade-scenes/lib/keycap-label'
import { Keycap } from '@/features/trade-scenes/ui/components/keycap'
import { useSceneCamera, useSceneCameraApi } from '@/shared/components/scene/contexts/scene-camera-context'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { recenterCamera } from '@/shared/components/scene/lib/create-scene-camera'
import { cn } from '@/shared/lib/utils'

// Comes in at the group's right end once the camera has left its framing, a system in focus included. A window over the
// scene stops the camera moving, so it steps out while one is open; Systems is no window. It stays mounted so it can
// leave as it came; while away it is out of the tab order and the accessibility tree.
export function ControlsRecenter() {
  const moved = useSceneCamera(state => state.moved)
  const systemHeld = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus !== null)
  const camera = useSceneCameraApi()
  const { open, focusSystem } = useSceneControls()
  const { shape } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const shown = (moved || systemHeld) && (open === null || open === 'systems')
  const button = useRef<HTMLButtonElement>(null)
  // Leaving makes the button inert under its own focus, which would drop a keyboard user to body; Modify keeps their
  // place in the group.
  useLayoutEffect(() => {
    const held = button.current
    if (!shown && held && held === document.activeElement) {
      held.closest('[data-scene-controls]')!.querySelector<HTMLElement>('[data-section-button="modify"]')!.focus()
    }
  }, [shown])

  return (
    <span
      data-controls-recenter
      inert={!shown}
      aria-hidden={!shown || undefined}
      style={{ transition: reduceMotion ? 'none' : `max-width 300ms ${CONTROLS_EASE_CSS}, opacity 180ms ${CONTROLS_EASE_CSS}` }}
      // Clipped across only: the cap rises above the button.
      className={cn('inline-flex shrink-0 items-center overflow-x-clip', shown ? 'max-w-15 opacity-100' : 'max-w-0 opacity-0')}
    >
      <Toolbar.Button
        ref={button}
        aria-label={SCENE_COPY.recenter}
        aria-keyshortcuts={SCENE_SHORTCUT_KEYS.recenter}
        onClick={() => {
          if (systemHeld) {
            focusSystem(null)
          }
          recenterCamera(camera)
        }}
        className={cn(
          CONTROLS_CLASSES.barItem.base,
          'hover:bg-hover hover:text-foreground pressed:bg-press focus-visible:ring-inset',
          shape === 'portrait' ? CONTROLS_CLASSES.barItem.portrait : CONTROLS_CLASSES.barItem.wide,
        )}
      >
        <LocateFixedIcon aria-hidden />
        <Keycap keyLabel={keycapLabel(SCENE_SHORTCUT_KEYS.recenter)} className="-top-1.5 right-0" />
      </Toolbar.Button>
    </span>
  )
}
