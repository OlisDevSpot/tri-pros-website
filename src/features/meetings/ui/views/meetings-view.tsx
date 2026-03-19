'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { DataViewType } from '@/shared/components/data-view-type-toggle'
import type { AppRouter } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'
import { FilterIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { meetingsStatConfig } from '@/features/meetings/constants/meetings-stat-config'
import { useMeetingActions } from '@/features/meetings/hooks/use-meeting-actions'
import { MeetingCalendar } from '@/features/meetings/ui/components/calendar/meeting-calendar'
import { PastMeetingsTable } from '@/features/meetings/ui/components/table'
import { DataViewTypeToggle } from '@/shared/components/data-view-type-toggle'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function MeetingsView() {
  const [layout, setLayout] = useState<DataViewType>('calendar')
  const [dateRange, setDateRange] = useState<{ from: Date, to: Date } | null>(null)
  const [calendarView, setCalendarView] = useState<CalendarViewType>('week')
  const [showSaturday, setShowSaturday] = useState(false)

  const handleToggleSaturday = useCallback(() => {
    setShowSaturday(prev => !prev)
  }, [])

  const trpc = useTRPC()
  const router = useRouter()
  const meetings = useQuery(trpc.meetingsRouter.getAll.queryOptions())
  const { deleteMeeting, duplicateMeeting } = useMeetingActions()

  const handleNavigateToMeeting = useCallback((meetingId: string) => {
    router.push(`${ROOTS.dashboard.meetings()}/${meetingId}`)
  }, [router])

  const handleEditMeeting = useCallback((meetingId: string) => {
    router.push(`${ROOTS.dashboard.root}?step=edit-meeting&editMeetingId=${meetingId}`)
  }, [router])

  const handleStartMeeting = useCallback((meetingId: string) => {
    router.push(`${ROOTS.dashboard.meetings()}/${meetingId}`)
  }, [router])

  const handleDuplicateMeeting = useCallback((meetingId: string) => {
    duplicateMeeting.mutate({ id: meetingId })
  }, [duplicateMeeting])

  const handleDeleteMeeting = useCallback((meetingId: string) => {
    deleteMeeting.mutate({ id: meetingId })
  }, [deleteMeeting])

  const statsData = useMemo((): MeetingRow[] => {
    if (layout !== 'calendar' || !dateRange || !meetings.data) {
      return meetings.data ?? []
    }
    return meetings.data.filter((m) => {
      const d = new Date(m.scheduledFor)
      return d >= dateRange.from && d <= dateRange.to
    })
  }, [layout, dateRange, meetings.data])

  if (meetings.isLoading) {
    return (
      <LoadingState
        title="Loading Meetings"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!meetings.data) {
    return (
      <ErrorState
        title="Error: Could not load meetings"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (meetings.data.length === 0) {
    return (
      <EmptyState
        title="No Meetings Found"
        description="Create a new meeting to get started"
        className="bg-card"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4 overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <StatBar items={meetingsStatConfig} data={statsData} />
        <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end">
          {/* Calendar-specific controls — only visible in calendar layout */}
          <div className="flex items-center gap-2">
            {layout === 'calendar' && (
              <>
                {calendarView === 'week' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <FilterIcon size={14} />
                        <span className="hidden sm:inline">Days</span>
                        <Badge variant="secondary" className="px-1.5 text-[10px]">
                          {showSaturday ? '7' : '6'}
                        </Badge>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-48 p-3">
                      <p className="mb-3 text-sm font-medium">Visible Days</p>
                      <label className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={showSaturday}
                          onCheckedChange={handleToggleSaturday}
                        />
                        <span className="text-sm">Show Saturday</span>
                      </label>
                    </PopoverContent>
                  </Popover>
                )}
                <div className="flex rounded-md border">
                  <Button
                    variant={calendarView === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setCalendarView('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={calendarView === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setCalendarView('month')}
                  >
                    Month
                  </Button>
                </div>
              </>
            )}
          </div>
          <DataViewTypeToggle
            value={layout}
            onChange={setLayout}
            availableViews={['calendar', 'table']}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {layout === 'calendar'
          ? (
              <MeetingCalendar
                data={meetings.data}
                onDateRangeChange={setDateRange}
                onNavigateToMeeting={handleNavigateToMeeting}
                onEditMeeting={handleEditMeeting}
                onStartMeeting={handleStartMeeting}
                onDuplicateMeeting={handleDuplicateMeeting}
                onDeleteMeeting={handleDeleteMeeting}
                activeView={calendarView}
                onViewChange={setCalendarView}
                showSaturday={showSaturday}
                onToggleSaturday={handleToggleSaturday}
              />
            )
          : (
              <PastMeetingsTable
                data={meetings.data}
              />
            )}
      </div>
    </motion.div>
  )
}
