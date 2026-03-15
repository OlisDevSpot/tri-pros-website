'use client'

import type { KanbanItem } from '@/shared/components/kanban/types'

import { DragOverlay } from '@dnd-kit/core'

interface Props<T extends KanbanItem = KanbanItem> {
  activeItem: T | null
  getItemHref: (item: T) => string
  renderCard: (item: T, href: string, isDragOverlay?: boolean) => React.ReactNode
}

export function KanbanDragOverlay<T extends KanbanItem>({ activeItem, getItemHref, renderCard }: Props<T>) {
  return (
    <DragOverlay>
      {activeItem
        ? renderCard(activeItem, getItemHref(activeItem), true)
        : null}
    </DragOverlay>
  )
}
