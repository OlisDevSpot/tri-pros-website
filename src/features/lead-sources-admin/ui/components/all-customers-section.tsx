'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { CUSTOMER_FILTER_CONFIG, CUSTOMER_PAGE_SIZE_OPTIONS } from '@/features/lead-sources-admin/constants/customer-filter-config'
import { buildCustomerColumns } from '@/features/lead-sources-admin/ui/components/customer-table-columns'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { usePaginatedQuery } from '@/shared/dal/client/query/use-paginated-query'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

type AllCustomerRow = AppRouterOutputs['leadSourcesRouter']['getAllCustomers']['rows'][number]

export function AllCustomersSection() {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const pagination = usePaginatedQuery<Record<string, never>, AllCustomerRow>(
    trpc.leadSourcesRouter.getAllCustomers.queryOptions,
    {},
    {
      paramPrefix: 'all',
      pageSize: 20,
      pageSizeOptions: CUSTOMER_PAGE_SIZE_OPTIONS,
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

  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<AllCustomerRow>({
    onView: entity => handleViewProfile(entity.id),
  })

  const columns = useMemo(
    () => buildCustomerColumns<AllCustomerRow>({ includeSource: true }),
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
    <section aria-label="All customers" className="flex min-h-0 flex-1 flex-col gap-3">
      <DeleteConfirmDialog />

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            All customers
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {pagination.isLoading ? 'Loading…' : `${pagination.total.toLocaleString()} total`}
          </span>
        </div>

        <QueryToolbar pagination={pagination} entityName="customers">
          <QueryToolbar.Bar>
            <QueryToolbar.Search placeholder="Filter by name or email…" />
            <QueryToolbar.FilterTrigger />
            <QueryToolbar.PageSize />
          </QueryToolbar.Bar>
          <QueryToolbar.ChipRail />
          <QueryToolbar.LiveStatus />
        </QueryToolbar>
      </div>

      <DataTable
        tableId="all-customers"
        columns={columns}
        data={pagination.rows}
        meta={meta}
        entityName="customer"
        onRowClick={row => handleViewProfile(row.id)}
        serverPagination={toDataTablePagination(pagination)}
        serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
      />
    </section>
  )
}
