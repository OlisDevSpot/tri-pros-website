'use client'

import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { ProjectList } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface ProjectListSheetProps {
  matches: PortfolioMatch[]
  activeIndex: number
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function ProjectListSheet({ matches, activeIndex, showNoMatchNote, onSelect }: ProjectListSheetProps) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="min-h-11 shrink-0 rounded-md border border-white/35 px-3 text-presentation-label font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        {PORTFOLIO_COPY.allProjects(matches.length)}
      </SheetTrigger>
      <SheetContent aria-describedby={undefined} className="max-h-[80dvh] overflow-y-auto border-white/10 bg-[oklch(var(--presentation-scrim))] p-5 text-white" side="bottom">
        <SheetTitle className="text-white">{PORTFOLIO_COPY.listTitle}</SheetTitle>
        <ProjectList
          activeIndex={activeIndex}
          matches={matches}
          showNoMatchNote={showNoMatchNote}
          onSelect={(index) => {
            onSelect(index)
            setOpen(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
