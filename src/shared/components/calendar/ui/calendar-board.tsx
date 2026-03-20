'use client'

import type { CalendarBoardProps, CalendarEvent, CalendarViewType } from '@/shared/components/calendar/types'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getDateRange } from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarHeader } from '@/shared/components/calendar/ui/calendar-header'
import { CalendarMonthView } from '@/shared/components/calendar/ui/calendar-month-view'
import { CalendarWeekView } from '@/shared/components/calendar/ui/calendar-week-view'
import { cn } from '@/shared/lib/utils'

const DEFAULT_HIDDEN_DAYS = [6] // Saturday

export function CalendarBoard<T extends CalendarEvent>({
  events,
  config,
  renderCard,
  renderCompact,
  onEventClick: _onEventClick,
  onDateRangeChange,
  activeView: controlledView,
  onViewChange: _onViewChange,
  showSaturday: controlledShowSaturday,
  onToggleSaturday: _onToggleSaturday,
  className,
}: CalendarBoardProps<T>) {
  const defaultView = config?.defaultView ?? 'week'

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [internalView, _setInternalView] = useState<CalendarViewType>(defaultView)
  const [internalHiddenDays, setInternalHiddenDays] = useState<number[]>(config?.hiddenDays ?? DEFAULT_HIDDEN_DAYS)

  // Internal toggle — always called unconditionally to satisfy rules-of-hooks
  const _internalToggleSaturday = useCallback(() => {
    setInternalHiddenDays(prev =>
      prev.includes(6) ? prev.filter(d => d !== 6) : [...prev, 6],
    )
  }, [])

  // Use controlled props if provided, otherwise internal state
  const activeView = controlledView ?? internalView

  const showSaturday = controlledShowSaturday ?? !internalHiddenDays.includes(6)

  const hiddenDays = showSaturday
    ? (config?.hiddenDays ?? DEFAULT_HIDDEN_DAYS).filter(d => d !== 6)
    : [...new Set([...(config?.hiddenDays ?? DEFAULT_HIDDEN_DAYS), 6])]

  // Fire onDateRangeChange when currentDate or activeView changes
  const range = useMemo(
    () => getDateRange(currentDate, activeView),
    [currentDate, activeView],
  )

  useEffect(() => {
    onDateRangeChange?.(range)
  }, [range, onDateRangeChange])

  return (
    <div className={cn('flex h-full w-full flex-col rounded-xl border', className)}>
      <CalendarHeader
        currentDate={currentDate}
        activeView={activeView}
        onDateChange={setCurrentDate}
      />

      <div className="w-full flex-1 min-h-0 overflow-hidden">
        {activeView === 'week' && (
          <CalendarWeekView
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
