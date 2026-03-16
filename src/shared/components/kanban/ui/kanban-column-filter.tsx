'use client'

import type { KanbanStageConfig } from '@/shared/components/kanban/types'

import { SlidersHorizontalIcon } from 'lucide-react'

import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface Props {
  stages: readonly KanbanStageConfig[]
  visibleStages: Set<string>
  alwaysVisible: Set<string>
  onToggleStage: (stageKey: string) => void
  onShowAll: () => void
  onHideAll: () => void
}

export function KanbanColumnFilter({
  stages,
  visibleStages,
  alwaysVisible,
  onToggleStage,
  onShowAll,
  onHideAll,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontalIcon size={14} />
          Columns
          <Badge variant="secondary" className="text-[10px] px-1.5">
            {visibleStages.size}
            /
            {stages.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Visible Columns</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onShowAll}
            >
              All
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onHideAll}
            >
              None
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {stages.map((stage) => {
            const Icon = stage.icon
            const isAlwaysVisible = alwaysVisible.has(stage.key)
            const isChecked = visibleStages.has(stage.key)

            return (
              <label
                key={stage.key}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={isChecked}
                  disabled={isAlwaysVisible}
                  onCheckedChange={() => onToggleStage(stage.key)}
                />
                <Icon size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{stage.label}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
