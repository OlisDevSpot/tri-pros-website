'use client'

import type { CustomerPipelineItem } from '@/features/pipeline/types'

import { useDraggable } from '@dnd-kit/core'
import { formatDistanceToNow } from 'date-fns'
import { CalendarIcon, FileTextIcon, GripVerticalIcon, UserIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface Props {
  item: CustomerPipelineItem
  isDragOverlay?: boolean
  onViewProfile: (customerId: string) => void
}

export function CustomerKanbanCard({ item, isDragOverlay, onViewProfile }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
  })

  return (
    <Card
      ref={!isDragOverlay ? setNodeRef : undefined}
      className={cn(
        'transition-opacity',
        isDragging && !isDragOverlay && 'opacity-30',
        isDragOverlay && 'shadow-lg rotate-1 scale-105',
      )}
      {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {!isDragOverlay && (
            <GripVerticalIcon size={14} className="text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing touch-none" />
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
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation()
              onViewProfile(item.id)
            }}
            onPointerDown={e => e.stopPropagation()}
          >
            <UserIcon size={12} className="mr-1" />
            Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
