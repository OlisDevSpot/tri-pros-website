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
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { CUSTOMER_FILTER_CONFIG } from '@/shared/entities/customers/constants/customer-filter-config'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'

import { CUSTOMER_COLUMNS } from '@/shared/entities/customers/lib/columns-registry'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

const SHOW_COLUMNS = ['name', 'leadSourceName', 'pipeline', 'createdAt'] as const

export function CustomersTable() {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const pagination = usePaginatedQuery<Record<string, never>, CustomerTableRow>(
    trpc.customersRouter.business.list.queryOptions,
    {},
    {
      paramPrefix: 'pc',
      pageSize: 20,
      pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
      filters: CUSTOMER_FILTER_CONFIG,
    },
  )

  const updateCreatedAt = useMutation(
    trpc.customersRouter.business.updateCreatedAt.mutationOptions({
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

  const columns = useEntityColumns(CUSTOMER_COLUMNS, { show: SHOW_COLUMNS })
  const visibility = useColumnVisibility('customers', columns)

  // Lead-source edit is wired by the cell itself (CASL-gated, default
  // mutation + invalidation) — no `onUpdateLeadSource` needed here.
  const meta = useMemo<CustomerTableMeta>(
    () => ({
      customerActions: () => actions,
      onUpdateCreatedAt: (customerId, date) =>
        updateCreatedAt.mutate({ customerId, createdAt: date.toISOString() }),
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
