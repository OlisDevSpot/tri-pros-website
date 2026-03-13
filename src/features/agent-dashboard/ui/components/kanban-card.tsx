'use client'

import type { PipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import { useDraggable } from '@dnd-kit/core'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLinkIcon, EyeIcon, FlameIcon, GripVerticalIcon } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'

interface Props {
  item: PipelineItem
  href: string
  isDragOverlay?: boolean
}

export function KanbanCard({ item, href, isDragOverlay }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
  })

  const timeLabel = item.type === 'proposal' && item.sentAt
    ? `Sent ${formatDistanceToNow(new Date(item.sentAt), { addSuffix: true })}`
    : `Created ${formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}`

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
            {item.customerName}
          </span>
          <Link
            href={href}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded hover:bg-accent transition-colors"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            <ExternalLinkIcon size={14} />
          </Link>
        </div>

        {item.type === 'proposal' && item.value != null && (
          <p className="text-sm font-semibold text-green-600">
            $
            {item.value.toLocaleString()}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.type === 'meeting' && item.program && (
            <span className="truncate">{item.program}</span>
          )}
          {item.type === 'proposal' && item.trade && (
            <span className="truncate">{item.trade}</span>
          )}
          {item.type === 'proposal' && item.viewCount > 0 && (
            <span className="flex items-center gap-0.5 shrink-0">
              {item.viewCount >= 3 && (
                <FlameIcon size={12} className="text-orange-500" />
              )}
              <EyeIcon size={12} />
              {item.viewCount}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/70">{timeLabel}</p>
          {item.type === 'meeting' && item.proposalId && (
            <Badge variant="outline" className="text-[10px]">Has Proposal</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
