import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

import { useRouter } from 'next/navigation'
import { ROOTS } from '@/shared/config/roots'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'
import { PROJECT_ACTIONS } from '@/shared/modules/projects/core/constants/actions'

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
  window.open(ROOTS.landing.portfolioProject(slug), '_blank')
}

export function useProjectActionConfigs<T extends ProjectEntity>(
  overrides: ProjectActionOverrides<T> = {},
): ProjectActionConfigsResult<T> {
  const router = useRouter()
  const { deleteProject } = useProjectActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete project',
    message: 'This will permanently delete this project and all its media. This cannot be undone.',
  })

  const defaultEdit = (entity: { id: string }) => router.push(ROOTS.dashboard.projects.byId(entity.id))

  // The configs' callbacks close over this render's mutations; only the loading flag should re-render rows.
  const actions = useStableCallbacks<EntityActionConfig<T>[]>([
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
  ])

  return { actions, DeleteConfirmDialog }
}
