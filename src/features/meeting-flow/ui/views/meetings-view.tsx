'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { MeetingCalendarEvent } from '@/features/meeting-flow/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { DataViewType } from '@/shared/components/data-view-type-toggle'
import type { PipelineScope } from '@/shared/pipelines/ui/pipeline-scope-toggle'
import type { AppRouter } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'
import { FilterIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'

import { AssignRepDialog } from '@/features/customer-pipelines/ui/components/assign-rep-dialog'
import { meetingsStatConfig } from '@/features/meeting-flow/constants/meetings-stat-config'
import { MeetingCalendar } from '@/features/meeting-flow/ui/components/calendar/meeting-calendar'
import { PastMeetingsTable } from '@/features/meeting-flow/ui/components/table'
import { DataViewTypeToggle } from '@/shared/components/data-view-type-toggle'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { STORAGE_KEYS } from '@/shared/constants/storage-keys'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'
import { getStoredPipeline } from '@/shared/pipelines/hooks/pipeline-context'
import { deriveMeetingPipeline } from '@/shared/pipelines/lib/derive-meeting-pipeline'
import { PipelineScopeToggle } from '@/shared/pipelines/ui/pipeline-scope-toggle'
import { useTRPC } from '@/trpc/helpers'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export function MeetingsView() {
  const [layout, setLayout] = usePersistedState<DataViewType>(STORAGE_KEYS.MEETINGS_LAYOUT, 'calendar')
  const [dateRange, setDateRange] = useState<{ from: Date, to: Date } | null>(null)
  const [calendarView, setCalendarView] = useState<CalendarViewType>('week')
  const [showSaturday, setShowSaturday] = useState(false)
  const activePipeline = getStoredPipeline()
  const [scope, setScope] = usePersistedState<PipelineScope>(STORAGE_KEYS.MEETINGS_SCOPE, 'all')

  const handleToggleSaturday = useCallback(() => {
    setShowSaturday(prev => !prev)
  }, [])

  const trpc = useTRPC()
  const { open: openModal, setModal } = useModalStore()
  const meetings = useQuery(trpc.meetingsRouter.getAll.queryOptions())
  const { updateScheduledFor } = useMeetingActions()

  const scopedData = useMemo(() => {
    if (!meetings.data || scope === 'all') {
      return meetings.data
    }
    return meetings.data.filter((m) => {
      const derived = deriveMeetingPipeline({ projectId: m.projectId, pipeline: m.pipeline as 'fresh' | 'rehash' | 'dead' })
      return derived === scope
    })
  }, [meetings.data, scope])

  // Edit-meeting dialog state
  const [editMeetingDialog, setEditMeetingDialog] = useState<{
    meetingId: string
    customerId: string
    customerName: string
    meetingType: string
    scheduledFor: string | null
    tradeSelections: NonNullable<NonNullable<MeetingRow['flowStateJSON']>['tradeSelections']>
  } | null>(null)

  const handleViewMeeting = useCallback((entity: MeetingCalendarEvent) => {
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
    currentRepId: string | null
  } | null>(null)

  const handleAssignOwner = useCallback((entity: MeetingCalendarEvent) => {
    setAssignRepDialog({ meetingId: entity.meetingId, currentRepId: entity.ownerId })
  }, [])

  const { actions: meetingActions, DeleteConfirmDialog: CalendarDeleteDialog } = useMeetingActionConfigs<MeetingCalendarEvent>({
    onView: handleViewMeeting,
    onAssignOwner: handleAssignOwner,
  })

  const handleUpdateScheduledFor = useCallback((meetingId: string, date: Date) => {
    updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() })
  }, [updateScheduledFor])

  const [tableFilteredData, setTableFilteredData] = useState<MeetingRow[] | null>(null)
  const handleFilteredDataChange = useCallback((data: MeetingRow[]) => setTableFilteredData(data), [])

  const statsData = useMemo((): MeetingRow[] => {
    if (!scopedData) {
      return []
    }
    if (layout === 'table' && tableFilteredData) {
      return tableFilteredData
    }
    if (layout === 'calendar' && dateRange) {
      return scopedData.filter((m) => {
        if (!m.scheduledFor) {
          return false
        }
        const d = new Date(m.scheduledFor)
        return d >= dateRange.from && d <= dateRange.to
      })
    }
    return scopedData
  }, [layout, dateRange, scopedData, tableFilteredData])

  if (meetings.isLoading) {
    return (
      <LoadingState
        title="Loading Meetings"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!scopedData) {
    return (
      <ErrorState
        title="Error: Could not load meetings"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  if (scopedData.length === 0) {
    return (
      <EmptyState
        title="No Meetings Found"
        description={scope !== 'all' ? 'No meetings in this pipeline. Switch to \'All\' to see everything.' : 'Create a new meeting to get started'}
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
          <PipelineScopeToggle value={scope} onChange={setScope} activePipeline={activePipeline} />
          {layout === 'calendar' && (
            <>
              {/* Today/Week/Month tabs — stable on left (mobile), same position (desktop) */}
              <div className="flex rounded-md border lg:order-1">
                <Button
                  variant={calendarView === 'today' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setCalendarView('today')}
                >
                  Today
                </Button>
                <Button
                  variant={calendarView === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none border-x"
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

              {/* Days filter — right side on mobile (next to calendar/table), left of tabs on desktop */}
              {calendarView === 'week' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 lg:order-0">
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
            </>
          )}
          <DataViewTypeToggle
            value={layout}
            onChange={setLayout}
            availableViews={['calendar', 'table']}
            className="ml-auto lg:order-2 lg:ml-0"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {layout === 'calendar'
          ? (
              <MeetingCalendar
                data={scopedData}
                actions={meetingActions}
                onAssignOwner={handleAssignOwner}
                onDateRangeChange={setDateRange}
                onUpdateScheduledFor={handleUpdateScheduledFor}
                activeView={calendarView}
                onViewChange={setCalendarView}
                showSaturday={showSaturday}
                onToggleSaturday={handleToggleSaturday}
              />
            )
          : (
              <PastMeetingsTable
                data={scopedData}
                onFilteredDataChange={handleFilteredDataChange}
              />
            )}
      </div>

      {/* Edit meeting dialog */}
      {editMeetingDialog && (
        <CreateMeetingModal
          isOpen
          customerId={editMeetingDialog.customerId}
          customerName={editMeetingDialog.customerName}
          editMeetingId={editMeetingDialog.meetingId}
          initialValues={{
            meetingType: editMeetingDialog.meetingType as 'Fresh' | 'Follow-up' | 'Rehash',
            scheduledFor: editMeetingDialog.scheduledFor ? new Date(editMeetingDialog.scheduledFor) : undefined,
            tradeSelections: editMeetingDialog.tradeSelections,
          }}
          onClose={() => setEditMeetingDialog(null)}
        />
      )}

      {/* Assign rep dialog */}
      <AssignRepDialog
        meetingIds={assignRepDialog ? [assignRepDialog.meetingId] : []}
        currentRepId={assignRepDialog?.currentRepId}
        open={!!assignRepDialog}
        onOpenChange={open => !open && setAssignRepDialog(null)}
      />
      <CalendarDeleteDialog />
    </motion.div>
  )
}
