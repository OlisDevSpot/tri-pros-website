'use client'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { CheckIcon, LoaderIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'

import { SIDEBAR_LABEL_ANIMATE, SIDEBAR_TRANSITION } from '@/features/agent-dashboard/constants/sidebar-motion'
import { SIDEBAR_NAV_ITEM_CLASS } from '@/features/agent-dashboard/constants/sidebar-styles'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/shared/components/ui/sidebar'
import { ROOTS } from '@/shared/config/roots'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { cn } from '@/shared/lib/utils'

interface SidebarPipelineItemProps {
  item: SidebarNavItem
  isActive: boolean
  activePipeline: Pipeline
  hydrated: boolean
  onPipelineChange: (pipeline: Pipeline) => void
  onNavigate: () => void
}

export function SidebarPipelineItem({
  item,
  isActive,
  activePipeline,
  hydrated,
  onPipelineChange,
  onNavigate,
}: SidebarPipelineItemProps) {
  const [badgeOpen, setBadgeOpen] = useState(false)
  const { state, isMobile } = useSidebar()
  const isIconCollapsed = state === 'collapsed' && !isMobile

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={item.label}
        isActive={isActive}
        className={cn('gap-4', SIDEBAR_NAV_ITEM_CLASS)}
      >
        <Link
          href={hydrated ? ROOTS.dashboard.pipeline(activePipeline) : item.href}
          onClick={(e) => {
            if (!item.enabled) {
              e.preventDefault()
              return
            }
            onNavigate()
          }}
          className={item.enabled ? '' : 'pointer-events-none opacity-50'}
        >
          <item.icon className="size-4 shrink-0 transition-colors duration-200" />
          <motion.span
            initial={false}
            animate={isIconCollapsed ? SIDEBAR_LABEL_ANIMATE.collapsed : SIDEBAR_LABEL_ANIMATE.expanded}
            transition={SIDEBAR_TRANSITION}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        </Link>
      </SidebarMenuButton>

      {/* Pipeline badge dropdown — when sidebar is icon-only, hidden */}
      <Popover open={hydrated ? badgeOpen : false} onOpenChange={setBadgeOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!hydrated}
            onClick={(e) => {
              e.stopPropagation()
            }}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider select-none transition-[opacity,transform,background,color,box-shadow] duration-200 ease-linear disabled:cursor-default group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:scale-90 group-data-[collapsible=icon]:opacity-0',
              'border-sidebar-border text-sidebar-active-icon',
            )}
          >
            {hydrated
              ? PIPELINE_LABELS[activePipeline]
              : <LoaderIcon size={10} className="animate-spin" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-44 rounded-xl p-1.5 shadow-lg"
        >
          {item.children?.map((child) => {
            const isCurrent = activePipeline === child.key
            return (
              <button
                key={child.key}
                type="button"
                onClick={() => {
                  onPipelineChange(child.key as Pipeline)
                  setBadgeOpen(false)
                }}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-accent', isCurrent && 'bg-accent font-semibold')}
              >
                <span className="flex-1 text-left">{child.label}</span>
                {isCurrent && (
                  <CheckIcon className="size-3.5 opacity-70" />
                )}
              </button>
            )
          })}
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  )
}
