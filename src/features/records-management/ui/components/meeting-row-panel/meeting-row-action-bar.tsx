'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { useMemo } from 'react'

import { withToolbarRoles } from '@/shared/components/entities/entity-actions/lib/with-toolbar-roles'
import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'

interface MeetingRowActionBarProps {
  meeting: MeetingRow
  actions: EntityActionConfig<MeetingRow>[]
}

export function MeetingRowActionBar({ meeting, actions }: MeetingRowActionBarProps) {
  const toolbarActions = useMemo(
    () => withToolbarRoles(actions, { primaryId: 'start', promotedIds: ['createProposal'] }),
    [actions],
  )
  return <EntityActionMenu entity={meeting} actions={toolbarActions} mode="toolbar" />
}
