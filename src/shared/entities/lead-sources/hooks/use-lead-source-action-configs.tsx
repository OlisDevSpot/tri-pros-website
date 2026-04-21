'use client'

import type { JSX } from 'react'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { LEAD_SOURCE_ACTIONS } from '@/shared/entities/lead-sources/constants/actions'
import { getIntakeUrl } from '@/shared/entities/lead-sources/lib/intake-url'
import { useConfirm } from '@/shared/hooks/use-confirm'

import { useLeadSourceActions } from './use-lead-source-actions'

interface LeadSourceEntity {
  id: string
  slug: string
  token: string
  isActive: boolean
}

interface LeadSourceActionOverrides<T extends LeadSourceEntity> {
  onView?: (entity: T) => void
  /** Confirm + delete handler override. When omitted, the default confirm dialog runs. */
  onDelete?: (entity: T) => void
}

interface LeadSourceActionConfigsResult<T extends LeadSourceEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
}

export function useLeadSourceActionConfigs<T extends LeadSourceEntity>(
  overrides: LeadSourceActionOverrides<T> = {},
): LeadSourceActionConfigsResult<T> {
  const {
    toggleActive,
    duplicateLeadSource,
    deleteLeadSource,
  } = useLeadSourceActions()

  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete lead source',
    message: 'This permanently deletes the lead source. Existing customer records keep their original lead-source value but will no longer match this row for stats. This cannot be undone.',
  })

  const copyIntakeUrl = useCallback((entity: T) => {
    const url = getIntakeUrl(entity.slug, entity.token, window.location.origin)
    navigator.clipboard.writeText(url).then(
      () => toast.success('Intake URL copied'),
      () => toast.error('Failed to copy'),
    )
  }, [])

  const previewIntake = useCallback((entity: T) => {
    const url = getIntakeUrl(entity.slug, entity.token, window.location.origin)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const actions = useMemo((): EntityActionConfig<T>[] => {
    return [
      {
        action: LEAD_SOURCE_ACTIONS.view,
        onAction: overrides.onView ?? (() => {}),
      },
      {
        action: LEAD_SOURCE_ACTIONS.copyIntakeUrl,
        onAction: copyIntakeUrl,
      },
      {
        action: LEAD_SOURCE_ACTIONS.previewIntake,
        onAction: previewIntake,
      },
      {
        action: LEAD_SOURCE_ACTIONS.toggleActive,
        onAction: (entity) => {
          toggleActive.mutate({ id: entity.id, isActive: !entity.isActive })
        },
        isLoading: toggleActive.isPending,
      },
      {
        action: LEAD_SOURCE_ACTIONS.duplicate,
        onAction: entity => duplicateLeadSource.mutate({ id: entity.id }),
        isLoading: duplicateLeadSource.isPending,
      },
      // Archive maps to "deactivate" for v1; a dedicated archive flag can land
      // later if we need a three-state (active / paused / archived) model.
      {
        action: LEAD_SOURCE_ACTIONS.archive,
        onAction: (entity) => {
          if (!entity.isActive) {
            toast.info('Already inactive.')
            return
          }
          toggleActive.mutate({ id: entity.id, isActive: false })
        },
        isDisabled: !toggleActive && false,
      },
      {
        action: LEAD_SOURCE_ACTIONS.delete,
        onAction: overrides.onDelete ?? (async (entity: T) => {
          const ok = await confirmDelete()
          if (ok) {
            deleteLeadSource.mutate({ id: entity.id })
          }
        }),
        isLoading: deleteLeadSource.isPending,
      },
    ]
  }, [overrides, copyIntakeUrl, previewIntake, toggleActive, duplicateLeadSource, deleteLeadSource, confirmDelete])

  return { actions, DeleteConfirmDialog }
}
