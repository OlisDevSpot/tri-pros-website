import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { useMemo } from 'react'

import { CUSTOMER_ACTIONS } from '@/shared/components/entity-actions/constants/customer-actions'
import { ROOTS } from '@/shared/config/roots'
import { useConfirm } from '@/shared/hooks/use-confirm'

interface CustomerEntity {
  id: string
}

/**
 * Optional handler overrides. Every action is always present — if a handler
 * is omitted, the default behaviour (navigate to pipelines) is used.
 */
interface CustomerActionOverrides<T extends CustomerEntity> {
  onView?: (entity: T) => void
  onEdit?: (entity: T) => void
  onScheduleMeeting?: (entity: T) => void
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
      onAction: async () => {
        const ok = await confirmDelete()
        if (ok) {
          // TODO: Wire up when deleteCustomer tRPC procedure is implemented
        }
      },
    },
  ], [overrides.onView, overrides.onEdit, overrides.onScheduleMeeting, confirmDelete])

  return { actions, DeleteConfirmDialog }
}
