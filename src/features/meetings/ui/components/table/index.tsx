'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { MeetingTableMeta } from './columns'
import type { MeetingOutcome } from '@/shared/types/enums'

import type { AppRouter } from '@/trpc/routers/app'
import { useRouter } from 'next/navigation'

import { useState } from 'react'
import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { AssignRepDialog } from '@/features/customer-pipelines/ui/components/assign-rep-dialog'
import { meetingTableFilters } from '@/features/meetings/constants/table-filter-config'
import { useMeetingActions } from '@/features/meetings/hooks/use-meeting-actions'
import { getMeetingRowClassName } from '@/features/meetings/lib/meeting-row-class'
import { CreateMeetingModal } from '@/features/meetings/ui/components/create-meeting-modal'
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

  // Edit meeting dialog
  const [editDialog, setEditDialog] = useState<MeetingRow | null>(null)
  // Assign rep dialog
  const [assignRepDialog, setAssignRepDialog] = useState<{ meetingId: string, currentOwnerId: string } | null>(null)

  const meta: MeetingTableMeta = {
    userRole: session?.user?.role,
    onView: (meetingId: string, customerId: string | null) => {
      if (customerId) {
        setModal({
          accessor: 'CustomerProfile',
          Component: CustomerProfileModal,
          props: { customerId, defaultTab: 'meetings' as const, highlightMeetingId: meetingId },
        })
        openModal()
      }
    },
    onEdit: (meetingId: string) => {
      const row = data.find(m => m.id === meetingId)
      if (row) {
        setEditDialog(row)
      }
    },
    onStart: (meetingId: string) => router.push(`${ROOTS.dashboard.meetings()}/${meetingId}`),
    onDuplicate: (meetingId: string) => duplicateMeeting.mutate({ id: meetingId }),
    onDelete: (meetingId: string) => deleteMeeting.mutate({ id: meetingId }),
    onAssignOwner: (meetingId: string, currentOwnerId: string) => {
      setAssignRepDialog({ meetingId, currentOwnerId })
    },
    onUpdateOutcome: (meetingId: string, outcome: string) => updateOutcome.mutate({ id: meetingId, meetingOutcome: outcome as MeetingOutcome }),
    onUpdateScheduledFor: (meetingId: string, date: Date) => updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() }),
    onViewProfile: (customerId: string, meetingId?: string) => {
      setModal({
        accessor: 'CustomerProfile',
        Component: CustomerProfileModal,
        props: {
          customerId,
          ...(meetingId && { defaultTab: 'meetings' as const, highlightMeetingId: meetingId }),
        },
      })
      openModal()
    },
    isDuplicating: duplicateMeeting.isPending,
    isDeleting: deleteMeeting.isPending,
  }

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        meta={meta}
        filterConfig={meetingTableFilters}
        defaultSort={defaultSort}
        getRowClassName={getMeetingRowClassName}
        entityName="meeting"
        rowDataAttribute="data-meeting-row"
        onRowClick={(row) => {
          if (row.customerId) {
            meta.onViewProfile(row.customerId, row.id)
          }
        }}
        onFilteredCountChange={onFilteredCountChange}
        onFilteredDataChange={onFilteredDataChange}
      />

      {/* Edit meeting dialog */}
      {editDialog && (
        <CreateMeetingModal
          isOpen
          customerId={editDialog.customerId ?? ''}
          customerName={editDialog.customerName ?? 'Unknown'}
          editMeetingId={editDialog.id}
          initialValues={{
            meetingType: editDialog.meetingType as 'Fresh' | 'Follow-up' | 'Rehash',
            scheduledFor: editDialog.scheduledFor ? new Date(editDialog.scheduledFor) : undefined,
            tradeSelections: editDialog.flowStateJSON?.tradeSelections ?? [],
          }}
          onClose={() => setEditDialog(null)}
        />
      )}

      {/* Assign rep dialog */}
      <AssignRepDialog
        meetingIds={assignRepDialog ? [assignRepDialog.meetingId] : []}
        currentRepId={assignRepDialog?.currentOwnerId}
        open={!!assignRepDialog}
        onOpenChange={open => !open && setAssignRepDialog(null)}
      />
    </>
  )
}
