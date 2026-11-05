'use client'

import type { ReactNode } from 'react'
import type { ControlsSection, FactsTab, HomeSystemId, SystemsFocus, TradeSceneInputs } from '@/features/trade-scenes/types'

import { createContext, use, useMemo, useState } from 'react'

import { LEAVE_LOOK_INSIDE } from '@/features/trade-scenes/constants/scene-controls'
import { SceneTapClaimProvider } from '@/features/trade-scenes/contexts/scene-tap-claim-context'
import { flipView, pressFocus, pressPin, pressSection } from '@/features/trade-scenes/lib/controls-press'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SceneControlsValue {
  open: ControlsSection | null
  factsTab: FactsTab
  query: string
  focus: SystemsFocus
  // Bumps each time the toast should play again.
  toast: number
  openSection: (section: ControlsSection) => void
  close: () => void
  flip: () => void
  focusSystem: (focus: SystemsFocus) => void
  // A pin on the house: its system's rail chip, and the pins go with the pick.
  pickFromPin: (system: HomeSystemId) => void
  setQuery: (query: string) => void
  setFactsTab: (tab: FactsTab) => void
}

const SceneControlsContext = createContext<SceneControlsValue | null>(null)

// The open section alone, for what only steps aside for one: the whole value changes with every key typed in Modify.
const ControlsOpenContext = createContext<ControlsSection | null | undefined>(undefined)

interface SceneControlsProviderProps {
  children: ReactNode
}

// UI state only. A system in focus is the store's cameraFocus, which the camera rig already reads; Year built holds no
// camera view, so it is held here.
export function SceneControlsProvider({ children }: SceneControlsProviderProps) {
  const [open, setOpen] = useState<ControlsSection | null>(null)
  const [factsTab, setFactsTab] = useState<FactsTab>('main')
  const [query, setQuery] = useState('')
  const [yearBuilt, setYearBuilt] = useState(false)
  const [toast, setToast] = useState(0)
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const store = useSceneInputsApi<TradeSceneInputs>()
  const focus: SystemsFocus = yearBuilt ? 'year-built' : cameraFocus

  const value = useMemo<SceneControlsValue>(() => {
    const now = () => ({ open, focus, view: store.getState().view })
    const apply = (next: ReturnType<typeof pressSection>, also: Partial<TradeSceneInputs> = {}) => {
      setOpen(next.open)
      setYearBuilt(next.focus === 'year-built')
      // One write, so the camera's glide and the side shown start on the same frame. Up close is a step into the system in
      // focus, so letting that system go, for another or for none, comes back out of it.
      const { lookInside, cameraFocus: held } = store.getState()
      const cameraFocus = next.focus === 'year-built' ? null : next.focus
      store.setState({ view: next.view, cameraFocus, ...(lookInside && cameraFocus !== held ? LEAVE_LOOK_INSIDE : {}), ...also })
      if (next.toast) {
        setToast(count => count + 1)
      }
    }
    return {
      open,
      factsTab,
      query,
      focus,
      toast,
      openSection: section => apply(pressSection(now(), section)),
      close: () => apply({ ...now(), open: null, focus: null, toast: false }),
      flip: () => apply(flipView(now())),
      focusSystem: next => apply(pressFocus(now(), next)),
      pickFromPin: system => apply(pressPin(now(), system), { tappedSpot: null }),
      setQuery,
      setFactsTab,
    }
  }, [open, factsTab, query, focus, toast, store])

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
