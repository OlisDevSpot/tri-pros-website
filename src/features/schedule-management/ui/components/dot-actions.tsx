'use client'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'
import type { EntityActionClickConfig, EntityActionConfig } from '@/shared/components/entity-actions/types'

import { isSelectAction } from '@/shared/components/entity-actions/types'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface DotActionsProps {
  actions: EntityActionConfig<ScheduleCalendarEvent>[]
  event: ScheduleCalendarEvent
}

export function DotActions({ actions, event }: DotActionsProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 border-t pt-2">
      {actions
        .filter((c): c is EntityActionClickConfig<ScheduleCalendarEvent> => !isSelectAction(c))
        .map((config) => {
          const ActionIcon = config.action.icon
          return (
            <Button
              key={config.action.id}
              variant="ghost"
              size="sm"
              className={cn(
                'justify-start h-7 text-xs',
                config.action.destructive && 'text-destructive hover:text-destructive',
              )}
              disabled={config.isLoading || config.isDisabled}
              onClick={() => config.onAction(event)}
            >
              <ActionIcon className="h-3.5 w-3.5" />
              {config.action.label}
            </Button>
          )
        })}
    </div>
  )
}
