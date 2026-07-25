'use client'

import type { CustomerTableMeta, CustomerTableRow } from '@/shared/entities/customers/lib/columns-registry'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { toast } from 'sonner'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { usePaginatedQuery } from '@/shared/dal/client/hooks/use-paginated-query'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { CUSTOMERS_TABLE_QUERY_CONFIG, CUSTOMERS_TABLE_SHOW_COLUMNS } from '@/shared/entities/customers/constants/customers-table-query-config'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'

import { CUSTOMER_COLUMNS } from '@/shared/entities/customers/lib/columns-registry'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

export function CustomersTable() {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const pagination = usePaginatedQuery<Record<string, never>, CustomerTableRow>(
    trpc.customersRouter.business.list.queryOptions,
    {},
    CUSTOMERS_TABLE_QUERY_CONFIG,
  )

  const updateCreatedAt = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => {
        toast.success('Created date updated')
        invalidateCustomer()
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )

  const handleViewProfile = useCallback((customerId: string) => {
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId },
    })
    openModal()
  }, [setModal, openModal])

  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({
    onView: entity => handleViewProfile(entity.id),
  })

  const columns = useEntityColumns(CUSTOMER_COLUMNS, { show: CUSTOMERS_TABLE_SHOW_COLUMNS })
  const visibility = useColumnVisibility('customers', columns)

  // Lead-source edit is wired by the cell itself (CASL-gated, default
  // mutation + invalidation) — no `onUpdateLeadSource` needed here.
  const meta = useMemo<CustomerTableMeta>(
    () => ({
      customerActions: () => actions,
      onUpdateCreatedAt: (customerId, date) =>
        updateCreatedAt.mutate({ id: customerId, data: { createdAt: date.toISOString() } }),
    }),
    [actions, updateCreatedAt],
  )

  return (
    <>
      <DeleteConfirmDialog />

      <RecordsPageShell
        header={<RecordsPageHeader title="Customers" pagination={pagination} />}
        toolbar={(
          <QueryToolbar pagination={pagination} entityName="customers">
            <QueryToolbar.Standard searchPlaceholder="Search by name or email…" visibility={visibility} />
          </QueryToolbar>
        )}
        table={(
          <DataTable
            tableId="customers"
            data={pagination.rows}
            columns={columns}
            meta={meta}
            entityName="customer"
            rowDataAttribute="data-customer-row"
            onRowClick={row => handleViewProfile(row.id)}
            serverPagination={toDataTablePagination(pagination)}
            serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
            columnVisibility={visibility.columnVisibility}
          />
        )}
      />
    </>
  )
}
