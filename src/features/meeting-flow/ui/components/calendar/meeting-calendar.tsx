'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { MeetingCalendarEvent } from '@/features/meeting-flow/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { MeetingOverviewCardData } from '@/shared/entities/meetings/components/overview-card'
import type { MeetingOutcome } from '@/shared/types/enums'
import type { AppRouter } from '@/trpc/routers/app'

import { ChevronDownIcon, MapPinIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { toCalendarEvent } from '@/features/meeting-flow/lib/to-calendar-event'
import { getDateRange } from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarHeader } from '@/shared/components/calendar/ui/calendar-header'
import { CalendarMonthView } from '@/shared/components/calendar/ui/calendar-month-view'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { cn } from '@/shared/lib/utils'

import { MeetingCalendarDot } from './meeting-calendar-dot'
import { MeetingTodayView } from './meeting-today-view'
import { MeetingWeekView } from './meeting-week-view'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

const DEFAULT_HIDDEN_DAYS = [6] // Saturday

const STATUS_BG_TINTS: Partial<Record<MeetingOutcome, string>> = {
  not_set: 'bg-zinc-500/5 border-zinc-500/20',
  converted_to_project: 'bg-emerald-500/5 border-emerald-500/20',
  proposal_sent: 'bg-lime-500/5 border-lime-500/20',
  proposal_created: 'bg-amber-500/5 border-amber-500/20',
  follow_up_needed: 'bg-purple-500/5 border-purple-500/20',
  not_good: 'bg-red-500/5 border-red-500/20',
  pns: 'bg-red-500/5 border-red-500/20',
  npns: 'bg-red-500/5 border-red-500/20',
  ftd: 'bg-red-500/5 border-red-500/20',
  no_show: 'bg-red-500/5 border-red-500/20',
  lost_to_competitor: 'bg-red-500/5 border-red-500/20',
  not_interested: 'bg-red-500/5 border-red-500/20',
}

interface MeetingCalendarProps {
  data: MeetingRow[]
  actions: EntityActionConfig<MeetingCalendarEvent>[]
  onAssignOwner?: (event: MeetingCalendarEvent) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  onDateRangeChange?: (range: { from: Date, to: Date }) => void
  activeView?: CalendarViewType
  onViewChange?: (view: CalendarViewType) => void
  showSaturday?: boolean
  onToggleSaturday?: () => void
}

export function MeetingCalendar({
  data,
  actions,
  onAssignOwner,
  onUpdateScheduledFor,
  onDateRangeChange,
  activeView = 'week',
  showSaturday = false,
}: MeetingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const events = useMemo(() => data.map(toCalendarEvent), [data])

  const hiddenDays = showSaturday
    ? DEFAULT_HIDDEN_DAYS.filter(d => d !== 6)
    : [...new Set([...DEFAULT_HIDDEN_DAYS, 6])]

  // Fire onDateRangeChange when currentDate or activeView changes
  const range = useMemo(
    () => getDateRange(currentDate, activeView),
    [currentDate, activeView],
  )

  useEffect(() => {
    onDateRangeChange?.(range)
  }, [range, onDateRangeChange])

  const renderCard = useCallback(
    (event: MeetingCalendarEvent) => {
      const meetingData: MeetingOverviewCardData = {
        id: event.meetingId,
        meetingOutcome: event.meetingOutcome,
        meetingType: event.meetingType,
        scheduledFor: event.startAt,
        customerId: event.customerId,
        ownerId: event.ownerId,
        createdAt: event.createdAt,
        ownerName: event.ownerName,
        ownerImage: event.ownerImage,
        customerName: event.customerName,
        customerPhone: event.customerPhone,
        customerAddress: event.customerAddress,
        customerCity: event.customerCity,
        customerState: event.customerState,
        customerZip: event.customerZip,
      }

      const handleAssignOwner = onAssignOwner
        ? () => onAssignOwner(event)
        : undefined

      return (
        <MeetingOverviewCard
          meeting={meetingData}
          customerId={event.customerId ?? ''}
          onAssignOwner={handleAssignOwner}
          className={cn(
            'group relative flex h-full flex-col gap-1.5 overflow-hidden rounded-md border p-2.5 text-xs cursor-pointer transition-colors hover:border-foreground/20',
            STATUS_BG_TINTS[event.meetingOutcome],
          )}
        >
          {/* Row 1: Status dot + customer name + actions */}
          <MeetingOverviewCard.Header className="gap-1.5 min-w-0">
            <MeetingOverviewCard.Fields fields={[{ field: 'outcome', variant: 'dot' }]} />
            <MeetingOverviewCard.CustomerName className="font-medium truncate flex-1 leading-tight" />
            <MeetingOverviewCard.Actions
              mode="compact"
              className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            />
          </MeetingOverviewCard.Header>

          {/* Row 2: Scheduled time (editable badge) */}
          <MeetingOverviewCard.Fields fields={[{
            field: 'scheduledDate',
            format: 'time-only',
            onChange: (date: Date) => onUpdateScheduledFor(event.meetingId, date),
          }]}
          />

          {/* Row 3: Phone */}
          <MeetingOverviewCard.Phone />

          {/* Row 4: Address */}
          <MeetingOverviewCard.Address>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-w-0"
              onClick={e => e.stopPropagation()}
            >
              <MapPinIcon size={14} className="shrink-0" />
              <span className="min-w-0">
                {event.customerAddress && <span className="block truncate text-left">{event.customerAddress}</span>}
                {[event.customerCity, event.customerState, event.customerZip].filter(Boolean).join(', ') && (
                  <span className="block truncate text-left text-[10px] opacity-70">
                    {[event.customerCity, event.customerState, event.customerZip].filter(Boolean).join(', ')}
                  </span>
                )}
              </span>
              <ChevronDownIcon size={12} className="shrink-0" />
            </button>
          </MeetingOverviewCard.Address>
        </MeetingOverviewCard>
      )
    },
    [onAssignOwner, onUpdateScheduledFor],
  )

  const renderCompact = useCallback(
    (event: MeetingCalendarEvent) => (
      <MeetingCalendarDot
        event={event}
        actions={actions}
        onUpdateScheduledFor={onUpdateScheduledFor}
      />
    ),
    [actions, onUpdateScheduledFor],
  )

  return (
    <div className="flex h-full w-full flex-col rounded-xl border">
      <CalendarHeader
        currentDate={currentDate}
        activeView={activeView}
        onDateChange={setCurrentDate}
      />

      <div className="w-full flex-1 min-h-0 overflow-hidden">
        {activeView === 'today' && (
          <MeetingTodayView
            events={events}
            currentDate={currentDate}
            renderCard={renderCard}
          />
        )}

        {activeView === 'week' && (
          <MeetingWeekView
            events={events}
            currentDate={currentDate}
            hiddenDays={hiddenDays}
            renderCard={renderCard}
          />
        )}

        {activeView === 'month' && (
          <CalendarMonthView
            events={events}
            currentDate={currentDate}
            renderCompact={renderCompact}
          />
        )}
      </div>
    </div>
  )
}
