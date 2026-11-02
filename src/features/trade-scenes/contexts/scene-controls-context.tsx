'use client'

import type { ReactNode } from 'react'
import type { ControlsSection, FactsTab, SystemsFocus, TradeSceneInputs } from '@/features/trade-scenes/types'

import { createContext, use, useMemo, useState } from 'react'

import { LEAVE_CLOSE_UP } from '@/features/trade-scenes/constants/scene-controls'
import { flipView, pressFocus, pressSection } from '@/features/trade-scenes/lib/controls-press'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SceneControlsValue {
  open: ControlsSection | null
  factsTab: FactsTab
  query: string
  billsOpen: boolean
  focus: SystemsFocus
  // Bumps each time the toast should play again.
  toast: number
  openSection: (section: ControlsSection) => void
  close: () => void
  flip: () => void
  focusSystem: (focus: SystemsFocus) => void
  setQuery: (query: string) => void
  setFactsTab: (tab: FactsTab) => void
  toggleBills: () => void
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
  const [billsOpen, setBillsOpen] = useState(false)
  const [yearBuilt, setYearBuilt] = useState(false)
  const [toast, setToast] = useState(0)
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const store = useSceneInputsApi<TradeSceneInputs>()
  const focus: SystemsFocus = yearBuilt ? 'year-built' : cameraFocus

  const value = useMemo<SceneControlsValue>(() => {
    const now = () => ({ open, focus, view: store.getState().view })
    const apply = (next: ReturnType<typeof pressSection>) => {
      setOpen(next.open)
      setYearBuilt(next.focus === 'year-built')
      // One write, so the camera's glide and the side shown start on the same frame. Systems frames the whole home's
      // systems, so it takes the scene out of a close-up, as a zoom puts Systems away.
      const leave = next.open === 'systems' && store.getState().zoom !== null
      store.setState({ view: next.view, cameraFocus: next.focus === 'year-built' ? null : next.focus, ...(leave ? LEAVE_CLOSE_UP : {}) })
      if (next.toast) {
        setToast(count => count + 1)
      }
    }
    return {
      open,
      factsTab,
      query,
      billsOpen,
      focus,
      toast,
      openSection: (section) => {
        setBillsOpen(false)
        apply(pressSection(now(), section))
      },
      close: () => apply({ ...now(), open: null, focus: null, toast: false }),
      flip: () => apply(flipView(now())),
      focusSystem: next => apply(pressFocus(now(), next)),
      setQuery,
      setFactsTab,
      toggleBills: () => setBillsOpen(current => !current),
    }
  }, [open, factsTab, query, billsOpen, focus, toast, store])

  return (
    <SceneControlsContext value={value}>
      <ControlsOpenContext value={open}>{children}</ControlsOpenContext>
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
