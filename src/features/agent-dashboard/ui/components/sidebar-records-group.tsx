'use client'

import type { ReactNode } from 'react'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'

import { ChevronRightIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { SIDEBAR_TRANSITION } from '@/features/agent-dashboard/constants/sidebar-motion'
import {
  AnimatedCollapsibleContent,
  Collapsible,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from '@/shared/components/ui/sidebar'

interface SidebarRecordsGroupProps {
  items: readonly SidebarNavItem[]
  renderItem: (item: SidebarNavItem) => ReactNode
}

export function SidebarRecordsGroup({ items, renderItem }: SidebarRecordsGroupProps) {
  const [userOpen, setUserOpen] = useState(true)
  const { state } = useSidebar()
  const isIconCollapsed = state === 'collapsed'
  const open = isIconCollapsed ? true : userOpen

  return (
    <Collapsible open={open} onOpenChange={setUserOpen}>
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-sidebar-foreground">
            <span>Records</span>
            <motion.span
              animate={{ rotate: open ? 90 : 0 }}
              transition={SIDEBAR_TRANSITION}
              className="inline-flex"
            >
              <ChevronRightIcon className="size-3.5 shrink-0" />
            </motion.span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <AnimatedCollapsibleContent open={open}>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </AnimatedCollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
