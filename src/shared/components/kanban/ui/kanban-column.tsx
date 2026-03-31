'use client'

import type { KanbanItem, KanbanStageConfig } from '@/shared/components/kanban/types'

import { useDroppable } from '@dnd-kit/core'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { badgeColorMap, stageColorMap } from '@/shared/components/kanban/constants/color-maps'
import { KanbanEmptyColumn } from '@/shared/components/kanban/ui/kanban-empty-column'
import { Badge } from '@/shared/components/ui/badge'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props<T extends KanbanItem = KanbanItem> {
  stage: KanbanStageConfig
  items: T[]
  collapsed?: boolean
  getItemHref?: (item: T) => string
  showValueTotal?: boolean
  getItemValue?: (item: T) => number | null
  renderCard: (item: T, href: string, isDragOverlay?: boolean) => React.ReactNode
}

export function KanbanColumn<T extends KanbanItem>({
  stage,
  items,
  collapsed: initialCollapsed,
  getItemHref = () => '#',
  showValueTotal,
  getItemValue,
  renderCard,
}: Props<T>) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed ?? false)
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })

  const Icon = stage.icon
  const borderColor = stageColorMap[stage.color] ?? 'border-t-muted'
  const badgeColor = badgeColorMap[stage.color] ?? 'bg-muted text-muted-foreground'

  if (isCollapsed) {
    return (
      <div className="min-w-70 flex-1">
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
        'min-w-70 flex-1 flex flex-col rounded-lg border border-border/50 bg-muted/30 border-t-2 transition-all',
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
        {showValueTotal && getItemValue && (() => {
          const total = items.reduce((sum, item) => sum + (getItemValue(item) ?? 0), 0)
          return total > 0
            ? <span className="text-xs font-semibold text-emerald-500 tabular-nums">{formatAsDollars(total)}</span>
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
              <div key={item.id}>{renderCard(item, getItemHref(item))}</div>
            ))}
      </div>
    </div>
  )
}
