'use client'

import type { PipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import { DragOverlay } from '@dnd-kit/core'

import { KanbanCard } from '@/features/agent-dashboard/ui/components/kanban-card'

interface Props {
  activeItem: PipelineItem | null
  getItemHref: (item: PipelineItem) => string
}

export function KanbanDragOverlay({ activeItem, getItemHref }: Props) {
  return (
    <DragOverlay>
      {activeItem
        ? <KanbanCard item={activeItem} href={getItemHref(activeItem)} isDragOverlay />
        : null}
    </DragOverlay>
  )
}
