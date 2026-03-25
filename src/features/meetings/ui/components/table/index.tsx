'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/routers/app'

import { useRouter } from 'next/navigation'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { meetingTableFilters } from '@/features/meetings/constants/table-filter-config'
import { useMeetingActions } from '@/features/meetings/hooks/use-meeting-actions'
import { useSession } from '@/shared/auth/client'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { ROOTS } from '@/shared/config/roots'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { getColumns } from './columns'

const columns = getColumns()
const defaultSort = [{ id: 'scheduledFor', desc: true }]

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

interface Props {
  data: MeetingRow[]
  onFilteredCountChange?: (count: number) => void
  onFilteredDataChange?: (data: MeetingRow[]) => void
}

export function PastMeetingsTable({ data, onFilteredCountChange, onFilteredDataChange }: Props) {
  const router = useRouter()
  const { data: session } = useSession()
  const { deleteMeeting, duplicateMeeting, updateOutcome, updateScheduledFor } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()

  const meta = {
    userRole: session?.user?.role,
    onEdit: (meetingId: string) => router.push(`${ROOTS.dashboard.root}?step=edit-meeting&editMeetingId=${meetingId}`),
    onDuplicate: (meetingId: string) => duplicateMeeting.mutate({ id: meetingId }),
    onStart: (meetingId: string) => router.push(`${ROOTS.dashboard.meetings()}/${meetingId}`),
    onDelete: (meetingId: string) => deleteMeeting.mutate({ id: meetingId }),
    onUpdateOutcome: (meetingId: string, outcome: string) => updateOutcome.mutate({ id: meetingId, meetingOutcome: outcome as 'not_set' | 'proposal_created' | 'follow_up_needed' | 'not_interested' | 'no_show' }),
    onUpdateScheduledFor: (meetingId: string, date: Date) => updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() }),
    onViewProfile: (customerId: string) => {
      setModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
      openModal()
    },
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
      onFilteredDataChange={onFilteredDataChange}
    />
  )
}
