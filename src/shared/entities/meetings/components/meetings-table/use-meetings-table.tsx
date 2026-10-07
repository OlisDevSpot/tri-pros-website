'use client'

import type { RenderExpandedRow } from '@/shared/components/data-table/types/entity-expanded-row'
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { MeetingOutcome } from '@/shared/constants/enums'
import type { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import type { MeetingColumnKey, MeetingRow, MeetingTableMeta } from '@/shared/entities/meetings/lib/columns-registry'

import { useCallback, useMemo, useState } from 'react'

import { useEntityTable } from '@/shared/components/data-table/lib/use-entity-table'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useAbility } from '@/shared/domains/permissions/client'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { AssignProjectDialog } from '@/shared/entities/meetings/components/assign-project-dialog'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { MEETING_COLUMNS } from '@/shared/entities/meetings/lib/columns-registry'
import { getMeetingRowClassName } from '@/shared/entities/meetings/lib/meeting-row-class'
import { openModal } from '@/shared/lib/open-modal'
import { useTRPC } from '@/trpc/helpers'

export interface UseMeetingsTableOptions {
  renderExpandedRow?: RenderExpandedRow<MeetingRow>
}

export function useMeetingsTable(
  tableView: EntityTableView<MeetingColumnKey, typeof MEETING_FIELDS>,
  { renderExpandedRow }: UseMeetingsTableOptions = {},
) {
  const trpc = useTRPC()
  const ability = useAbility()
  const { updateScheduledFor, updateSetter } = useMeetingActions()

  const [participantsMeetingId, setParticipantsMeetingId] = useState<string | null>(null)
  const [assignProjectMeetingId, setAssignProjectMeetingId] = useState<string | null>(null)

  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, {}, tableView.query)

  const handleView = useCallback((row: MeetingRow) => {
    if (!row.customerId) {
      return
    }
    openModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId: row.customerId, defaultTab: 'meetings' as const, highlightMeetingId: row.id },
    })
  }, [])

  const overrides = useMemo(() => ({
    onView: handleView,
    onAssignOwner: (row: MeetingRow) => setParticipantsMeetingId(row.id),
    onAssignProject: (row: MeetingRow) => setAssignProjectMeetingId(row.id),
  }), [handleView])

  const { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome }
    = useMeetingActionConfigs<MeetingRow>(overrides)

  const meta = useMemo(() => ({
    onUpdateOutcome: (meetingId: string, outcome: MeetingOutcome) => {
      void changeOutcome(meetingId, outcome)
    },
    onUpdateScheduledFor: (meetingId: string, date: Date) =>
      updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } }),
    onAssignRep: (meetingId: string) => setParticipantsMeetingId(meetingId),
    onUpdateSetter: (meetingId: string, setBy: string) =>
      updateSetter.mutate({ id: meetingId, data: { setBy } }),
    canAssignMeeting: ability.can('assign', 'Meeting'),
    onViewProfile: (customerId: string) => {
      openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
    },
  }) satisfies Omit<MeetingTableMeta, 'rowActions'>, [changeOutcome, updateScheduledFor, updateSetter, ability])

  const table = useEntityTable({
    tableView,
    registry: MEETING_COLUMNS,
    query,
    actions,
    meta,
    renderExpandedRow,
    onRowClick: handleView,
    entityName: 'meeting',
    rowDataAttribute: 'data-meeting-row',
    skeletonRowClassName: 'h-[58.5px]',
    getRowClassName: getMeetingRowClassName,
  })

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

  return { ...table, dialogs }
}
