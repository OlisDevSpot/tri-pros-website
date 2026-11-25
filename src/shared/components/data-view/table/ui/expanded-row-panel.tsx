'use client'

import type { ReactNode } from 'react'

import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

interface SlotProps {
  className?: string
  children: ReactNode
}

// The panel sits inside a table cell pinned to the visible width, so it lays out against its own width, not the viewport.
function Root({ className, children }: SlotProps) {
  return (
    <div className="@container">
      <div className={cn('grid grid-cols-1 items-start gap-x-6 gap-y-4 bg-band p-4 @min-[640px]:grid-cols-[minmax(0,1fr)_auto]', className)}>
        {children}
      </div>
    </div>
  )
}

function ActionBar({ className, children }: SlotProps) {
  const isMobile = useIsMobile()
  return (
    <div className={cn('min-w-0', isMobile && '**:data-[toolbar-role=primary]:w-full **:data-[toolbar-role=promoted]:flex-1', className)}>
      {children}
    </div>
  )
}

function Details({ className, children }: SlotProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground @min-[640px]:justify-self-end', className)}>
      {children}
    </div>
  )
}

function Panes({ className, children }: SlotProps) {
  return (
    <div className={cn('col-span-full grid grid-cols-1 gap-6', className)}>
      {children}
    </div>
  )
}

interface PaneProps {
  title: string
  isLoading?: boolean
  className?: string
  children?: ReactNode
}

function Pane({ title, isLoading = false, className, children }: PaneProps) {
  return (
    <section aria-busy={isLoading || undefined} className={cn('flex min-w-0 flex-col gap-2', className)}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      {isLoading
        ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          )
        : children}
    </section>
  )
}

interface ErrorSlotProps {
  title: string
  description?: string
  onRetry: () => void
  className?: string
}

// ErrorState's children replace its icon, so Retry sits beside it rather than inside.
function ErrorSlot({ title, description, onRetry, className }: ErrorSlotProps) {
  return (
    <div className={cn('col-span-full flex flex-wrap items-center gap-3', className)}>
      <ErrorState title={title} description={description} className="h-auto w-auto flex-1 border-0" />
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

export const ExpandedRowPanel = Object.assign(Root, {
  ActionBar,
  Details,
  Panes,
  Pane,
  Error: ErrorSlot,
})
