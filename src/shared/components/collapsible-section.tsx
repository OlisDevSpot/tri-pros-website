'use client'

import { ChevronDownIcon } from 'lucide-react'

import { StepMarker } from '@/shared/components/step-marker'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { cn } from '@/shared/lib/utils'

interface Props {
  title: string
  status: 'done' | 'pending'
  open: boolean
  onOpenChange: (open: boolean) => void
  summary?: string
  className?: string
  children: React.ReactNode
}

export function CollapsibleSection({ title, status, open, onOpenChange, summary, className, children }: Props) {
  return (
    <Collapsible className={className} onOpenChange={onOpenChange} open={open}>
      <CollapsibleTrigger className="flex min-h-16 w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50">
        <StepMarker state={status} />
        <span className="grid min-w-0 flex-1 gap-px">
          <span className="text-base font-semibold">{title}</span>
          {summary && <span className={cn('text-xs text-muted-foreground', !open && 'truncate')}>{summary}</span>}
        </span>
        <ChevronDownIcon className={cn('size-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent open={open}>
        <div className="grid gap-4 px-5 pt-1 pb-5">{children}</div>
      </AnimatedCollapsibleContent>
    </Collapsible>
  )
}
