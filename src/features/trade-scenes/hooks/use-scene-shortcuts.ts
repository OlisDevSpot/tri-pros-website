'use client'

import type { RefObject } from 'react'
import type { SceneShortcutKey } from '@/features/trade-scenes/constants/scene-shortcuts'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useEffect } from 'react'
import { flushSync } from 'react-dom'

import { SCENE_SHORTCUTS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneLoadApi } from '@/features/trade-scenes/contexts/scene-load-context'
import { useKeysInUse } from '@/features/trade-scenes/hooks/use-keys-in-use'
import { focusFell, leaveCloseUp } from '@/features/trade-scenes/ui/lib/leave-close-up'
import { useSceneCameraApi } from '@/shared/components/scene/contexts/scene-camera-context'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { recenterCamera } from '@/shared/components/scene/lib/create-scene-camera'
import { isUnclaimedKey } from '@/shared/lib/is-unclaimed-key'

function isShortcutKey(key: string): key is SceneShortcutKey {
  return Object.hasOwn(SCENE_SHORTCUTS, key)
}

// On `window` in the bubble phase, as the meeting flow's keys are: a key React or Radix already used arrives prevented,
// and a tap on the canvas leaves focus on `body`, which the guard takes as the stage's.
export function useSceneShortcuts(stageRef: RefObject<HTMLElement | null>, openSheet: () => void): void {
  const { open, focus, openSection, close, flip, focusSystem, setQuery } = useSceneControls()
  const store = useSceneInputsApi<TradeSceneInputs>()
  const cameraStore = useSceneCameraApi()
  const loadStore = useSceneLoadApi()
  const [, markInUse] = useKeysInUse()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // `inert` on the stage does not reach a listener on `window`.
      if (loadStore.getState().phase !== 'live') {
        return
      }
      // A held key repeats: Thermal and the toggle would flap with it.
      if (!isUnclaimedKey(event, stageRef.current) || event.repeat) {
        return
      }
      const key = event.key.toLowerCase()
      if (!isShortcutKey(key)) {
        return
      }
      const state = store.getState()
      const action = SCENE_SHORTCUTS[key]
      // Systems is no Radix layer, so its Escape is ours; a window's is its dialog's, and a menu's its popover's, which
      // take it first. With nothing open, Escape only means something up close; elsewhere it is left to whatever else
      // listens for it.
      if (action === 'wholeHome' && open !== 'systems' && (open !== null || state.zoom === null)) {
        return
      }
      // With the camera on its framing and no system holding it, there is nothing to go back to, so a press is no sign
      // the rep uses keys.
      if (action === 'recenter' && !cameraStore.getState().moved && state.cameraFocus === null) {
        return
      }
      event.preventDefault()
      markInUse()
      switch (action) {
        case 'homeView':
          store.setState({ homeView: state.homeView === 'complete' ? 'partly-open' : 'complete' })
          return
        case 'thermal':
          store.setState({ thermalCamera: !state.thermalCamera })
          return
        case 'build': {
          const held = document.activeElement
          // eslint-disable-next-line react-dom/no-flush-sync -- the window a flip to Today closes is gone only once this write renders
          flushSync(flip)
          // Focus inside the Benefits window the flip closed goes to the toggle, which a press would have left it on.
          if (held instanceof HTMLElement && !held.isConnected) {
            stageRef.current!.querySelector<HTMLElement>('[data-build-toggle]')!.focus()
          }
          return
        }
        // M only ever opens Modify: pressed inside it, it hands the field focus and keeps the search. Opening, the search
        // a close kept is left behind, so the key always opens on an empty field; the key is already prevented, so the
        // field that takes focus never types it.
        case 'modify':
          if (open === 'modify') {
            stageRef.current!.querySelector<HTMLElement>('[data-modify-search] input')!.focus()
            return
          }
          setQuery('')
          openSection('modify')
          return
        case 'wholeHome':
          // One layer a press: the system in focus, then Systems. Focus the layer took with it goes to the way back in:
          // the system's rail chip, then the Systems button.
          if (open === 'systems') {
            const held = document.activeElement
            const stage = stageRef.current!
            if (focus !== null) {
              // eslint-disable-next-line react-dom/no-flush-sync -- the card leaves only once this write renders
              flushSync(() => focusSystem(null))
              if (focusFell(held)) {
                stage.querySelector<HTMLElement>(`[data-rail-chip="${focus}"]`)!.focus()
              }
            }
            else {
              // eslint-disable-next-line react-dom/no-flush-sync -- the rail leaves only once this write renders
              flushSync(close)
              if (focusFell(held)) {
                stage.querySelector<HTMLElement>('[data-section-button="systems"]')!.focus()
              }
            }
            return
          }
          leaveCloseUp(store, stageRef.current!)
          return
        case 'recenter':
          if (state.cameraFocus !== null) {
            focusSystem(null)
          }
          recenterCamera(cameraStore)
          return
        case 'sheet':
          openSheet()
          return
        default:
          store.setState({ weather: action })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stageRef, openSheet, open, focus, openSection, close, flip, focusSystem, setQuery, store, cameraStore, loadStore, markInUse])
}
