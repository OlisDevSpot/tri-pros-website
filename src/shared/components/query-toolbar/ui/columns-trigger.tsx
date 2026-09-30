'use client'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'
import { Columns3Icon } from 'lucide-react'

import { useState } from 'react'

import { ColumnsBody } from '@/shared/components/query-toolbar/ui/columns-body'
import { SheetDragHandle } from '@/shared/components/query-toolbar/ui/sheet-drag-handle'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { cn } from '@/shared/lib/utils'

interface ColumnsTriggerProps {
  visibility: UseColumnVisibilityResult
}

export function QueryToolbarColumnsTrigger({ visibility }: ColumnsTriggerProps) {
  const { toggleableColumns, hiddenCount, setColumnVisible, resetVisibility } = visibility
  const [open, setOpen] = useState(false)
  const isBelowLg = useIsBelowLg()

  if (toggleableColumns.length === 0) {
    return null
  }

  const visibleLabel = hiddenCount > 0 ? `Columns · ${hiddenCount}` : 'Columns'
  const ariaLabel = hiddenCount > 0 ? `Columns, ${hiddenCount} hidden` : 'Columns'
  const triggerClassName = cn(
    'h-11 w-11 lg:h-9 lg:w-auto px-0 lg:px-3 font-normal gap-1.5 touch-manipulation',
    hiddenCount > 0 && 'border-border-strong text-foreground',
  )

  const triggerInner = (
    <>
      <span className="sr-only lg:not-sr-only">{visibleLabel}</span>
      <Columns3Icon className="size-4 opacity-80" aria-hidden />
    </>
  )

  if (isBelowLg) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" className={triggerClassName} aria-label={ariaLabel}>
            {triggerInner}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="flex max-h-[85svh] flex-col gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Toggle columns</SheetTitle>
          </SheetHeader>
          <SheetDragHandle />
          <ColumnsBody
            toggleableColumns={toggleableColumns}
            hiddenCount={hiddenCount}
            onToggle={setColumnVisible}
            onReset={resetVisibility}
          />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={triggerClassName} aria-label={ariaLabel}>
          {triggerInner}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <ColumnsBody
          toggleableColumns={toggleableColumns}
          hiddenCount={hiddenCount}
          onToggle={setColumnVisible}
          onReset={resetVisibility}
        />
      </PopoverContent>
    </Popover>
  )
}
