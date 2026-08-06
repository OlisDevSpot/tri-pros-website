'use client'

import type { ReactNode } from 'react'
import type { MediaReorderGridRenderArgs } from './media-reorder-grid'
import type { MediaItem } from './types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface MediaSortableItemProps {
  item: MediaItem
  renderItem: (item: MediaItem, dnd: MediaReorderGridRenderArgs) => ReactNode
  isGroupDragged: boolean
}

/**
 * Per-item dnd-kit `useSortable` wrapper for `MediaReorderGrid` — owns the sortable
 * wiring so `renderItem` receives ready-to-spread `dragHandleProps` without callers
 * touching dnd-kit directly.
 */
export function MediaSortableItem({ item, renderItem, isGroupDragged }: MediaSortableItemProps) {
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
