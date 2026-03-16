'use client'

import type { CustomerPipelineItem } from '@/features/pipeline/types'

import { useDraggable } from '@dnd-kit/core'
import { formatDistanceToNow } from 'date-fns'
import { CalendarIcon, FileTextIcon, GripVerticalIcon } from 'lucide-react'

import { EntityProfileButton } from '@/shared/components/entity-actions/entity-profile-button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

interface Props {
  item: CustomerPipelineItem
  isDragOverlay?: boolean
  onViewProfile: (customerId: string) => void
}

export function CustomerKanbanCard({ item, isDragOverlay, onViewProfile }: Props) {
  const isMobile = useIsMobile()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
  })

  const cardDragProps = !isDragOverlay && !isMobile ? { ...attributes, ...listeners } : {}
  const handleDragProps = !isDragOverlay && isMobile ? { ...attributes, ...listeners } : {}

  return (
    <Card
      ref={!isDragOverlay ? setNodeRef : undefined}
      className={cn(
        'transition-opacity',
        isDragging && !isDragOverlay && 'opacity-30',
        isDragOverlay && 'shadow-lg rotate-1 scale-105',
      )}
      {...cardDragProps}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {!isDragOverlay && (
            <span
              className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
              {...handleDragProps}
            >
              <GripVerticalIcon size={14} className="text-muted-foreground/40" />
            </span>
          )}
          <span className="font-medium text-sm truncate flex-1">
            {item.name}
          </span>
        </div>

        {item.totalPipelineValue > 0 && (
          <p className="text-sm font-semibold text-green-600">
            $
            {item.totalPipelineValue.toLocaleString()}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <CalendarIcon size={11} />
            {item.meetingCount}
          </span>
          <span className="flex items-center gap-0.5">
            <FileTextIcon size={11} />
            {item.proposalCount}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/70">
            {formatDistanceToNow(new Date(item.latestActivityAt), { addSuffix: true })}
          </p>
          <EntityProfileButton
            onClick={(e) => {
              e.stopPropagation()
              onViewProfile(item.id)
            }}
            onPointerDown={e => e.stopPropagation()}
          />
        </div>
      </CardContent>
    </Card>
  )
}
