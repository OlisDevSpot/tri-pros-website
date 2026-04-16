'use client'

import type { ScheduleActivityEvent, ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { format } from 'date-fns'

import { ACTIVITY_TYPE_BG_TINTS } from '@/features/schedule-management/constants/schedule-calendar-config'
import { Badge } from '@/shared/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { ACTIVITY_TYPE_CONFIG } from '@/shared/entities/activities/constants'
import { cn } from '@/shared/lib/utils'

import { DotActions } from './dot-actions'

interface ActivityDotContentProps {
  event: ScheduleActivityEvent
  formattedTime: string
  permittedActions: EntityActionConfig<ScheduleCalendarEvent>[]
}

export function ActivityDotContent({
  event,
  formattedTime,
  permittedActions,
}: ActivityDotContentProps) {
  const config = ACTIVITY_TYPE_CONFIG[event.activityType]
  const Icon = config.icon

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-accent transition-colors text-left min-w-0"
        >
          <Icon size={10} className={cn('shrink-0', config.color)} />
          <span className="text-muted-foreground shrink-0">{formattedTime}</span>
          <span className="truncate">{event.title}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        {/* Title with type icon */}
        <div className="flex items-center gap-2">
          <span className={cn('rounded p-1', ACTIVITY_TYPE_BG_TINTS[event.activityType])}>
            <Icon size={14} className={config.color} />
          </span>
          <p className="font-semibold text-sm leading-tight truncate">
            {event.title}
          </p>
        </div>

        {/* Type badge */}
        <Badge className={cn('text-[10px] px-1.5 py-0 leading-4', config.bgColor, config.color)}>
          {config.label}
        </Badge>

        {/* Description */}
        {event.description && (
          <p className="text-xs text-muted-foreground line-clamp-3">
            {event.description}
          </p>
        )}

        {/* Scheduled time */}
        <p className="text-xs text-muted-foreground">
          {format(new Date(event.startAt), 'MMM d, h:mm a')}
        </p>

        {/* Action buttons */}
        <DotActions actions={permittedActions} event={event} />
      </PopoverContent>
    </Popover>
  )
}
