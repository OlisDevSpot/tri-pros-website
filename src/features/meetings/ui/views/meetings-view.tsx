'use client'

import type { DataViewType } from '@/shared/components/data-view-type-toggle'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { meetingsStatConfig } from '@/features/meetings/constants/meetings-stat-config'
import { useMeetingActions } from '@/features/meetings/hooks/use-meeting-actions'
import { MeetingCalendar } from '@/features/meetings/ui/components/calendar/meeting-calendar'
import { PastMeetingsTable } from '@/features/meetings/ui/components/table'
import { DataViewTypeToggle } from '@/shared/components/data-view-type-toggle'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function MeetingsView() {
  const [layout, setLayout] = useState<DataViewType>('calendar')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>(null)
  const [filteredCount, setFilteredCount] = useState<number | null>(null)

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

  const handleFilteredCountChange = useCallback((count: number) => setFilteredCount(count), [])

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
        <DataViewTypeToggle
          value={layout}
          onChange={setLayout}
          availableViews={['calendar', 'table']}
        />
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
              />
            )
          : (
              <PastMeetingsTable
                data={meetings.data}
                onFilteredCountChange={handleFilteredCountChange}
              />
            )}
      </div>
    </motion.div>
  )
}
