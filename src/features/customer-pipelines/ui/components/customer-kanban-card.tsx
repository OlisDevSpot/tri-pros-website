'use client'

import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { CustomerPipeline } from '@/shared/types/enums'

import { useDraggable } from '@dnd-kit/core'
import { formatDistanceToNow } from 'date-fns'
import { CalendarIcon, FileTextIcon, GripVerticalIcon } from 'lucide-react'

import { PIPELINE_LABELS } from '@/features/customer-pipelines/constants/pipeline-labels'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import { customerPipelines } from '@/shared/constants/enums'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

interface Props {
  item: CustomerPipelineItem
  currentPipeline: CustomerPipeline
  isDragOverlay?: boolean
  canManagePipeline?: boolean
  onViewProfile: (customerId: string) => void
  onMoveToPipeline?: (customerId: string, pipeline: CustomerPipeline) => void
  onCreateMeeting?: (customerId: string) => void
}

export function CustomerKanbanCard({ item, currentPipeline, isDragOverlay, canManagePipeline, onViewProfile, onMoveToPipeline, onCreateMeeting }: Props) {
  const isMobile = useIsMobile()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
  })

  const cardDragProps = !isDragOverlay && !isMobile ? { ...attributes, ...listeners } : {}
  const handleDragProps = !isDragOverlay && isMobile ? { ...attributes, ...listeners } : {}

  function handleClick() {
    if (!isDragging && !isDragOverlay) {
      onViewProfile(item.id)
    }
  }

  const otherPipelines = customerPipelines.filter(p => p !== currentPipeline)

  const cardContent = (
    <Card
      ref={!isDragOverlay ? setNodeRef : undefined}
      className={cn(
        'cursor-pointer transition-colors duration-200 hover:bg-primary/5',
        isDragging && !isDragOverlay && 'opacity-30',
        isDragOverlay && 'shadow-lg rotate-1 scale-105',
      )}
      onClick={handleClick}
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
          {item.latestActivityAt && (
            <span className="ml-auto text-[11px] text-muted-foreground/70">
              {formatDistanceToNow(new Date(item.latestActivityAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {item.stage === 'needs_confirmation' && onCreateMeeting && (
          <Button
            size="sm"
            className="w-full mt-1"
            onClick={(e) => {
              e.stopPropagation()
              onCreateMeeting(item.id)
            }}
          >
            + Schedule Meeting
          </Button>
        )}
      </CardContent>
    </Card>
  )

  if (canManagePipeline && onMoveToPipeline && !isDragOverlay) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {cardContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to Pipeline</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {otherPipelines.map(p => (
                <ContextMenuItem
                  key={p}
                  onClick={() => onMoveToPipeline(item.id, p)}
                >
                  {PIPELINE_LABELS[p]}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return cardContent
}
