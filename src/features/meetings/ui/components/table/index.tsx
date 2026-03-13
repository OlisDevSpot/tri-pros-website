'use client'

import type { Meeting } from '@/shared/db/schema'

import { useRouter } from 'next/navigation'

import { meetingTableFilters } from '@/features/meetings/constants/table-filter-config'
import { useMeetingActions } from '@/features/meetings/hooks/use-meeting-actions'
import { DataTable } from '@/shared/components/data-table/data-table'
import { getColumns } from './columns'

const columns = getColumns()
const defaultSort = [{ id: 'createdAt', desc: true }]

export function PastMeetingsTable({ data }: { data: Meeting[] }) {
  const router = useRouter()
  const { deleteMeeting, duplicateMeeting, updateStatus } = useMeetingActions()

  const meta = {
    onEdit: (meetingId: string) => router.push(`/dashboard?step=edit-meeting&editMeetingId=${meetingId}`),
    onDuplicate: (meetingId: string) => duplicateMeeting.mutate({ id: meetingId }),
    onStart: (meetingId: string) => router.push(`/dashboard/meetings/${meetingId}`),
    onDelete: (meetingId: string) => deleteMeeting.mutate({ id: meetingId }),
    onUpdateStatus: (meetingId: string, status: string) => updateStatus.mutate({ id: meetingId, status: status as 'in_progress' | 'completed' | 'converted' }),
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
    />
  )
}
