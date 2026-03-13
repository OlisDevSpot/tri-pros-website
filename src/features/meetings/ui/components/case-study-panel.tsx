'use client'

import type { CaseStudy } from '@/features/meetings/types'
import { BookOpenIcon } from 'lucide-react'
import { CaseStudyContent } from '@/features/meetings/ui/components/case-study-content'
import { Button } from '@/shared/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface CaseStudyPanelProps {
  caseStudy: CaseStudy
}

export function CaseStudyPanel({ caseStudy }: CaseStudyPanelProps) {
  return (
    <>
      {/* Desktop: always-visible right panel */}
      <aside className="hidden h-full w-80 shrink-0 overflow-y-auto rounded-xl border border-border/50 bg-card/40 lg:flex lg:flex-col">
        <CaseStudyContent caseStudy={caseStudy} />
      </aside>

      {/* Mobile: bottom sheet trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            className="fixed right-4 bottom-20 z-40 gap-2 shadow-lg lg:hidden"
            size="sm"
            variant="outline"
          >
            <BookOpenIcon className="size-4" />
            Case Study
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto" side="bottom">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Real Customer Story</SheetTitle>
          </SheetHeader>
          <CaseStudyContent caseStudy={caseStudy} />
        </SheetContent>
      </Sheet>
    </>
  )
}
