'use client'

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { MediaItem } from './types'
import {
  AutoScrollActivator,
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

const AUTO_SCROLL_CONFIG = {
  activator: AutoScrollActivator.Pointer,
  acceleration: 100,
  interval: 5,
  threshold: { x: 0.1, y: 0.25 },
}

export interface MediaReorderGridRenderArgs {
  /** Spread onto the drag handle element. */
  dragHandleProps: Record<string, unknown>
  isDragging: boolean
  /** True when this item is part of a multi-select group being dragged (but isn't the one under the pointer). */
  isGroupDragged: boolean
}

interface MediaReorderGridProps {
  items: MediaItem[]
  onReorder: (updates: { id: number, sortOrder: number }[]) => void
  renderItem: (item: MediaItem, dnd: MediaReorderGridRenderArgs) => ReactNode
  /** Selected ids for multi-drag (empty/undefined = single-drag only). */
  selectedIds?: Set<number>
}

export function MediaReorderGrid({ items, onReorder, renderItem, selectedIds }: MediaReorderGridProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(event.active.id as number)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)

    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const activeId = active.id as number
    const overId = over.id as number

    const oldIndex = items.findIndex(i => i.id === activeId)
    const newIndex = items.findIndex(i => i.id === overId)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Check if this is a group drag (dragged item is selected + others are selected too)
    const isMultiDrag = !!selectedIds && selectedIds.has(activeId) && selectedIds.size > 1

    if (!isMultiDrag) {
      // Simple single-item reorder
      const reordered = arrayMove(items, oldIndex, newIndex)
      const updates = reordered.map((item, i) => ({ id: item.id, sortOrder: i }))
      onReorder(updates)
      return
    }

    // Multi-drag: move all selected items to the drop target position
    const movingIds = new Set(
      [...selectedIds].filter(id => items.some(i => i.id === id)),
    )
    const stationary = items.filter(i => !movingIds.has(i.id))
    const moving = items.filter(i => movingIds.has(i.id))

    // Find where to insert in the stationary list
    const insertIdx = stationary.findIndex(i => i.id === overId)
    const insertAt = insertIdx === -1 ? stationary.length : insertIdx + 1

    const reordered = [
      ...stationary.slice(0, insertAt),
      ...moving,
      ...stationary.slice(insertAt),
    ]
    const updates = reordered.map((item, i) => ({ id: item.id, sortOrder: i }))
    onReorder(updates)
  }

  function handleDragCancel() {
    setDraggingId(null)
  }

  const isGroupDrag = draggingId !== null && !!selectedIds?.has(draggingId) && selectedIds.size > 1

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      autoScroll={AUTO_SCROLL_CONFIG}
    >
      <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-3 overflow-x-clip" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {items.map(item => (
            <SortableItem
              key={item.id}
              item={item}
              renderItem={renderItem}
              isGroupDragged={isGroupDrag && !!selectedIds?.has(item.id) && item.id !== draggingId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/**
 * Internal per-item useSortable wrapper (per the D1 brief) — owns dnd-kit wiring so
 * `renderItem` receives ready-to-spread `dragHandleProps` without callers touching dnd-kit.
 */
function SortableItem({ item, renderItem, isGroupDragged }: {
  item: MediaItem
  renderItem: (item: MediaItem, dnd: MediaReorderGridRenderArgs) => ReactNode
  isGroupDragged: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, { dragHandleProps: { ...attributes, ...listeners }, isDragging, isGroupDragged })}
    </div>
  )
}
