'use client'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { EntityActionClickConfig, EntityActionConfig } from '@/shared/components/entity-actions/types'
import { format } from 'date-fns'

import { MEETING_OUTCOME_COLORS, MEETING_OUTCOME_DOT_COLORS, MEETING_OUTCOME_LABELS } from '@/features/meetings/constants/status-colors'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { isSelectAction } from '@/shared/components/entity-actions/types'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'
import { useAbility } from '@/shared/permissions/hooks'

interface MeetingCalendarDotProps {
  event: MeetingCalendarEvent
  actions: EntityActionConfig<MeetingCalendarEvent>[]
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
}

export function MeetingCalendarDot({
  event,
  actions,
  onUpdateScheduledFor,
}: MeetingCalendarDotProps) {
  const ability = useAbility()

  const formattedTime = format(new Date(event.startAt), 'h:mm a')
  const formattedDateTime = format(new Date(event.startAt), 'MMM d, h:mm a')

  const formattedAddress = [event.customerAddress, event.customerCity]
    .filter(Boolean)
    .join(', ')

  const permittedActions = actions.filter(({ action }) => {
    if (!action.permission) {
      return true
    }
    return ability.can(action.permission[0], action.permission[1])
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-accent transition-colors text-left min-w-0"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              MEETING_OUTCOME_DOT_COLORS[event.meetingOutcome],
            )}
          />
          <span className="text-muted-foreground shrink-0">{formattedTime}</span>
          <span className="truncate">{event.customerName ?? 'No customer'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        {/* Customer name */}
        <p className="font-semibold text-sm leading-tight truncate">
          {event.customerName ?? 'No customer'}
        </p>

        {/* Time + date (editable) */}
        <div onClick={e => e.stopPropagation()}>
          <DateTimePicker
            value={new Date(event.startAt)}
            onChange={(date) => {
              if (date) {
                onUpdateScheduledFor(event.meetingId, date)
              }
            }}
            className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{formattedDateTime}</span>
          </DateTimePicker>
        </div>

        {/* Status badge */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={cn('text-[10px] px-1.5 py-0 leading-4', MEETING_OUTCOME_COLORS[event.meetingOutcome])}>
            {MEETING_OUTCOME_LABELS[event.meetingOutcome] ?? event.meetingOutcome.replace(/_/g, ' ')}
          </Badge>
        </div>

        {/* Contact actions */}
        {event.customerPhone && (
          <div className="text-muted-foreground" onClick={e => e.stopPropagation()}>
            <PhoneAction phone={event.customerPhone} className="text-xs" />
          </div>
        )}
        {formattedAddress && (
          <div className="text-muted-foreground" onClick={e => e.stopPropagation()}>
            <AddressAction address={formattedAddress} className="text-xs" />
          </div>
        )}

        {/* Action buttons — CASL-gated, click actions only (select actions need sub-menus) */}
        {permittedActions.length > 0 && (
          <div className="flex flex-col gap-1 border-t pt-2">
            {permittedActions
              .filter((c): c is EntityActionClickConfig<MeetingCalendarEvent> => !isSelectAction(c))
              .map((config) => {
                const Icon = config.action.icon
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
                    <Icon className="h-3.5 w-3.5" />
                    {config.action.label}
                  </Button>
                )
              })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
