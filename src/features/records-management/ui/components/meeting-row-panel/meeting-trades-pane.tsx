'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { useMemo } from 'react'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { withToolbarRoles } from '@/shared/components/entities/entity-actions/lib/with-toolbar-roles'
import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'
import { TradeSelectionSummary } from '@/shared/entities/meetings/components/trade-selection-summary'

interface MeetingTradesPaneProps {
  meeting: MeetingRow
  actions: EntityActionConfig<MeetingRow>[]
}

export function MeetingTradesPane({ meeting, actions }: MeetingTradesPaneProps) {
  const selections = meeting.flowStateJSON?.tradeSelections ?? []
  const startOnly = useMemo(
    () => withToolbarRoles(actions.filter(config => config.action.id === 'start'), { primaryId: 'start' }),
    [actions],
  )
  const canStillStart = meeting.meetingOutcome === 'not_set'
    || (meeting.scheduledFor != null && new Date(meeting.scheduledFor).getTime() > Date.now())

  return (
    <ExpandedRowPanel.Pane title="Trades">
      {selections.length === 0
        ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">No trades captured yet. They're picked during the meeting.</p>
              {canStillStart && <EntityActionMenu entity={meeting} actions={startOnly} mode="toolbar" />}
            </div>
          )
        : (
            <ul className="flex flex-col gap-3">
              {selections.map(selection => (
                <li key={selection.tradeId} className="flex gap-3">
                  <TradeSelectionSummary entry={selection} work="full" showNote />
                </li>
              ))}
            </ul>
          )}
    </ExpandedRowPanel.Pane>
  )
}
