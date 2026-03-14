'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { useRouter } from 'next/navigation'

import { meetingTableFilters } from '@/features/meetings/constants/table-filter-config'
import { useMeetingActions } from '@/features/meetings/hooks/use-meeting-actions'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { getColumns } from './columns'

const columns = getColumns()
const defaultSort = [{ id: 'createdAt', desc: true }]

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

interface Props {
  data: MeetingRow[]
  onFilteredCountChange?: (count: number) => void
}

export function PastMeetingsTable({ data, onFilteredCountChange }: Props) {
  const router = useRouter()
  const { deleteMeeting, duplicateMeeting, updateStatus, updateScheduledFor } = useMeetingActions()

  const meta = {
    onEdit: (meetingId: string) => router.push(`/dashboard?step=edit-meeting&editMeetingId=${meetingId}`),
    onDuplicate: (meetingId: string) => duplicateMeeting.mutate({ id: meetingId }),
    onStart: (meetingId: string) => router.push(`/dashboard/meetings/${meetingId}`),
    onDelete: (meetingId: string) => deleteMeeting.mutate({ id: meetingId }),
    onUpdateStatus: (meetingId: string, status: string) => updateStatus.mutate({ id: meetingId, status: status as 'in_progress' | 'completed' | 'converted' }),
    onUpdateScheduledFor: (meetingId: string, date: Date) => updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() }),
    isDuplicating: duplicateMeeting.isPending,
    isDeleting: deleteMeeting.isPending,
  }

  return (
    <DataTable
      data={data}
      columns={columns}
      meta={meta}
      filterConfig={meetingTableFilters}
      defaultSort={defaultSort}
      entityName="meeting"
      rowDataAttribute="data-meeting-row"
      onFilteredCountChange={onFilteredCountChange}
    />
  )
}
