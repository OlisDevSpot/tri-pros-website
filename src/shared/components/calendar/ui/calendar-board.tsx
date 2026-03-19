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
  onEventClick,
  onDateRangeChange,
  className,
}: CalendarBoardProps<T>) {
  const defaultView = config?.defaultView ?? 'week'

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [activeView, setActiveView] = useState<CalendarViewType>(defaultView)

  // Hidden days state — Saturday (6) hidden by default in week view
  const initialHiddenDays = config?.hiddenDays ?? DEFAULT_HIDDEN_DAYS
  const [hiddenDays, setHiddenDays] = useState<number[]>(initialHiddenDays)

  const showSaturday = !hiddenDays.includes(6)

  const handleToggleSaturday = useCallback(() => {
    setHiddenDays((prev) => {
      if (prev.includes(6)) {
        return prev.filter(d => d !== 6)
      }
      return [...prev, 6]
    })
  }, [])

  // Fire onDateRangeChange when currentDate or activeView changes
  const range = useMemo(
    () => getDateRange(currentDate, activeView),
    [currentDate, activeView],
  )

  useEffect(() => {
    onDateRangeChange?.(range)
  }, [range, onDateRangeChange])

  return (
    <div className={cn('w-full rounded-xl border', className)}>
      <CalendarHeader
        currentDate={currentDate}
        activeView={activeView}
        showSaturday={showSaturday}
        onDateChange={setCurrentDate}
        onViewChange={setActiveView}
        onToggleSaturday={handleToggleSaturday}
      />

      <div className="w-full overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
        {activeView === 'week' && (
          <CalendarWeekView
            events={events}
            currentDate={currentDate}
            hiddenDays={hiddenDays}
            renderCard={renderCard}
            onEventClick={onEventClick}
          />
        )}

        {activeView === 'month' && (
          <CalendarMonthView
            events={events}
            currentDate={currentDate}
            renderCompact={renderCompact}
            onEventClick={onEventClick}
          />
        )}
      </div>
    </div>
  )
}
