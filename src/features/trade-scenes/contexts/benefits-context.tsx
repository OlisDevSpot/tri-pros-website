'use client'

import type { ReactNode, RefObject } from 'react'
import type { BenefitSelection, BenefitsState } from '@/features/trade-scenes/types'

import { createContext, useMemo, useRef, useState } from 'react'

import { LOOK_AHEAD } from '@/features/trade-scenes/constants/look-ahead'
import { useControlsOpen } from '@/features/trade-scenes/contexts/scene-controls-context'
import { sameBenefitSelection } from '@/features/trade-scenes/lib/same-benefit-selection'

export interface BenefitOpeners {
  why: RefObject<HTMLButtonElement | null>
  costs: RefObject<HTMLButtonElement | null>
  selection: RefObject<HTMLButtonElement | null>
}

export interface BenefitsValue extends BenefitsState {
  select: (selection: BenefitSelection | null) => void
  setLookAhead: (year: number) => void
  setCostsOpen: (open: boolean) => void
  setWhyOpen: (open: boolean) => void
  restore: (state: BenefitsState) => void
  // Each is set by the control that opens its layer, so a close can hand focus back to it.
  openers: BenefitOpeners
}

export const BenefitsContext = createContext<BenefitsValue | null>(null)

const INITIAL: BenefitsState = { selection: null, lookAhead: LOOK_AHEAD.default, costsOpen: false, whyOpen: false }

interface BenefitsProviderProps {
  children: ReactNode
}

// Apart from the controls context so a year step re-renders only Benefits' readers.
export function BenefitsProvider({ children }: BenefitsProviderProps) {
  const controlsOpen = useControlsOpen()
  const [state, setState] = useState<BenefitsState>(INITIAL)
  const [previousOpen, setPreviousOpen] = useState(controlsOpen)
  const why = useRef<HTMLButtonElement>(null)
  const costs = useRef<HTMLButtonElement>(null)
  const selectionOpener = useRef<HTMLButtonElement>(null)
  const openers = useMemo<BenefitOpeners>(() => ({ why, costs, selection: selectionOpener }), [why, costs, selectionOpener])

  // Leaving Benefits drops its layers; the look-ahead year stays for the next visit.
  if (controlsOpen !== previousOpen) {
    setPreviousOpen(controlsOpen)
    if (previousOpen === 'benefits') {
      setState(current => ({ ...INITIAL, lookAhead: current.lookAhead }))
    }
  }

  const value = useMemo<BenefitsValue>(() => ({
    ...state,
    openers,
    select: selection => setState(current => ({
      ...current,
      selection: selection === null || sameBenefitSelection(current.selection, selection) ? null : selection,
    })),
    // The same year hands back the same state, so React skips the render a drag past either edge would ask for.
    setLookAhead: year => setState((current) => {
      const lookAhead = Math.min(LOOK_AHEAD.max, Math.max(LOOK_AHEAD.min, year))
      return lookAhead === current.lookAhead ? current : { ...current, lookAhead }
    }),
    setCostsOpen: costsOpen => setState(current => ({ ...current, costsOpen })),
    setWhyOpen: whyOpen => setState(current => ({ ...current, whyOpen })),
    restore: setState,
  }), [state, openers])

  return <BenefitsContext value={value}>{children}</BenefitsContext>
}
