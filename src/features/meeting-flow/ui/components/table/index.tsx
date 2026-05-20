'use client'

import type { MeetingOutcome } from '@/shared/constants/enums'

import type { MeetingRow, MeetingTableMeta } from '@/shared/entities/meetings/lib/columns-registry'

import { useCallback, useMemo, useState } from 'react'
import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { AssignProjectDialog } from '@/features/customer-pipelines/ui/components/assign-project-dialog'
import { MEETING_FILTER_CONFIG } from '@/features/meeting-flow/constants/meeting-table-filter-config'
import { getMeetingRowClassName } from '@/features/meeting-flow/lib/meeting-row-class'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'

import { MEETING_COLUMNS } from '@/shared/entities/meetings/lib/columns-registry'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

const SHOW_COLUMNS = ['customerName', 'meetingOutcome', 'ownerName', 'scheduledFor'] as const

export function PastMeetingsTable() {
  const trpc = useTRPC()
  const ability = useAbility()
  const { updateOutcome, updateScheduledFor } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()

  const [assignRepDialog, setAssignRepDialog] = useState<{ meetingId: string } | null>(null)
  const [assignProjectMeetingId, setAssignProjectMeetingId] = useState<string | null>(null)

  const pagination = usePaginatedQuery<Record<string, never>, MeetingRow>(
    trpc.meetingsRouter.reads.list.queryOptions,
    {},
    {
      paramPrefix: 'pm',
      pageSize: 20,
      pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
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

  const columns = useEntityColumns(MEETING_COLUMNS, { show: SHOW_COLUMNS })
  const visibility = useColumnVisibility('past-meetings', columns)

  const meta = useMemo<MeetingTableMeta>(() => ({
    meetingActions: () => sharedActions,
    onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) =>
      updateOutcome.mutate({ id: meetingId, data: { meetingOutcome: outcome } }),
    onUpdateScheduledFor: (meetingId: string, date: Date) =>
      updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } }),
    onAssignRep: (meetingId: string) => {
      setAssignRepDialog({ meetingId })
    },
    canAssignMeeting: ability.can('assign', 'Meeting'),
  }), [sharedActions, updateOutcome, updateScheduledFor, ability])

  return (
    <>
      <DeleteConfirmDialog />

      <RecordsPageShell
        header={<RecordsPageHeader title="Meetings" pagination={pagination} />}
        toolbar={(
          <QueryToolbar pagination={pagination} entityName="meetings">
            <QueryToolbar.Standard searchPlaceholder="Search by customer or type…" visibility={visibility} />
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
            columnVisibility={visibility.columnVisibility}
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
