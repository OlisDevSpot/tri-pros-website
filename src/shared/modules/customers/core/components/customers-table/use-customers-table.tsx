'use client'

import type { EntityTableView } from '@/shared/components/data-view/table/types/entity-table-view'
import type { FilterValues } from '@/shared/dal/lib/query/field-list'
import type { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import type { CustomerColumnKey, CustomerTableMeta, CustomerTableRow } from '@/shared/entities/customers/lib/columns-registry'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { useEntityTable } from '@/shared/components/data-view/table/lib/use-entity-table'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useAbility } from '@/shared/domains/permissions/client'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'
import { CUSTOMER_COLUMNS } from '@/shared/entities/customers/lib/columns-registry'
import { openCustomerProfile } from '@/shared/modules/customers/core/lib/open-customer-profile'
import { openCreateMeeting } from '@/shared/modules/meetings/core/lib/open-create-meeting'
import { useTRPC } from '@/trpc/helpers'

export interface UseCustomersTableOptions {
  /** Filter values only this callsite knows (one lead source's id). A pin that never changes belongs in the table view's `query.fixed`. */
  fixed?: FilterValues<typeof CUSTOMER_FIELDS>
}

export function useCustomersTable(
  tableView: EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>,
  { fixed }: UseCustomersTableOptions = {},
) {
  const trpc = useTRPC()
  const ability = useAbility()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()

  const query = useDataViewQuery(trpc.customersRouter.business.list, {}, tableView.query, fixed)

  const { mutate: updateCreatedAt } = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => {
        toast.success('Created date updated')
        invalidateCustomer()
        // A lead source's figures are counted over its customers' created dates.
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )

  const openProfile = useCallback((row: CustomerTableRow) => openCustomerProfile({ customerId: row.id }), [])

  const scheduleMeeting = useCallback(
    (row: CustomerTableRow) => openCreateMeeting({ customerId: row.id, customerName: row.name }),
    [],
  )

  // Without it, Schedule Meeting falls back to opening the pipeline board.
  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({
    onView: openProfile,
    onScheduleMeeting: scheduleMeeting,
  })

  // The server checks each changed column, so a viewer without `createdAt` would open the picker only to be refused;
  // without the handler the cell shows the date alone.
  const canEditCreatedAt = ability.can('update', 'Customer', 'createdAt')
  const meta = useMemo(() => ({
    onUpdateCreatedAt: canEditCreatedAt
      ? (customerId: string, date: Date) => updateCreatedAt({ id: customerId, data: { createdAt: date.toISOString() } })
      : undefined,
  }) satisfies Omit<CustomerTableMeta, 'rowActions'>, [canEditCreatedAt, updateCreatedAt])

  const table = useEntityTable({
    tableView,
    registry: CUSTOMER_COLUMNS,
    query,
    actions,
    meta,
    onRowClick: openProfile,
    entityName: 'customer',
    rowDataAttribute: 'data-customer-row',
    skeletonRowClassName: 'h-[60px]',
  })

  return { ...table, dialogs: <DeleteConfirmDialog /> }
}
