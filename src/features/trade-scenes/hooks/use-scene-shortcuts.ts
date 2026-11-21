'use client'

import type { RefObject } from 'react'
import type { SceneShortcutKey } from '@/features/trade-scenes/constants/scene-shortcuts'
import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useEffect } from 'react'
import { flushSync } from 'react-dom'

import { LEAVE_LOOK_INSIDE } from '@/features/trade-scenes/constants/scene-controls'
import { SCENE_SHORTCUTS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { useLayoutEditorStore } from '@/features/trade-scenes/contexts/layout-editor-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneLoadApi } from '@/features/trade-scenes/contexts/scene-load-context'
import { useKeysInUse } from '@/features/trade-scenes/hooks/use-keys-in-use'
import { pressHomeView } from '@/features/trade-scenes/lib/controls-press'
import { endDrawing } from '@/features/trade-scenes/lib/create-layout-editor'
import { escapeStep } from '@/features/trade-scenes/lib/escape-step'
import { focusFell, leaveLookInside } from '@/features/trade-scenes/ui/lib/leave-look-inside'
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
  const { open, picked, openSection, close, flip, pickSystem, setQuery } = useSceneControls()
  const store = useSceneInputsApi<TradeSceneInputs>()
  const cameraStore = useSceneCameraApi()
  const loadStore = useSceneLoadApi()
  // Only the lab has the lot as data; elsewhere there is no yard or thing to step back from.
  const editor = useLayoutEditorStore()
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
      const stage = stageRef.current!
      const lot = editor?.getState() ?? null
      // Areas is no Radix layer, so its Escape is ours; a window's is its dialog's, and a menu's its popover's, which
      // take it first. A press with no layer of ours to step back is left to whatever else listens for it.
      const step = action === 'wholeHome'
        ? escapeStep({ menu: stage.querySelector('[data-value-menu]') !== null, drawing: lot?.mode === 'draw', lookInside: state.lookInside, picked, open, spotChip: state.tappedSpot !== null, editing: state.tappedSpot?.editing != null, fold: stage.querySelector('[data-wear-fold][data-state="open"]') !== null, yard: (lot?.yard ?? null) !== null, thing: (lot?.selected ?? null) !== null })
        : null
      if (action === 'wholeHome' && step === null) {
        return
      }
      // With the camera on its framing and no system framed, there is nothing to go back to, so a press is no sign
      // the rep uses keys.
      if (action === 'recenter' && !cameraStore.getState().moved && state.cameraFocus === null) {
        return
      }
      event.preventDefault()
      markInUse()
      switch (action) {
        case 'homeView':
          store.setState(pressHomeView(state.homeView))
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
            stage.querySelector<HTMLElement>('[data-build-toggle]')!.focus()
          }
          return
        }
        // M only ever opens Modify: pressed inside it, it hands the field focus and keeps the search. Opening, the search
        // a close kept is left behind, so the key always opens on an empty field; the key is already prevented, so the
        // field that takes focus never types it.
        case 'modify':
          if (open === 'modify') {
            stage.querySelector<HTMLElement>('[data-modify-search] input')!.focus()
            return
          }
          setQuery('')
          openSection('modify')
          return
        case 'wholeHome': {
          // One layer a press: drawing, over the bare scene a spot chip's fold, quick edit and the chip, then up close, the
          // selected thing, the yard or the picked system, then Areas. Focus the layer took with it goes to the way back in:
          // the yard card's draw button, Look inside, the yard's or the system's rail chip, the chip's pencil, then the Areas
          // button. A menu's popover closes itself.
          const held = document.activeElement
          if (step === 'drawing') {
            // eslint-disable-next-line react-dom/no-flush-sync -- the yard card is back only once this write renders
            flushSync(() => endDrawing(editor!))
            if (focusFell(held)) {
              stage.querySelector<HTMLElement>(`[data-yard-draw="${lot!.tool}"]`)?.focus()
            }
          }
          else if (step === 'look-inside') {
            leaveLookInside(store, stage)
          }
          else if (step === 'thing') {
            editor!.setState({ selected: null })
          }
          else if (step === 'yard') {
            // eslint-disable-next-line react-dom/no-flush-sync -- the card leaves only once this write renders
            flushSync(() => editor!.setState({ yard: null, selected: null }))
            if (focusFell(held)) {
              stage.querySelector<HTMLElement>(`[data-rail-chip="${lot!.yard}"]`)!.focus()
            }
          }
          else if (step === 'card') {
            // eslint-disable-next-line react-dom/no-flush-sync -- the card leaves only once this write renders
            flushSync(() => pickSystem(null))
            if (focusFell(held)) {
              stage.querySelector<HTMLElement>(`[data-rail-chip="${picked}"]`)!.focus()
            }
          }
          else if (step === 'fold') {
            const trigger = stage.querySelector<HTMLElement>('[data-wear-fold][data-state="open"]')!
            const inside = trigger.parentElement!.contains(held)
            // eslint-disable-next-line react-dom/no-flush-sync -- the fold's rows leave only once this write renders
            flushSync(() => trigger.click())
            if (inside || focusFell(held)) {
              trigger.focus()
            }
          }
          else if (step === 'quick-edit') {
            const editingSystem = state.tappedSpot!.editing!
            // eslint-disable-next-line react-dom/no-flush-sync -- the pencil is back only once this write renders
            flushSync(() => store.setState({ tappedSpot: { ...state.tappedSpot!, editing: null } }))
            stage.querySelector<HTMLElement>(`[data-spot-edit="${editingSystem}"]`)?.focus()
          }
          else if (step === 'spot-chip') {
            // eslint-disable-next-line react-dom/no-flush-sync -- the chip leaves only once this write renders
            flushSync(() => store.setState({ tappedSpot: null }))
            // The chip came from a tap on the scene, so no control holds the way back; Systems is the stage's entry to its controls.
            if (focusFell(held)) {
              stage.querySelector<HTMLElement>('[data-section-button="systems"]')?.focus()
            }
          }
          else if (step === 'systems') {
            // eslint-disable-next-line react-dom/no-flush-sync -- the rail leaves only once this write renders
            flushSync(close)
            if (focusFell(held)) {
              stage.querySelector<HTMLElement>('[data-section-button="systems"]')!.focus()
            }
          }
          return
        }
        case 'recenter':
          store.setState({ cameraFocus: null, ...(state.lookInside ? LEAVE_LOOK_INSIDE : {}) })
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
  }, [stageRef, openSheet, open, picked, openSection, close, flip, pickSystem, setQuery, store, cameraStore, loadStore, editor, markInUse])
}
