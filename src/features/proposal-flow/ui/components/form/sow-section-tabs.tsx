import type { ComponentProps } from 'react'
import type { SowSectionTab } from '@/features/proposal-flow/constants/sow-section-tabs'
import { SOW_SECTION_TABS } from '@/features/proposal-flow/constants/sow-section-tabs'
import { Tabs } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'

type Props = Omit<ComponentProps<typeof Tabs>, 'value' | 'defaultValue' | 'onValueChange'> & {
  tab: SowSectionTab
  onTabChange: (tab: SowSectionTab) => void
}

// The tabs' root is the whole section item (the Collapsible renders through it): at md and up the tab list rides in
// the sticky block beside the header while the panels sit in the body. gap-0 keeps the Tabs default gap off the item.
export function SowSectionTabs({ tab, onTabChange, className, ...props }: Props) {
  return (
    <Tabs
      {...props}
      value={tab}
      onValueChange={(value) => {
        const next = SOW_SECTION_TABS.find(t => t.id === value)
        if (next) {
          onTabChange(next.id)
        }
      }}
      className={cn('gap-0', className)}
    />
  )
}
