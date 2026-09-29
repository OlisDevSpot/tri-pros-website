'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent, ScheduleMeetingEvent } from '@/features/schedule-management/types'

import { useCallback, useMemo, useState } from 'react'

import { toCalendarEvent } from '@/features/meeting-flow/lib'
import { SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { MeetingCard } from '@/features/schedule-management/ui/components/meeting-card'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleCalendarDot } from '@/features/schedule-management/ui/components/schedule-calendar-dot'
import { ScheduleCalendarErrorState } from '@/features/schedule-management/ui/components/schedule-calendar-error-state'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

interface ScheduleMeetingsCalendarProps {
  showToggle: ReactNode
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
  isHighlighted: (meetingId: string) => boolean
  highlightRef: (meetingId: string) => React.RefCallback<HTMLDivElement>
}

export function ScheduleMeetingsCalendar({ showToggle, showSaturday, onToggleSaturday, onNewActivity, isHighlighted, highlightRef }: ScheduleMeetingsCalendarProps) {
  const trpc = useTRPC()
  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, {}, SCHEDULE_MEETINGS_QUERY)
  const { updateScheduledFor } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()
  const [assignRepMeetingId, setAssignRepMeetingId] = useState<string | null>(null)

  const events = useMemo<ScheduleCalendarEvent[]>(() => query.rows.map(toCalendarEvent), [query.rows])

  const handleViewMeeting = useCallback((event: ScheduleMeetingEvent) => {
    if (!event.customerId) {
      return
    }
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId: event.customerId, defaultTab: 'meetings' as const, highlightMeetingId: event.meetingId },
    })
    openModal()
  }, [setModal, openModal])

  const handleAssignOwner = useCallback((event: ScheduleCalendarEvent) => {
    if (event.kind === 'meeting') {
      setAssignRepMeetingId(event.meetingId)
    }
  }, [])

  const handleViewCalendarEvent = useCallback((event: ScheduleCalendarEvent) => {
    if (event.kind === 'meeting') {
      handleViewMeeting(event)
    }
  }, [handleViewMeeting])

  const { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog } = useMeetingActionConfigs<ScheduleCalendarEvent>({
    onView: handleViewCalendarEvent,
    onAssignOwner: handleAssignOwner,
  })

  const handleUpdateScheduledFor = useCallback((meetingId: string, date: Date) => {
    updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } })
  }, [updateScheduledFor])

  const renderCard = useCallback((event: ScheduleCalendarEvent) => (event.kind === 'meeting'
    ? (
        <MeetingCard
          event={event}
          onAssignOwner={handleAssignOwner}
          onUpdateScheduledFor={handleUpdateScheduledFor}
          isHighlighted={isHighlighted(event.meetingId)}
          highlightRef={highlightRef(event.meetingId)}
        />
      )
    : null), [handleAssignOwner, handleUpdateScheduledFor, isHighlighted, highlightRef])

  const renderCompact = useCallback((event: ScheduleCalendarEvent) => (
    <ScheduleCalendarDot event={event} actions={actions} onUpdateScheduledFor={handleUpdateScheduledFor} />
  ), [actions, handleUpdateScheduledFor])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <QueryToolbar query={query} entityName="meetings">
        <QueryToolbar.Standard leading={showToggle} searchPlaceholder="Search by customer or type…" />
      </QueryToolbar>
      <div className="min-h-0 flex-1">
        {query.isError && query.rows.length === 0
          ? <ScheduleCalendarErrorState onRetry={() => void query.refresh()} />
          : query.isLoading
            ? <LoadingState title="Loading schedule…" />
            : (
                <ScheduleCalendar
                  events={events}
                  dateWindow={query.window}
                  showSaturday={showSaturday}
                  renderCard={renderCard}
                  renderCompact={renderCompact}
                  controlsRight={(
                    <ScheduleControlsBar
                      calendarView={query.window.view}
                      onCalendarViewChange={query.window.setView}
                      showSaturday={showSaturday}
                      onToggleSaturday={onToggleSaturday}
                      onNewActivity={onNewActivity}
                    />
                  )}
                />
              )}
      </div>
      <ManageParticipantsModal
        meetingIds={assignRepMeetingId ? [assignRepMeetingId] : []}
        open={!!assignRepMeetingId}
        onOpenChange={open => !open && setAssignRepMeetingId(null)}
      />
      <DeleteConfirmDialog />
      <OutcomeReasonDialog />
      <RescheduleDialog />
    </div>
  )
}
