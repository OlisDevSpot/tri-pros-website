'use client'

import { XIcon } from 'lucide-react'
import { TabsList, tabsTriggerVariants } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'
import { CustomerProfileNewButton } from './customer-profile-new-button'
import { CustomerProfileTabBarTrigger } from './customer-profile-tab-bar-trigger'

interface Props {
  counts: { meetings: number, projects: number }
  newSheetOpen: boolean
  onClose: () => void
  onToggleNew: () => void
}

// Phone only. Close and New are plain buttons outside the tablist so it holds tabs only; the grid
// places them among the tabs: Close · Overview · New · Meetings · Projects. The tablist spans
// columns 2–5 as a subgrid and leaves its second column (the bar's third) to New.
export function CustomerProfileTabBar({ counts, newSheetOpen, onClose, onToggleNew }: Props) {
  return (
    <nav
      aria-label="Customer profile"
      className="relative z-30 grid shrink-0 grid-cols-5 gap-0.5 border-t border-border bg-card px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
      data-profile-tab-bar
    >
      <button className={cn(tabsTriggerVariants({ variant: 'bar' }), 'col-start-1 row-start-1')} onClick={onClose} type="button">
        <XIcon className="size-5" />
        Close
      </button>
      <CustomerProfileNewButton className="col-start-3 row-start-1" onToggle={onToggleNew} open={newSheetOpen} />
      <TabsList
        className="col-span-4 col-start-2 row-start-1 grid grid-cols-subgrid"
        onClick={() => newSheetOpen && onToggleNew()}
        variant="bar"
      >
        {/* Radix onValueChange skips a tap on the already-active tab; this catches that case too
            so tapping any tab closes the New sheet. */}
        <CustomerProfileTabBarTrigger className="col-start-1" value="overview" />
        <CustomerProfileTabBarTrigger className="col-start-3" count={counts.meetings} value="meetings" />
        <CustomerProfileTabBarTrigger className="col-start-4" count={counts.projects} value="projects" />
      </TabsList>
    </nav>
  )
}
