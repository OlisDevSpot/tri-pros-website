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
            // A narrow panel scrolls the trade cards sideways instead of stacking them down the page.
            <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 @min-[600px]:mx-0 @min-[600px]:flex-col @min-[600px]:overflow-visible @min-[600px]:px-0 @min-[600px]:pb-0">
              {selections.map(selection => (
                <li key={selection.tradeId} className="flex w-[85%] shrink-0 snap-start gap-3 rounded-md border bg-background/50 px-3 py-2 @min-[600px]:w-auto">
                  <TradeSelectionSummary entry={selection} work="full" showNote />
                </li>
              ))}
            </ul>
          )}
    </ExpandedRowPanel.Pane>
  )
}
