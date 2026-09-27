'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { useMeetingRowPanelData } from '@/features/records-management/hooks/use-meeting-row-panel-data'
import { MeetingCustomerPane } from '@/features/records-management/ui/components/meeting-row-panel/meeting-customer-pane'
import { MeetingProposalsPane } from '@/features/records-management/ui/components/meeting-row-panel/meeting-proposals-pane'
import { MeetingRowActionBar } from '@/features/records-management/ui/components/meeting-row-panel/meeting-row-action-bar'
import { MeetingRowDetails } from '@/features/records-management/ui/components/meeting-row-panel/meeting-row-details'
import { MeetingTradesPane } from '@/features/records-management/ui/components/meeting-row-panel/meeting-trades-pane'
import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'

interface MeetingRowPanelProps {
  meeting: MeetingRow
  actions: EntityActionConfig<MeetingRow>[]
}

export function MeetingRowPanel({ meeting, actions }: MeetingRowPanelProps) {
  const { profile, customer, proposals } = useMeetingRowPanelData(meeting)

  return (
    <ExpandedRowPanel>
      <ExpandedRowPanel.ActionBar>
        <MeetingRowActionBar meeting={meeting} actions={actions} />
      </ExpandedRowPanel.ActionBar>
      <ExpandedRowPanel.Details>
        <MeetingRowDetails meeting={meeting} />
      </ExpandedRowPanel.Details>
      {profile.isError
        ? (
            <ExpandedRowPanel.Error
              title="Couldn't load this meeting's customer"
              description="The row still works; retry to load its details."
              onRetry={() => void profile.refetch()}
            />
          )
        : (
            <ExpandedRowPanel.Panes className="@min-[600px]:grid-cols-2 @min-[900px]:grid-cols-[250px_minmax(0,1fr)_minmax(0,1.15fr)]">
              <MeetingCustomerPane customer={customer} hasCustomer={!!meeting.customerId} isLoading={profile.isLoading} />
              <MeetingTradesPane meeting={meeting} actions={actions} />
              <MeetingProposalsPane
                meeting={meeting}
                proposals={proposals}
                isLoading={profile.isLoading}
                onMutationSuccess={() => void profile.refetch()}
                className="@min-[600px]:col-span-2 @min-[900px]:col-span-1"
              />
            </ExpandedRowPanel.Panes>
          )}
    </ExpandedRowPanel>
  )
}
