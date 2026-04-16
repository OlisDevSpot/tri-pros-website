'use client'

import type { JSX } from 'react'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useMemo } from 'react'

import { ACTIVITY_ACTIONS } from '@/shared/entities/activities/constants'
import { useConfirm } from '@/shared/hooks/use-confirm'

import { useActivityActions } from './use-activity-actions'

interface ActivityEntity {
  id: string
}

interface ActivityActionOverrides<T extends ActivityEntity> {
  onView?: (entity: T) => void
}

interface ActivityActionConfigsResult<T extends ActivityEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
}

export function useActivityActionConfigs<T extends ActivityEntity>(
  overrides: ActivityActionOverrides<T> = {},
): ActivityActionConfigsResult<T> {
  const { deleteActivity, completeActivity } = useActivityActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete activity',
    message: 'This will permanently delete this activity. This cannot be undone.',
  })

  const actions = useMemo((): EntityActionConfig<T>[] => {
    const configs: EntityActionConfig<T>[] = [
      {
        action: ACTIVITY_ACTIONS.view,
        onAction: overrides.onView ?? (() => {}),
      },
      {
        action: ACTIVITY_ACTIONS.complete,
        onAction: (entity: T) => completeActivity.mutate({ id: entity.id }),
        isLoading: completeActivity.isPending,
      },
      {
        action: ACTIVITY_ACTIONS.delete,
        onAction: async (entity: T) => {
          const ok = await confirmDelete()
          if (ok) {
            deleteActivity.mutate({ id: entity.id })
          }
        },
        isLoading: deleteActivity.isPending,
      },
    ]

    return configs
  }, [overrides, completeActivity, deleteActivity, confirmDelete])

  return { actions, DeleteConfirmDialog }
}
