'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { useMeetingRowPanelData } from '@/features/records-management/hooks/use-meeting-row-panel-data'
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
  const { profile, proposals } = useMeetingRowPanelData(meeting)

  return (
    <ExpandedRowPanel>
      <ExpandedRowPanel.ActionBar>
        <MeetingRowActionBar meeting={meeting} actions={actions} />
      </ExpandedRowPanel.ActionBar>
      <ExpandedRowPanel.Details>
        <MeetingRowDetails meeting={meeting} />
      </ExpandedRowPanel.Details>
      {profile.isError && (
        <ExpandedRowPanel.Error
          title="Couldn't load this meeting's proposals"
          description="Trades still show; retry to load the proposals."
          onRetry={() => void profile.refetch()}
        />
      )}
      {/* Trades come from the row itself, so a failed profile read hides only the proposals pane. */}
      <ExpandedRowPanel.Panes className={profile.isError ? undefined : '@min-[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]'}>
        <MeetingTradesPane meeting={meeting} actions={actions} />
        {!profile.isError && (
          <MeetingProposalsPane
            meeting={meeting}
            proposals={proposals}
            isLoading={profile.isLoading}
            onMutationSuccess={() => void profile.refetch()}
          />
        )}
      </ExpandedRowPanel.Panes>
    </ExpandedRowPanel>
  )
}
