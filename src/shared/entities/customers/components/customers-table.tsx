'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageShell } from '@/shared/components/records-page-shell'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/query/defaults'
import { usePaginatedQuery } from '@/shared/dal/client/query/use-paginated-query'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { buildCustomerColumns } from '@/shared/entities/customers/components/customer-table-columns'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { CUSTOMER_FILTER_CONFIG } from '@/shared/entities/customers/constants/customer-filter-config'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

type CustomerRow = AppRouterOutputs['customersRouter']['list']['rows'][number]

export function CustomersTable() {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const pagination = usePaginatedQuery<Record<string, never>, CustomerRow>(
    trpc.customersRouter.list.queryOptions,
    {},
    {
      paramPrefix: 'pc',
      pageSize: 20,
      pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
      filters: CUSTOMER_FILTER_CONFIG,
    },
  )

  const updateCreatedAt = useMutation(
    trpc.customersRouter.updateCreatedAt.mutationOptions({
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

  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerRow>({
    onView: entity => handleViewProfile(entity.id),
  })

  const columns = useMemo(
    () => buildCustomerColumns<CustomerRow>({ includeSource: true }),
    [],
  )

  const meta = useMemo(
    () => ({
      customerActions: () => actions,
      onUpdateCreatedAt: (customerId: string, date: Date) =>
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
            <QueryToolbar.Standard searchPlaceholder="Search by name or email…" />
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
          />
        )}
      />
    </>
  )
}
