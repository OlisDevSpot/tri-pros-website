'use client'

import type { ScheduleCalendarEvent, ScheduleMeetingEvent } from '@/features/schedule-management/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'

import { useSuspenseQueries } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'

import { SCHEDULE_ACTIVITIES_LIST_INPUT, SCHEDULE_MEETINGS_LIST_INPUT } from '@/features/schedule-management/constants/schedule-query-inputs'
import { useScheduleHighlight } from '@/features/schedule-management/hooks/use-schedule-highlight'
import { activityToCalendarEvent } from '@/features/schedule-management/lib/to-calendar-event'
import { ActivityForm } from '@/features/schedule-management/ui/components/activity-form'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { EmptyState } from '@/shared/components/states/empty-state'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

export function ScheduleView() {
  const [calendarView, setCalendarView] = useState<CalendarViewType>('week')
  const [showSaturday, setShowSaturday] = useState(false)
  const [activityFormOpen, setActivityFormOpen] = useState(false)

  // Highlight support: when navigating from "View in Schedule" action
  const { highlightDate, isHighlighted, highlightRef } = useScheduleHighlight()
  const highlightInitialDate = useMemo(() => {
    if (!highlightDate) {
      return undefined
    }
    const parsed = new Date(highlightDate)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [highlightDate])

  const handleToggleSaturday = useCallback(() => {
    setShowSaturday(prev => !prev)
  }, [])

  const trpc = useTRPC()
  const { open: openModal, setModal } = useModalStore()
  const meetingsOptions = trpc.meetingsRouter.reads.list.queryOptions(SCHEDULE_MEETINGS_LIST_INPUT)
  const activitiesOptions = trpc.scheduleRouter.activities.list.queryOptions(SCHEDULE_ACTIVITIES_LIST_INPUT)

  // Dev-only: detect server-prefetch key drift for each query (see hydration-drift.ts).
  useHydrationParityCheck(meetingsOptions.queryKey)
  useHydrationParityCheck(activitiesOptions.queryKey)

  // useSuspenseQueries (plural), NOT two useSuspenseQuery calls — sequential
  // suspense hooks in one component waterfall; the plural API fires both in
  // parallel and matches the page's two parallel prefetches.
  const [{ data: meetings }, { data: activities }] = useSuspenseQueries({
    queries: [meetingsOptions, activitiesOptions],
  })
  const meetingRows = meetings.rows
  const activitiesData = activities.rows
  const { updateScheduledFor } = useMeetingActions()

  // Map activities to calendar events for the calendar view
  const activityEvents = useMemo(
    () => activitiesData.map(activityToCalendarEvent),
    [activitiesData],
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

  const { actions: meetingActions, DeleteConfirmDialog: CalendarDeleteDialog, OutcomeReasonDialog } = useMeetingActionConfigs<ScheduleCalendarEvent>({
    onView: handleViewCalendarEvent,
    onAssignOwner: handleAssignOwner,
  })

  const handleUpdateScheduledFor = useCallback((meetingId: string, date: Date) => {
    updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } })
  }, [updateScheduledFor])

  const hasNoData = meetingRows.length === 0 && activitiesData.length === 0

  if (hasNoData) {
    return (
      <EmptyState
        title="No Schedule Items"
        description="Create a new meeting or activity to get started"
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
      className="w-full h-full flex flex-col overflow-hidden"
    >
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScheduleCalendar
          data={meetingRows}
          actions={meetingActions}
          additionalEvents={activityEvents}
          onAssignOwner={handleAssignOwner}
          onUpdateScheduledFor={handleUpdateScheduledFor}
          activeView={calendarView}
          onViewChange={setCalendarView}
          showSaturday={showSaturday}
          onToggleSaturday={handleToggleSaturday}
          initialDate={highlightInitialDate}
          isHighlighted={isHighlighted}
          highlightRef={highlightRef}
          controlsRight={(
            <ScheduleControlsBar
              calendarView={calendarView}
              onCalendarViewChange={setCalendarView}
              showSaturday={showSaturday}
              onToggleSaturday={handleToggleSaturday}
              onNewActivity={() => setActivityFormOpen(true)}
            />
          )}
        />
      </div>

      {/* Assign rep dialog */}
      <ManageParticipantsModal
        meetingIds={assignRepDialog ? [assignRepDialog.meetingId] : []}
        open={!!assignRepDialog}
        onOpenChange={open => !open && setAssignRepDialog(null)}
      />
      <CalendarDeleteDialog />
      <OutcomeReasonDialog />

      {/* New activity form */}
      <ActivityForm open={activityFormOpen} onOpenChange={setActivityFormOpen} />
    </motion.div>
  )
}
