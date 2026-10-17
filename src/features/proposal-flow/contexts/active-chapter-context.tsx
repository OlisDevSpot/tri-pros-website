'use client'

import type { ReactNode } from 'react'
import { createContext, use, useMemo } from 'react'
import { proposalChapterIds } from '@/features/proposal-flow/constants/proposal-steps'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useActiveSection } from '@/shared/hooks/use-active-section'

interface ActiveChapter {
  activeId: string
  select: (id: string) => void
}

const ActiveChapterContext = createContext<ActiveChapter | null>(null)

// One tracker per page: the rail and the tabs used to run one each and disagreed mid-scroll.
export function ActiveChapterProvider({ children }: { children: ReactNode }) {
  const { rootEl } = useScrollRoot()
  const { activeId, select } = useActiveSection(proposalChapterIds, { rootEl })
  const value = useMemo(() => ({ activeId, select }), [activeId, select])
  return <ActiveChapterContext value={value}>{children}</ActiveChapterContext>
}

export function useActiveChapter(): ActiveChapter {
  const value = use(ActiveChapterContext)
  if (!value) {
    throw new Error('useActiveChapter must be used within ActiveChapterProvider')
  }
  return value
}
