'use client'

import type { MeetingRow, MeetingTableMeta } from './columns'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useCallback, useState } from 'react'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { AssignProjectDialog } from '@/features/customer-pipelines/ui/components/assign-project-dialog'
import { AssignRepDialog } from '@/features/customer-pipelines/ui/components/assign-rep-dialog'
import { meetingTableFilters } from '@/features/meeting-flow/constants/table-filter-config'
import { getMeetingRowClassName } from '@/features/meeting-flow/lib/meeting-row-class'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'

import { getColumns } from './columns'

const columns = getColumns()
const defaultSort = [{ id: 'scheduledFor', desc: true }]

interface Props {
  data: MeetingRow[]
  onFilteredCountChange?: (count: number) => void
  onFilteredDataChange?: (data: MeetingRow[]) => void
}

export function PastMeetingsTable({ data, onFilteredCountChange, onFilteredDataChange }: Props) {
  const { updateOutcome, updateScheduledFor } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()

  // Dialog state
  const [assignRepDialog, setAssignRepDialog] = useState<{ meetingId: string, currentOwnerId: string } | null>(null)
  const [assignProjectMeetingId, setAssignProjectMeetingId] = useState<string | null>(null)

  const handleView = useCallback((entity: MeetingRow) => {
    if (entity.customerId) {
      setModal({
        accessor: 'CustomerProfile',
        Component: CustomerProfileModal,
        props: { customerId: entity.customerId, defaultTab: 'meetings' as const, highlightMeetingId: entity.id },
      })
      openModal()
    }
  }, [setModal, openModal])

  const handleAssignOwner = useCallback((entity: MeetingRow) => {
    setAssignRepDialog({ meetingId: entity.id, currentOwnerId: entity.ownerId })
  }, [])

  const handleAssignProject = useCallback((entity: MeetingRow) => {
    setAssignProjectMeetingId(entity.id)
  }, [])

  const { actions: sharedActions, DeleteConfirmDialog } = useMeetingActionConfigs<MeetingRow>({
    onView: handleView,
    onAssignOwner: handleAssignOwner,
    onAssignProject: handleAssignProject,
  })

  const meta: MeetingTableMeta = {
    meetingActions: () => sharedActions,
    onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => updateOutcome.mutate({ id: meetingId, meetingOutcome: outcome }),
    onUpdateScheduledFor: (meetingId: string, date: Date) => updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() }),
    onAssignRep: (meetingId: string, currentOwnerId: string) => {
      setAssignRepDialog({ meetingId, currentOwnerId })
    },
  }

  return (
    <>
      <DeleteConfirmDialog />
      <DataTable
        tableId="meetings"
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
            handleView(row)
          }
        }}
        onFilteredCountChange={onFilteredCountChange}
        onFilteredDataChange={onFilteredDataChange}
      />

      {/* Assign rep dialog */}
      <AssignRepDialog
        meetingIds={assignRepDialog ? [assignRepDialog.meetingId] : []}
        currentRepId={assignRepDialog?.currentOwnerId}
        open={!!assignRepDialog}
        onOpenChange={open => !open && setAssignRepDialog(null)}
      />

      {/* Assign to project dialog */}
      <AssignProjectDialog
        meetingId={assignProjectMeetingId}
        open={!!assignProjectMeetingId}
        onOpenChange={open => !open && setAssignProjectMeetingId(null)}
      />
    </>
  )
}
