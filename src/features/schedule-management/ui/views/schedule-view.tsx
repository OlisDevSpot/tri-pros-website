'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { ScheduleCalendarEvent, ScheduleMeetingEvent } from '@/features/schedule-management/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { DataViewType } from '@/shared/components/data-view-type-toggle'
import type { PipelineScope } from '@/shared/domains/pipelines/ui/pipeline-scope-toggle'
import type { AppRouter } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { meetingsStatConfig } from '@/features/meeting-flow/constants/meetings-stat-config'
import { PastMeetingsTable } from '@/features/meeting-flow/ui/components/table'
import { useScheduleHighlight } from '@/features/schedule-management/hooks/use-schedule-highlight'
import { useScheduleTableTab } from '@/features/schedule-management/hooks/use-schedule-table-tab'
import { activityToCalendarEvent } from '@/features/schedule-management/lib/to-calendar-event'
import { ActivitiesTable } from '@/features/schedule-management/ui/components/activities-table'
import { ActivityForm } from '@/features/schedule-management/ui/components/activity-form'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { STORAGE_KEYS } from '@/shared/constants/storage-keys'
import { getStoredPipeline } from '@/shared/domains/pipelines/hooks/pipeline-context'
import { deriveMeetingPipeline } from '@/shared/domains/pipelines/lib/derive-meeting-pipeline'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'
import { useTRPC } from '@/trpc/helpers'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function ScheduleView() {
  const [layout, setLayout] = usePersistedState<DataViewType>(STORAGE_KEYS.SCHEDULE_LAYOUT, 'calendar')
  const [dateRange, setDateRange] = useState<{ from: Date, to: Date } | null>(null)
  const [calendarView, setCalendarView] = useState<CalendarViewType>('week')
  const [showSaturday, setShowSaturday] = useState(false)
  const activePipeline = getStoredPipeline()
  const [scope, setScope] = usePersistedState<PipelineScope>(STORAGE_KEYS.SCHEDULE_SCOPE, 'all')
  const { tab: tableTab, setTab: setTableTab } = useScheduleTableTab()
  const [activityFormOpen, setActivityFormOpen] = useState(false)

  // Highlight support: when navigating from "View in Schedule" action
  const { highlightMeetingId, highlightDate, isHighlighted, highlightRef } = useScheduleHighlight()
  const highlightInitialDate = useMemo(() => {
    if (!highlightDate) {
      return undefined
    }
    const parsed = new Date(highlightDate)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [highlightDate])

  // Force calendar layout when navigating with highlight
  useEffect(() => {
    if (highlightMeetingId && layout !== 'calendar') {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setLayout('calendar')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleSaturday = useCallback(() => {
    setShowSaturday(prev => !prev)
  }, [])

  const trpc = useTRPC()
  const { open: openModal, setModal } = useModalStore()
  const meetings = useQuery(trpc.meetingsRouter.getAll.queryOptions())
  const activitiesQuery = useQuery(trpc.scheduleRouter.activities.getAll.queryOptions())
  const { updateScheduledFor } = useMeetingActions()

  // Scope meetings by pipeline
  const scopedMeetings = useMemo(() => {
    if (!meetings.data || scope === 'all') {
      return meetings.data
    }
    return meetings.data.filter((m) => {
      const derived = deriveMeetingPipeline({ projectId: m.projectId, pipeline: m.pipeline as 'fresh' | 'rehash' | 'dead' })
      return derived === scope
    })
  }, [meetings.data, scope])

  // Map activities to calendar events for the calendar view
  const activityEvents = useMemo(
    () => (activitiesQuery.data ?? []).map(activityToCalendarEvent),
    [activitiesQuery.data],
  )

  // View meeting handler
  const handleViewMeeting = useCallback((entity: ScheduleMeetingEvent) => {
    if (entity.customerId) {
      setModal({
        accessor: 'CustomerProfile',
        Component: CustomerProfileModal,
        props: { customerId: entity.customerId, defaultTab: 'meetings' as const, highlightMeetingId: entity.meetingId },
      })
      openModal()
    }
  }, [setModal, openModal])

  // Assign rep dialog state
  const [assignRepDialog, setAssignRepDialog] = useState<{
    meetingId: string
  } | null>(null)

  const handleAssignOwner = useCallback((entity: ScheduleCalendarEvent) => {
    if (entity.kind === 'meeting') {
      setAssignRepDialog({ meetingId: entity.meetingId })
    }
  }, [])

  const handleViewCalendarEvent = useCallback((entity: ScheduleCalendarEvent) => {
    if (entity.kind === 'meeting') {
      handleViewMeeting(entity)
    }
  }, [handleViewMeeting])

  const { actions: meetingActions, DeleteConfirmDialog: CalendarDeleteDialog } = useMeetingActionConfigs<ScheduleCalendarEvent>({
    onView: handleViewCalendarEvent,
    onAssignOwner: handleAssignOwner,
  })

  const handleUpdateScheduledFor = useCallback((meetingId: string, date: Date) => {
    updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() })
  }, [updateScheduledFor])

  // Stats data — meetings only
  const [tableFilteredData, setTableFilteredData] = useState<MeetingRow[] | null>(null)
  const handleFilteredDataChange = useCallback((data: MeetingRow[]) => setTableFilteredData(data), [])

  const statsData = useMemo((): MeetingRow[] => {
    if (!scopedMeetings) {
      return []
    }
    if (layout === 'table' && tableTab === 'meetings' && tableFilteredData) {
      return tableFilteredData
    }
    if (layout === 'calendar' && dateRange) {
      return scopedMeetings.filter((m) => {
        if (!m.scheduledFor) {
          return false
        }
        const d = new Date(m.scheduledFor)
        return d >= dateRange.from && d <= dateRange.to
      })
    }
    return scopedMeetings
  }, [layout, dateRange, scopedMeetings, tableFilteredData, tableTab])

  const isLoading = meetings.isLoading || activitiesQuery.isLoading

  if (isLoading) {
    return (
      <LoadingState
        title="Loading Schedule"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!scopedMeetings) {
    return (
      <ErrorState
        title="Error: Could not load schedule"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  const hasNoData = scopedMeetings.length === 0 && (activitiesQuery.data ?? []).length === 0

  if (hasNoData) {
    return (
      <EmptyState
        title="No Schedule Items"
        description={scope !== 'all' ? 'No items in this pipeline. Switch to \'All\' to see everything.' : 'Create a new meeting or activity to get started'}
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
        <ScheduleControlsBar
          layout={layout}
          onLayoutChange={setLayout}
          scope={scope}
          onScopeChange={setScope}
          activePipeline={activePipeline}
          calendarView={calendarView}
          onCalendarViewChange={setCalendarView}
          showSaturday={showSaturday}
          onToggleSaturday={handleToggleSaturday}
          tableTab={tableTab}
          onTableTabChange={setTableTab}
          onNewActivity={() => setActivityFormOpen(true)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {layout === 'calendar'
          ? (
              <ScheduleCalendar
                data={scopedMeetings}
                actions={meetingActions}
                additionalEvents={activityEvents}
                onAssignOwner={handleAssignOwner}
                onDateRangeChange={setDateRange}
                onUpdateScheduledFor={handleUpdateScheduledFor}
                activeView={calendarView}
                onViewChange={setCalendarView}
                showSaturday={showSaturday}
                onToggleSaturday={handleToggleSaturday}
                initialDate={highlightInitialDate}
                isHighlighted={isHighlighted}
                highlightRef={highlightRef}
              />
            )
          : tableTab === 'meetings'
            ? (
                <PastMeetingsTable
                  data={scopedMeetings}
                  onFilteredDataChange={handleFilteredDataChange}
                />
              )
            : (
                <ActivitiesTable
                  data={activitiesQuery.data ?? []}
                />
              )}
      </div>

      {/* Assign rep dialog */}
      <ManageParticipantsModal
        meetingIds={assignRepDialog ? [assignRepDialog.meetingId] : []}
        open={!!assignRepDialog}
        onOpenChange={open => !open && setAssignRepDialog(null)}
      />
      <CalendarDeleteDialog />

      {/* New activity form */}
      <ActivityForm open={activityFormOpen} onOpenChange={setActivityFormOpen} />
    </motion.div>
  )
}
