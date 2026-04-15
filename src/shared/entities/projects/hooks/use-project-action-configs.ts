import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useMemo } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { PROJECT_ACTIONS } from '@/shared/entities/projects/constants/actions'
import { useConfirm } from '@/shared/hooks/use-confirm'

import { useProjectActions } from './use-project-actions'

interface ProjectEntity {
  id: string
  accessor?: string
}

interface ProjectActionOverrides<T extends ProjectEntity> {
  onView?: (entity: T) => void
  onEdit?: (entity: T) => void
}

interface ProjectActionConfigsResult<T extends ProjectEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
}

function defaultView(entity: { id: string, accessor?: string }) {
  const slug = entity.accessor ?? entity.id
  window.open(`${ROOTS.landing.portfolioProjects()}/${slug}`, '_blank')
}

function defaultEdit(entity: { id: string }) {
  window.location.href = ROOTS.dashboard.projects.byId(entity.id)
}

export function useProjectActionConfigs<T extends ProjectEntity>(
  overrides: ProjectActionOverrides<T> = {},
): ProjectActionConfigsResult<T> {
  const { deleteProject } = useProjectActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete project',
    message: 'This will permanently delete this project and all its media. This cannot be undone.',
  })

  const actions = useMemo((): EntityActionConfig<T>[] => [
    {
      action: PROJECT_ACTIONS.view,
      onAction: overrides.onView ?? defaultView,
    },
    {
      action: PROJECT_ACTIONS.edit,
      onAction: overrides.onEdit ?? defaultEdit,
    },
    {
      action: PROJECT_ACTIONS.delete,
      onAction: async (entity) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteProject.mutate({ id: entity.id })
        }
      },
      isLoading: deleteProject.isPending,
    },
  ], [overrides.onView, overrides.onEdit, deleteProject, confirmDelete])

  return { actions, DeleteConfirmDialog }
}
