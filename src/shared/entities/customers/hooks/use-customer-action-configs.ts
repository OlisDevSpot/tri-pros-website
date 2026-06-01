import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useMemo } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { CUSTOMER_ACTIONS } from '@/shared/entities/customers/constants/actions'
import { useCustomerActions } from '@/shared/entities/customers/hooks/use-customer-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'

interface CustomerEntity {
  id: string
}

/**
 * Optional handler overrides. Every action is always present — if a handler
 * is omitted, the default behaviour (navigate to pipelines) is used.
 *
 * `onDeleted` fires after a successful delete mutation so callers in modals /
 * profile pages can close themselves or navigate away.
 */
interface CustomerActionOverrides<T extends CustomerEntity> {
  onView?: (entity: T) => void
  onEdit?: (entity: T) => void
  onScheduleMeeting?: (entity: T) => void
  onDeleted?: (entity: T) => void
}

interface CustomerActionConfigsResult<T extends CustomerEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
}

function defaultNavigate() {
  window.location.href = ROOTS.dashboard.pipeline()
}

export function useCustomerActionConfigs<T extends CustomerEntity>(
  overrides: CustomerActionOverrides<T> = {},
): CustomerActionConfigsResult<T> {
  const { deleteCustomer } = useCustomerActions()
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete customer',
    message: 'This will permanently delete this customer and all associated data. This cannot be undone.',
  })

  const actions = useMemo((): EntityActionConfig<T>[] => [
    {
      action: CUSTOMER_ACTIONS.view,
      onAction: overrides.onView ?? defaultNavigate,
    },
    {
      action: CUSTOMER_ACTIONS.edit,
      onAction: overrides.onEdit ?? defaultNavigate,
    },
    {
      action: CUSTOMER_ACTIONS.scheduleMeeting,
      onAction: overrides.onScheduleMeeting ?? defaultNavigate,
    },
    {
      action: CUSTOMER_ACTIONS.delete,
      onAction: async (entity: T) => {
        const ok = await confirmDelete()
        if (!ok) {
          return
        }
        deleteCustomer.mutate(
          { id: entity.id },
          { onSuccess: () => overrides.onDeleted?.(entity) },
        )
      },
      isLoading: deleteCustomer.isPending,
    },
  ], [overrides, confirmDelete, deleteCustomer])

  return { actions, DeleteConfirmDialog }
}
