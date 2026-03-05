'use client'

import type { CaseStudy } from '@/features/meetings/types'
import { BookOpenIcon, CheckIcon, MapPinIcon, QuoteIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface CaseStudyPanelProps {
  caseStudy: CaseStudy
}

function CaseStudyContent({ caseStudy }: CaseStudyPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Case Study</p>
        <h3 className="mt-1 text-lg font-bold">{caseStudy.name}</h3>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPinIcon className="size-3.5 shrink-0" />
          <span>{caseStudy.location}</span>
        </div>
      </div>

      <Separator />

      {/* Context */}
      <p className="text-sm italic text-muted-foreground">{caseStudy.context}</p>

      {/* Results */}
      <div className="flex flex-col gap-2">
        {caseStudy.results.map(result => (
          <div key={result} className="flex items-start gap-2">
            <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <CheckIcon className="size-2.5 text-primary" />
            </div>
            <span className="text-sm font-medium">{result}</span>
          </div>
        ))}
      </div>

      {/* Photos placeholder */}
      {(caseStudy.beforeImg || caseStudy.afterImg) && (
        <div className="grid grid-cols-2 gap-2">
          {caseStudy.beforeImg && (
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              <img alt="Before" className="h-full w-full object-cover" src={caseStudy.beforeImg} />
            </div>
          )}
          {caseStudy.afterImg && (
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              <img alt="After" className="h-full w-full object-cover" src={caseStudy.afterImg} />
            </div>
          )}
        </div>
      )}

      {/* Quote */}
      {caseStudy.quote && (
        <>
          <Separator />
          <div className="flex gap-2">
            <QuoteIcon className="size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm italic leading-relaxed text-muted-foreground">{caseStudy.quote}</p>
          </div>
        </>
      )}
    </div>
  )
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
