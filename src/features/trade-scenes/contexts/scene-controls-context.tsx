'use client'

import type { ReactNode } from 'react'
import type { AreaGroupId, ControlsSection, FactsTab, HomeSystemId, SystemsPick, TradeSceneInputs } from '@/features/trade-scenes/types'

import { createContext, use, useMemo, useState } from 'react'

import { LEAVE_LOOK_INSIDE } from '@/features/trade-scenes/constants/scene-controls'
import { SceneTapClaimProvider } from '@/features/trade-scenes/contexts/scene-tap-claim-context'
import { flipView, pressChip, pressPick, pressSection } from '@/features/trade-scenes/lib/controls-press'
import { useSceneCameraApi } from '@/shared/components/scene/contexts/scene-camera-context'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { recenterCamera } from '@/shared/components/scene/lib/create-scene-camera'

type RailGroup = Exclude<AreaGroupId, 'interior'>

interface SceneControlsValue {
  open: ControlsSection | null
  factsTab: FactsTab
  query: string
  picked: SystemsPick
  // The Areas rail's group. Interior holds nothing yet, so it is never chosen.
  group: RailGroup
  // Bumps each time the toast should play again.
  toast: number
  openSection: (section: ControlsSection) => void
  close: () => void
  flip: () => void
  pickSystem: (pick: SystemsPick) => void
  // The camera frames the picked system, or lets it go when it already does and the hand has not moved it.
  focusCamera: () => void
  // Up close is a step into the picked system; pressed again it comes back out.
  toggleLookInside: () => void
  // A spot chip's system button: it picks that system, and the chip goes with the pick.
  pickFromChip: (system: HomeSystemId) => void
  setQuery: (query: string) => void
  setFactsTab: (tab: FactsTab) => void
  setGroup: (group: RailGroup) => void
}

const SceneControlsContext = createContext<SceneControlsValue | null>(null)

// The open section alone, for what only steps aside for one: the whole value changes with every key typed in Modify.
const ControlsOpenContext = createContext<ControlsSection | null | undefined>(undefined)

interface SceneControlsProviderProps {
  children: ReactNode
}

// UI state only. The picked system is the store's pickedSystem, and a pick never moves the camera; Year built is no
// system, so it is held here.
export function SceneControlsProvider({ children }: SceneControlsProviderProps) {
  const [open, setOpen] = useState<ControlsSection | null>(null)
  const [factsTab, setFactsTab] = useState<FactsTab>('main')
  const [query, setQuery] = useState('')
  const [yearBuilt, setYearBuilt] = useState(false)
  const [toast, setToast] = useState(0)
  const [group, setGroupState] = useState<RailGroup>('exterior')
  const pickedSystem = useSceneInputs((state: TradeSceneInputs) => state.pickedSystem)
  const store = useSceneInputsApi<TradeSceneInputs>()
  const cameraStore = useSceneCameraApi()
  const picked: SystemsPick = yearBuilt ? 'year-built' : pickedSystem

  const value = useMemo<SceneControlsValue>(() => {
    const now = () => ({ open, picked, view: store.getState().view })
    const apply = (next: ReturnType<typeof pressSection>, also: Partial<TradeSceneInputs> = {}) => {
      setOpen(next.open)
      setYearBuilt(next.picked === 'year-built')
      // A system or Year built is on the Exterior group, wherever it was picked from: a pin, a key.
      if (next.picked !== null) {
        setGroupState('exterior')
      }
      // One write, so the side shown and the camera's release start on the same frame. Up close is a step into the system
      // in the card, so letting that system go, for another or for none, comes back out of it and hands the camera back.
      const { lookInside, pickedSystem: held } = store.getState()
      const pick = next.picked === 'year-built' ? null : next.picked
      const changed = pick !== held
      // A card never sits under a chip, so a press that opens one lets the chip go; closing leaves it alone.
      const opens = next.picked !== null && next.picked !== now().picked
      store.setState({
        view: next.view,
        pickedSystem: pick,
        ...(changed ? { cameraFocus: null, ...(lookInside ? LEAVE_LOOK_INSIDE : {}) } : {}),
        ...(opens ? { tappedSpot: null } : {}),
        ...also,
      })
      if (next.toast) {
        setToast(count => count + 1)
      }
    }
    return {
      open,
      factsTab,
      query,
      picked,
      group,
      toast,
      openSection: section => apply(pressSection(now(), section)),
      close: () => apply({ ...now(), open: null, picked: null, toast: false }),
      flip: () => apply(flipView(now())),
      pickSystem: next => apply(pressPick(now(), next)),
      pickFromChip: system => apply(pressChip(now(), system), { tappedSpot: null }),
      // The rig glides only on a framing-key or recenter change, and after a hand pan released the held framing equals the
      // system's own, so framing it again needs the recenter bump to move at all.
      focusCamera: () => {
        const { cameraFocus, pickedSystem: system } = store.getState()
        if (cameraFocus === system && !cameraStore.getState().moved) {
          store.setState({ cameraFocus: null })
          return
        }
        store.setState({ cameraFocus: system })
        recenterCamera(cameraStore)
      },
      toggleLookInside: () => {
        const { lookInside, pickedSystem: system } = store.getState()
        store.setState(lookInside ? LEAVE_LOOK_INSIDE : { lookInside: true, cameraFocus: system })
      },
      setQuery,
      setFactsTab,
      // The Lot group's yards are no camera view, so the picked system goes.
      setGroup: (next) => {
        setGroupState(next)
        if (next === 'lot') {
          apply(pressPick(now(), null))
        }
      },
    }
  }, [open, factsTab, query, picked, group, toast, store, cameraStore])

  return (
    <SceneControlsContext value={value}>
      <ControlsOpenContext value={open}>
        {/* Here, above both the canvas whose house taps claim and the controls whose tap-away reads the claim. */}
        <SceneTapClaimProvider>{children}</SceneTapClaimProvider>
      </ControlsOpenContext>
    </SceneControlsContext>
  )
}

export function useSceneControls(): SceneControlsValue {
  const value = use(SceneControlsContext)
  if (!value) {
    throw new Error('useSceneControls must be used inside a SceneControlsProvider')
  }
  return value
}

export function useControlsOpen(): ControlsSection | null {
  const open = use(ControlsOpenContext)
  if (open === undefined) {
    throw new Error('useControlsOpen must be used inside a SceneControlsProvider')
  }
  return open
}
