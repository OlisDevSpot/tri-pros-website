'use client'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { CheckIcon, LoaderIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { SIDEBAR_NAV_ACTIVE_STYLE } from '@/features/agent-dashboard/constants/sidebar-styles'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/components/ui/sidebar'
import { ROOTS } from '@/shared/config/roots'
import { PIPELINE_LABELS } from '@/shared/pipelines/constants/pipeline-registry'

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

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        data-nav-item
        tooltip={item.label}
        isActive={isActive}
        className="gap-4 transition-all duration-200 hover:bg-transparent data-[active=true]:bg-transparent"
        style={isActive ? SIDEBAR_NAV_ACTIVE_STYLE : undefined}
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
          <item.icon className={`size-4 shrink-0 transition-colors duration-200 ${isActive ? 'text-primary' : ''}`} />
          <span>{item.label}</span>
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
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 select-none group-data-[collapsible=icon]:hidden disabled:cursor-default"
            style={{
              background: 'linear-gradient(135deg, color-mix(in oklch, var(--primary) 14%, transparent), color-mix(in oklch, var(--primary) 8%, transparent))',
              color: 'color-mix(in oklch, var(--primary) 80%, var(--foreground))',
              backdropFilter: 'blur(8px)',
              border: '1px solid color-mix(in oklch, var(--primary) 18%, transparent)',
              boxShadow: '0 1px 3px color-mix(in oklch, var(--primary) 6%, transparent)',
            }}
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
          className="w-44 rounded-xl border-0 p-1.5 shadow-xl"
          style={{
            background: 'linear-gradient(170deg, color-mix(in oklch, var(--popover) 97%, var(--primary)), var(--popover))',
            backdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid color-mix(in oklch, var(--primary) 12%, var(--border))',
            boxShadow: '0 8px 32px color-mix(in oklch, var(--primary) 8%, transparent), 0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {item.children?.map(child => (
            <button
              key={child.key}
              type="button"
              onClick={() => {
                onPipelineChange(child.key as Pipeline)
                setBadgeOpen(false)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:bg-accent/60"
              style={activePipeline === child.key
                ? {
                    background: 'linear-gradient(135deg, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--primary) 6%, transparent))',
                    color: 'color-mix(in oklch, var(--primary) 85%, var(--foreground))',
                  }
                : undefined}
            >
              <span className="flex-1 text-left">{child.label}</span>
              {activePipeline === child.key && (
                <CheckIcon className="size-3.5 opacity-70" />
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  )
}
