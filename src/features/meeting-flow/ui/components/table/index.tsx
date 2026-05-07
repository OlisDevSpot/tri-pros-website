'use client'

import type { MeetingRow, MeetingTableMeta } from './columns'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useCallback, useMemo, useState } from 'react'

import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { AssignProjectDialog } from '@/features/customer-pipelines/ui/components/assign-project-dialog'
import { MEETING_FILTER_CONFIG, MEETING_PAGE_SIZE_OPTIONS } from '@/features/meeting-flow/constants/meeting-table-filter-config'
import { getMeetingRowClassName } from '@/features/meeting-flow/lib/meeting-row-class'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { usePaginatedQuery } from '@/shared/dal/client/query/use-paginated-query'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

import { getColumns } from './columns'

const columns = getColumns()

export function PastMeetingsTable() {
  const trpc = useTRPC()
  const ability = useAbility()
  const { updateOutcome, updateScheduledFor } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()

  // Dialog state
  const [assignRepDialog, setAssignRepDialog] = useState<{ meetingId: string } | null>(null)
  const [assignProjectMeetingId, setAssignProjectMeetingId] = useState<string | null>(null)

  const pagination = usePaginatedQuery<Record<string, never>, MeetingRow>(
    trpc.meetingsRouter.list.queryOptions,
    {},
    {
      paramPrefix: 'pm',
      pageSize: 20,
      pageSizeOptions: MEETING_PAGE_SIZE_OPTIONS,
      filters: MEETING_FILTER_CONFIG,
    },
  )

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
    setAssignRepDialog({ meetingId: entity.id })
  }, [])

  const handleAssignProject = useCallback((entity: MeetingRow) => {
    setAssignProjectMeetingId(entity.id)
  }, [])

  const { actions: sharedActions, DeleteConfirmDialog } = useMeetingActionConfigs<MeetingRow>({
    onView: handleView,
    onAssignOwner: handleAssignOwner,
    onAssignProject: handleAssignProject,
  })

  const meta: MeetingTableMeta = useMemo(() => ({
    meetingActions: () => sharedActions,
    onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => updateOutcome.mutate({ id: meetingId, meetingOutcome: outcome }),
    onUpdateScheduledFor: (meetingId: string, date: Date) => updateScheduledFor.mutate({ id: meetingId, scheduledFor: date.toISOString() }),
    onAssignRep: (meetingId: string, _currentOwnerId: string) => {
      setAssignRepDialog({ meetingId })
    },
    canAssignMeeting: ability.can('assign', 'Meeting'),
  }), [sharedActions, updateOutcome, updateScheduledFor, ability])

  return (
    <>
      <DeleteConfirmDialog />

      <RecordsPageShell
        header={<RecordsPageHeader title="Past Meetings" pagination={pagination} />}
        toolbar={(
          <QueryToolbar pagination={pagination} entityName="meetings">
            <QueryToolbar.Bar>
              <QueryToolbar.Search placeholder="Search by customer or type…" />
              <QueryToolbar.FilterTrigger />
              <QueryToolbar.PageSize />
            </QueryToolbar.Bar>
            <QueryToolbar.ChipRail />
            <QueryToolbar.LiveStatus />
          </QueryToolbar>
        )}
        table={(
          <DataTable
            tableId="past-meetings"
            data={pagination.rows}
            columns={columns}
            meta={meta}
            getRowClassName={getMeetingRowClassName}
            entityName="meeting"
            rowDataAttribute="data-meeting-row"
            onRowClick={(row) => {
              if (row.customerId) {
                handleView(row)
              }
            }}
            serverPagination={toDataTablePagination(pagination)}
            serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
          />
        )}
      />

      <ManageParticipantsModal
        meetingIds={assignRepDialog ? [assignRepDialog.meetingId] : []}
        open={!!assignRepDialog}
        onOpenChange={open => !open && setAssignRepDialog(null)}
      />

      <AssignProjectDialog
        meetingId={assignProjectMeetingId}
        open={!!assignProjectMeetingId}
        onOpenChange={open => !open && setAssignProjectMeetingId(null)}
      />
    </>
  )
}
