'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useMemo } from 'react'

import { withToolbarRoles } from '@/shared/components/entities/entity-actions/lib/with-toolbar-roles'
import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'

interface ProjectRowActionBarProps {
  project: ProjectRow
  actions: EntityActionConfig<ProjectRow>[]
}

export function ProjectRowActionBar({ project, actions }: ProjectRowActionBarProps) {
  const toolbarActions = useMemo(
    () => withToolbarRoles(actions, { primaryId: 'edit', promotedIds: ['showOnPortfolio', 'hideFromPortfolio', 'view'] }),
    [actions],
  )
  return <EntityActionMenu entity={project} actions={toolbarActions} mode="toolbar" />
}
