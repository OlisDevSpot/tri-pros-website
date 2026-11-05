'use client'

import type { ReactNode } from 'react'
import type { ControlsSection } from '@/features/trade-scenes/types'

import { useRef } from 'react'

import { FACTS_TABS } from '@/features/trade-scenes/constants/facts-tabs'
import { BenefitsFiguresProvider } from '@/features/trade-scenes/contexts/benefits-figures-context'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { benefitsStepBack } from '@/features/trade-scenes/lib/benefits-step-back'
import { BenefitsBody } from '@/features/trade-scenes/ui/components/benefits/benefits-body'
import { BenefitsHead } from '@/features/trade-scenes/ui/components/benefits/benefits-head'
import { ControlsModal } from '@/features/trade-scenes/ui/components/controls/controls-modal'
import { ControlsToast } from '@/features/trade-scenes/ui/components/controls/controls-toast'
import { HomeFactsBody } from '@/features/trade-scenes/ui/components/controls/home-facts-body'
import { HomeFactsHead } from '@/features/trade-scenes/ui/components/controls/home-facts-head'
import { ModifyBody } from '@/features/trade-scenes/ui/components/controls/modify-body'
import { Tabs } from '@/shared/components/ui/tabs'

interface ControlsWindowProps {
  // Pointed at by the group's section buttons.
  id: string
}

interface WindowSection {
  // The section's head, body and foot.
  content: ReactNode
  // Runs before the window closes on Escape; preventing it keeps the window open.
  onEscapeKeyDown?: (event: KeyboardEvent) => void
}

// The one window every section but Systems shows in, and the toast that says the side shown changed.
export function ControlsWindow({ id }: ControlsWindowProps) {
  const { open, factsTab, setFactsTab, query, setQuery } = useSceneControls()
  const benefits = useBenefits()
  const searchRef = useRef<HTMLInputElement>(null)
  const sections: Record<Exclude<ControlsSection, 'systems'>, WindowSection> = {
    // One tabs root across the head and the body, so the tabs beside the title still own the panels below it.
    facts: {
      content: (
        <Tabs
          value={factsTab}
          onValueChange={(next) => {
            const picked = FACTS_TABS.find(tab => tab === next)
            if (picked !== undefined) {
              setFactsTab(picked)
            }
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <HomeFactsHead />
          <HomeFactsBody />
        </Tabs>
      ),
    },
    modify: {
      content: <ModifyBody inputRef={searchRef} />,
      // A first Escape takes back only the typing, so a mistyped search never costs the window.
      onEscapeKeyDown: (event) => {
        if (query !== '') {
          event.preventDefault()
          setQuery('')
          searchRef.current!.focus()
        }
      },
    },
    benefits: {
      content: (
        <BenefitsFiguresProvider>
          <BenefitsHead />
          <BenefitsBody />
        </BenefitsFiguresProvider>
      ),
      // Each Escape closes one layer and hands focus to the control that opened it.
      onEscapeKeyDown: (event) => {
        const { selection, lookAhead, costsOpen, whyOpen, openers, restore } = benefits
        const next = benefitsStepBack({ selection, lookAhead, costsOpen, whyOpen })
        if (next === null) {
          return
        }
        event.preventDefault()
        const opener = whyOpen ? openers.why : costsOpen ? openers.costs : openers.selection
        restore(next)
        opener.current!.focus()
      },
    },
  }
  const shown = open === null || open === 'systems' ? null : sections[open]

  return (
    <>
      {shown && (
        <ControlsModal id={id} onEscapeKeyDown={shown.onEscapeKeyDown}>
          {shown.content}
        </ControlsModal>
      )}
      <ControlsToast />
    </>
  )
}
