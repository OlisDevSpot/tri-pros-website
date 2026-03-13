'use client'

import type { PipelineStageConfig } from '@/features/agent-dashboard/constants/pipeline-stages'
import type { PipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import { useDroppable } from '@dnd-kit/core'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { KanbanCard } from '@/features/agent-dashboard/ui/components/kanban-card'
import { KanbanEmptyColumn } from '@/features/agent-dashboard/ui/components/kanban-empty-column'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

interface Props {
  stage: PipelineStageConfig
  items: PipelineItem[]
  collapsed?: boolean
  getItemHref: (item: PipelineItem) => string
  showValueTotal?: boolean
}

const stageColorMap: Record<string, string> = {
  blue: 'border-t-blue-500',
  yellow: 'border-t-yellow-500',
  slate: 'border-t-slate-400',
  orange: 'border-t-orange-500',
  green: 'border-t-green-500',
  red: 'border-t-red-500',
}

const badgeColorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-600',
  yellow: 'bg-yellow-500/10 text-yellow-600',
  slate: 'bg-slate-500/10 text-slate-600',
  orange: 'bg-orange-500/10 text-orange-600',
  green: 'bg-green-500/10 text-green-600',
  red: 'bg-red-500/10 text-red-600',
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents)
}

export function KanbanColumn({ stage, items, collapsed: initialCollapsed, getItemHref, showValueTotal }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed ?? false)
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })

  const Icon = stage.icon
  const borderColor = stageColorMap[stage.color] ?? 'border-t-muted'
  const badgeColor = badgeColorMap[stage.color] ?? 'bg-muted text-muted-foreground'

  if (isCollapsed) {
    return (
      <div className="min-w-[280px] flex-1">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-muted-foreground/30 hover:bg-accent/50 transition-colors"
        >
          <Icon size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{stage.label}</span>
          <Badge variant="secondary" className={cn('text-xs', badgeColor)}>
            {items.length}
          </Badge>
          <ChevronDownIcon size={14} className="ml-auto text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-w-[280px] flex-1 flex flex-col rounded-lg border border-border/50 bg-muted/30 border-t-2 transition-all',
        borderColor,
        isOver && 'ring-2 ring-primary/30 bg-primary/5',
      )}
    >
      <div className="flex items-center gap-2 p-3 pb-2">
        <Icon size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{stage.label}</span>
        <Badge variant="secondary" className={cn('text-xs', badgeColor)}>
          {items.length}
        </Badge>
        {showValueTotal && (() => {
          const total = items.reduce((sum, item) => sum + (('value' in item && item.value) ? Number(item.value) : 0), 0)
          return total > 0
            ? <span className="text-xs font-semibold text-emerald-500 tabular-nums">{formatCurrency(total)}</span>
            : null
        })()}
        {initialCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon size={14} className="rotate-180" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {items.length === 0
          ? <KanbanEmptyColumn label={stage.label} />
          : items.map(item => (
              <KanbanCard key={item.id} item={item} href={getItemHref(item)} />
            ))}
      </div>
    </div>
  )
}
