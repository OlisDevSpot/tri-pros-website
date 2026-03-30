'use client'

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import type { KanbanColumnFilterConfig, KanbanItem, KanbanStageConfig } from '@/shared/components/kanban/types'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'

import { KanbanColumn } from '@/shared/components/kanban/ui/kanban-column'
import { KanbanColumnFilter } from '@/shared/components/kanban/ui/kanban-column-filter'
import { KanbanDragOverlay } from '@/shared/components/kanban/ui/kanban-drag-overlay'

interface Props<T extends KanbanItem = KanbanItem> {
  stageConfig: readonly KanbanStageConfig[]
  groupedItems: Record<string, T[]>
  allowedTransitions: Record<string, readonly string[]>
  blockedMessages: Record<string, string>
  onMoveItem?: (itemId: string, fromStage: string, toStage: string) => void
  onBlockedTransition: (message: string) => void
  collapsedStages?: string[]
  columnFilter?: KanbanColumnFilterConfig
  headerSlot?: React.ReactNode
  getItemHref: (item: T) => string
  showColumnValues?: boolean
  getItemValue?: (item: T) => number | null
  renderCard: (item: T, href: string, isDragOverlay?: boolean) => React.ReactNode
}

export function KanbanBoard<T extends KanbanItem>({
  stageConfig,
  groupedItems,
  allowedTransitions,
  blockedMessages,
  onMoveItem,
  onBlockedTransition,
  collapsedStages = [],
  columnFilter,
  headerSlot,
  getItemHref,
  showColumnValues,
  getItemValue,
  renderCard,
}: Props<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null)

  const [visibleStages, setVisibleStages] = useState<Set<string>>(() => {
    if (columnFilter?.defaultVisible) {
      return new Set(columnFilter.defaultVisible)
    }
    return new Set(stageConfig.map(s => s.key))
  })

  // Reset visible stages when stage config changes (e.g., switching pipelines)
  const stageKeys = stageConfig.map(s => s.key).join(',')
  useEffect(() => {
    if (columnFilter?.defaultVisible) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setVisibleStages(new Set(columnFilter.defaultVisible))
    }
    else {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setVisibleStages(new Set(stageConfig.map(s => s.key)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when stages change
  }, [stageKeys])

  const alwaysVisible = useMemo(
    () => new Set(columnFilter?.alwaysVisible ?? []),
    [columnFilter?.alwaysVisible],
  )

  const filteredStageConfig = columnFilter
    ? stageConfig.filter(s => visibleStages.has(s.key))
    : stageConfig

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },
  })
  const keyboardSensor = useSensor(KeyboardSensor)

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor)

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current as T | undefined
    if (item) {
      setActiveItem(item)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null)

    const { active, over } = event
    if (!over) {
      return
    }

    const draggedItem = active.data.current as T | undefined
    if (!draggedItem) {
      return
    }

    const toStage = over.id as string
    const fromStage = draggedItem.stage

    if (fromStage === toStage) {
      return
    }

    const allowedTargets = allowedTransitions[fromStage] ?? []
    if (allowedTargets.includes(toStage)) {
      onMoveItem?.(draggedItem.id, fromStage, toStage)
    }
    else {
      const transitionKey = `${fromStage}->${toStage}`
      const message = blockedMessages[transitionKey]
        ?? blockedMessages.default
        ?? 'This transition is not supported'
      onBlockedTransition(message)
    }
  }

  function handleToggleStage(key: string) {
    setVisibleStages((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      }
      else {
        next.add(key)
      }
      return next
    })
  }

  function handleShowAll() {
    setVisibleStages(new Set(stageConfig.map(s => s.key)))
  }

  function handleHideAll() {
    setVisibleStages(new Set(columnFilter?.alwaysVisible ?? []))
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {(columnFilter || headerSlot) && (
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-2">
              {headerSlot}
            </div>
            {columnFilter && (
              <KanbanColumnFilter
                stages={stageConfig}
                visibleStages={visibleStages}
                alwaysVisible={alwaysVisible}
                onToggleStage={handleToggleStage}
                onShowAll={handleShowAll}
                onHideAll={handleHideAll}
              />
            )}
          </div>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2 flex-1 min-h-0">
          {filteredStageConfig.map(stage => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              items={groupedItems[stage.key] ?? []}
              collapsed={collapsedStages.includes(stage.key)}
              getItemHref={getItemHref}
              showValueTotal={showColumnValues}
              getItemValue={getItemValue}
              renderCard={renderCard}
            />
          ))}
        </div>
      </div>
      <KanbanDragOverlay activeItem={activeItem} getItemHref={getItemHref} renderCard={renderCard} />
    </DndContext>
  )
}
