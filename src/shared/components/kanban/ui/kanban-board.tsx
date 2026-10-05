'use client'

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import type { KanbanItem, KanbanStageConfig } from '@/shared/components/kanban/types'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useId, useState } from 'react'

import { KanbanColumn } from '@/shared/components/kanban/ui/kanban-column'
import { KanbanDragOverlay } from '@/shared/components/kanban/ui/kanban-drag-overlay'
import { cn } from '@/shared/lib/utils'

interface Props<T extends KanbanItem = KanbanItem> {
  stageConfig: readonly KanbanStageConfig[]
  groupedItems: Record<string, T[]>
  allowedTransitions: Record<string, readonly string[]>
  blockedMessages: Record<string, string>
  onMoveItem?: (itemId: string, fromStage: string, toStage: string) => void
  onBlockedTransition: (message: string) => void
  collapsedStages?: string[]
  getItemHref?: (item: T) => string
  showColumnValues?: boolean
  getItemValue?: (item: T) => number | null
  renderCard: (item: T, href: string, isDragOverlay?: boolean) => React.ReactNode
  className?: string
}

const NO_COLLAPSED_STAGES: string[] = []

// Module constants: useSensor memoizes on the options object, and a new one each render rebuilds dnd-kit's
// context, which re-renders every card and column on the board.
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } }
const TOUCH_SENSOR_OPTIONS = { activationConstraint: { delay: 250, tolerance: 8 } }

function noItemHref() {
  return '#'
}

export function KanbanBoard<T extends KanbanItem>({
  stageConfig,
  groupedItems,
  allowedTransitions,
  blockedMessages,
  onMoveItem,
  onBlockedTransition,
  collapsedStages = NO_COLLAPSED_STAGES,
  getItemHref = noItemHref,
  showColumnValues,
  getItemValue,
  renderCard,
  className,
}: Props<T>) {
  // dnd-kit's default described-by id comes from a module counter that differs between the server and the client,
  // so a server-rendered board would hydrate with a mismatched aria-describedby.
  const dndId = useId()
  const [activeItem, setActiveItem] = useState<T | null>(null)

  const pointerSensor = useSensor(PointerSensor, POINTER_SENSOR_OPTIONS)
  const touchSensor = useSensor(TouchSensor, TOUCH_SENSOR_OPTIONS)
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

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={cn('flex h-full gap-(--gutter) overflow-x-auto pb-2', className)}>
        {stageConfig.map(stage => (
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
      <KanbanDragOverlay activeItem={activeItem} getItemHref={getItemHref} renderCard={renderCard} />
    </DndContext>
  )
}
