'use client'

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import type { PipelineStageConfig } from '@/features/agent-dashboard/constants/pipeline-stages'
import type { PipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useState } from 'react'

import { KanbanColumn } from '@/features/agent-dashboard/ui/components/kanban-column'
import { KanbanDragOverlay } from '@/features/agent-dashboard/ui/components/kanban-drag-overlay'

interface Props {
  stageConfig: readonly PipelineStageConfig[]
  groupedItems: Record<string, PipelineItem[]>
  allowedTransitions: Record<string, readonly string[]>
  blockedMessages: Record<string, string>
  onMoveItem?: (itemId: string, fromStage: string, toStage: string) => void
  onBlockedTransition: (message: string) => void
  collapsedStages?: string[]
  getItemHref: (item: PipelineItem) => string
  showColumnValues?: boolean
}

export function KanbanBoard({
  stageConfig,
  groupedItems,
  allowedTransitions,
  blockedMessages,
  onMoveItem,
  onBlockedTransition,
  collapsedStages = [],
  getItemHref,
  showColumnValues,
}: Props) {
  const [activeItem, setActiveItem] = useState<PipelineItem | null>(null)

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  const keyboardSensor = useSensor(KeyboardSensor)

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor)

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current as PipelineItem | undefined
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

    const draggedItem = active.data.current as PipelineItem | undefined
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 h-full">
        {stageConfig.map(stage => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            items={groupedItems[stage.key] ?? []}
            collapsed={collapsedStages.includes(stage.key)}
            getItemHref={getItemHref}
            showValueTotal={showColumnValues}
          />
        ))}
      </div>
      <KanbanDragOverlay activeItem={activeItem} getItemHref={getItemHref} />
    </DndContext>
  )
}
