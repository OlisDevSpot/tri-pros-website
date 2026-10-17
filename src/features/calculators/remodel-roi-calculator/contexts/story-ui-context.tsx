'use client'

import type { ChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import type { PanelSectionKey } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'
import type { StorySheet } from '@/features/calculators/remodel-roi-calculator/types'

import { createContext, use, useCallback, useMemo, useState } from 'react'

interface StoryUi {
  sheet: StorySheet
  openInfo: (chapter: ChapterId) => void
  openAssumptions: () => void
  openInputs: () => void
  closeSheet: () => void
  openSection: PanelSectionKey | null
  setOpenSection: (section: PanelSectionKey | null) => void
  editSection: (section: PanelSectionKey) => void
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  scroller: HTMLDivElement | null
  registerScroller: (node: HTMLDivElement | null) => void
}

const StoryUiContext = createContext<StoryUi | null>(null)

interface Props {
  isBelowLg: boolean
  children: React.ReactNode
}

export function StoryUiProvider({ isBelowLg, children }: Props) {
  const [sheet, setSheet] = useState<StorySheet>(null)
  const [openSection, setOpenSection] = useState<PanelSectionKey | null>('trades')
  const [collapsed, setCollapsed] = useState(false)
  const [scroller, registerScroller] = useState<HTMLDivElement | null>(null)

  const editSection = useCallback((section: PanelSectionKey) => {
    setOpenSection(section)
    setCollapsed(false)
    setSheet(isBelowLg ? { kind: 'inputs' } : null)
  }, [isBelowLg])

  const value = useMemo<StoryUi>(() => ({
    sheet,
    openInfo: chapter => setSheet({ kind: 'info', chapter }),
    openAssumptions: () => setSheet({ kind: 'assumptions' }),
    openInputs: () => setSheet({ kind: 'inputs' }),
    closeSheet: () => setSheet(null),
    openSection,
    setOpenSection,
    editSection,
    collapsed,
    setCollapsed,
    scroller,
    registerScroller,
  }), [sheet, openSection, editSection, collapsed, scroller])

  return <StoryUiContext value={value}>{children}</StoryUiContext>
}

export function useStoryUi(): StoryUi {
  const context = use(StoryUiContext)
  if (!context) {
    throw new Error('useStoryUi must be used inside StoryUiProvider')
  }
  return context
}
