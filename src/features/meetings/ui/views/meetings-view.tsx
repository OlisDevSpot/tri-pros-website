'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { DataViewType } from '@/shared/components/data-view-type-toggle'
import type { AppRouter } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'
import { FilterIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components/customer-profile-modal'
import { meetingsStatConfig } from '@/features/meetings/constants/meetings-stat-config'
import { useMeetingActionConfigs } from '@/features/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/features/meetings/hooks/use-meeting-actions'
import { MeetingCalendar } from '@/features/meetings/ui/components/calendar/meeting-calendar'
import { CreateMeetingModal } from '@/features/meetings/ui/components/create-meeting-modal'
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
import { useModalStore } from '@/shared/hooks/use-modal-store'
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
  const { open: openModal, setModal } = useModalStore()
  const meetings = useQuery(trpc.meetingsRouter.getAll.queryOptions())
  const { updateScheduledFor } = useMeetingActions()

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

  const handleEditMeeting = useCallback((entity: MeetingCalendarEvent) => {
    const raw = meetings.data?.find(m => m.id === entity.meetingId)
    if (!raw) {
      return
    }
    setEditMeetingDialog({
      meetingId: raw.id,
      customerId: raw.customerId ?? '',
      customerName: raw.customerName ?? 'Unknown',
      meetingType: raw.meetingType,
      scheduledFor: raw.scheduledFor,
      tradeSelections: raw.flowStateJSON?.tradeSelections ?? [],
    })
  }, [meetings.data])

  const meetingActions = useMeetingActionConfigs<MeetingCalendarEvent>({
    onView: handleViewMeeting,
    onEdit: handleEditMeeting,
  })

  const handleUpdateScheduledFor = useCallback((meetingId: string, date: Date) => {
    updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() })
  }, [updateScheduledFor])

  const [tableFilteredData, setTableFilteredData] = useState<MeetingRow[] | null>(null)
  const handleFilteredDataChange = useCallback((data: MeetingRow[]) => setTableFilteredData(data), [])

  const statsData = useMemo((): MeetingRow[] => {
    if (!meetings.data) {
      return []
    }
    if (layout === 'table' && tableFilteredData) {
      return tableFilteredData
    }
    if (layout === 'calendar' && dateRange) {
      return meetings.data.filter((m) => {
        if (!m.scheduledFor) {
          return false
        }
        const d = new Date(m.scheduledFor)
        return d >= dateRange.from && d <= dateRange.to
      })
    }
    return meetings.data
  }, [layout, dateRange, meetings.data, tableFilteredData])

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
                data={meetings.data}
                actions={meetingActions}
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
                data={meetings.data}
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
    </motion.div>
  )
}
