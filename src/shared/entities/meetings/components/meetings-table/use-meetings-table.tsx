'use client'

import type { ReactNode } from 'react'

import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingColumnKey, MeetingRow, MeetingTableMeta } from '@/shared/entities/meetings/lib/columns-registry'

import { useCallback, useMemo, useState } from 'react'

import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'
import { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'
import { fromPaginatedQuery } from '@/shared/dal/client/lib/from-paginated-query'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { AssignProjectDialog } from '@/shared/entities/meetings/components/assign-project-dialog'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { MEETING_COLUMNS } from '@/shared/entities/meetings/lib/columns-registry'
import { getMeetingRowClassName } from '@/shared/entities/meetings/lib/meeting-row-class'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

export interface MeetingsExpandedRowContext {
  actions: EntityActionConfig<MeetingRow>[]
}

export interface UseMeetingsTableOptions {
  renderExpandedRow?: (row: MeetingRow, ctx: MeetingsExpandedRowContext) => ReactNode
}

export function useMeetingsTable(
  tableView: EntityTableView<MeetingColumnKey>,
  { renderExpandedRow }: UseMeetingsTableOptions = {},
) {
  const trpc = useTRPC()
  const ability = useAbility()
  const { updateScheduledFor } = useMeetingActions()
  const { open: openModal, setModal } = useModalStore()

  const [participantsMeetingId, setParticipantsMeetingId] = useState<string | null>(null)
  const [assignProjectMeetingId, setAssignProjectMeetingId] = useState<string | null>(null)

  const pagination = usePaginatedQuery<Record<string, never>, MeetingRow>(
    trpc.meetingsRouter.reads.list.queryOptions,
    {},
    tableView.query,
  )
  const query = fromPaginatedQuery(pagination)

  const handleView = useCallback((row: MeetingRow) => {
    if (!row.customerId) {
      return
    }
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId: row.customerId, defaultTab: 'meetings' as const, highlightMeetingId: row.id },
    })
    openModal()
  }, [setModal, openModal])

  // Memoized: the action configs are keyed on this object's identity.
  const overrides = useMemo(() => ({
    onView: handleView,
    onAssignOwner: (row: MeetingRow) => setParticipantsMeetingId(row.id),
    onAssignProject: (row: MeetingRow) => setAssignProjectMeetingId(row.id),
  }), [handleView])

  const { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome }
    = useMeetingActionConfigs<MeetingRow>(overrides)

  const columns = useEntityColumns(MEETING_COLUMNS, { show: tableView.columns })
  const visibility = useColumnVisibility(tableView.tableId, columns)

  const meta = useMemo<MeetingTableMeta>(() => ({
    meetingActions: () => actions,
    onUpdateOutcome: (meetingId, outcome) => {
      void changeOutcome(meetingId, outcome)
    },
    onUpdateScheduledFor: (meetingId, date) =>
      updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } }),
    onAssignRep: meetingId => setParticipantsMeetingId(meetingId),
    canAssignMeeting: ability.can('assign', 'Meeting'),
  }), [actions, changeOutcome, updateScheduledFor, ability])

  const expandedRowRenderer = useMemo(
    () => renderExpandedRow ? (row: MeetingRow) => renderExpandedRow(row, { actions }) : undefined,
    [renderExpandedRow, actions],
  )

  const dataTableProps = {
    tableId: tableView.tableId,
    data: pagination.rows,
    columns,
    meta,
    getRowClassName: getMeetingRowClassName,
    entityName: 'meeting',
    rowDataAttribute: 'data-meeting-row',
    renderExpandedRow: expandedRowRenderer,
    // Without an expanded row, a row click opens the customer profile.
    onRowClick: expandedRowRenderer ? undefined : handleView,
    serverPagination: toDataTablePagination(query),
    serverSorting: toDataTableSorting(query),
    columnVisibility: visibility.columnVisibility,
  } satisfies DataTableProps<MeetingRow, MeetingTableMeta>

  const dialogs = (
    <>
      <DeleteConfirmDialog />
      <OutcomeReasonDialog />
      <RescheduleDialog />
      <ManageParticipantsModal
        meetingIds={participantsMeetingId ? [participantsMeetingId] : []}
        open={!!participantsMeetingId}
        onOpenChange={open => !open && setParticipantsMeetingId(null)}
      />
      <AssignProjectDialog
        meetingId={assignProjectMeetingId}
        open={!!assignProjectMeetingId}
        onOpenChange={open => !open && setAssignProjectMeetingId(null)}
      />
    </>
  )

  return { pagination, visibility, dataTableProps, dialogs }
}
