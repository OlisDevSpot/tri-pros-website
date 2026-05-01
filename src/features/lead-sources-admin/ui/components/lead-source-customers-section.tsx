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

type CustomerRow = AppRouterOutputs['leadSourcesRouter']['getCustomers']['rows'][number]

interface LeadSourceCustomersSectionProps {
  leadSourceId: string
}

export function LeadSourceCustomersSection({ leadSourceId }: LeadSourceCustomersSectionProps) {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const pagination = usePaginatedQuery<{ id: string }, CustomerRow>(
    trpc.leadSourcesRouter.getCustomers.queryOptions,
    { id: leadSourceId },
    {
      paramPrefix: 'src',
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

  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerRow>({
    onView: entity => handleViewProfile(entity.id),
  })

  const columns = useMemo(() => buildCustomerColumns<CustomerRow>(), [])

  const meta = useMemo(
    () => ({
      customerActions: () => actions,
      onUpdateCreatedAt: (customerId: string, date: Date) =>
        updateCreatedAt.mutate({ customerId, createdAt: date.toISOString() }),
    }),
    [actions, updateCreatedAt],
  )

  return (
    <section
      aria-label="Customers from this lead source"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <DeleteConfirmDialog />

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Customers from this source
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pagination.isLoading ? 'Loading…' : `${pagination.total.toLocaleString()} total`}
            </span>
          </div>
        </div>

        <QueryToolbar pagination={pagination}>
          <QueryToolbar.Search placeholder="Filter by name or email…" />
          <QueryToolbar.Filters />
          <QueryToolbar.ClearAll />
          <div className="ml-auto">
            <QueryToolbar.PageSize />
          </div>
        </QueryToolbar>

        <QueryToolbar pagination={pagination}>
          <QueryToolbar.ActiveFilterChips />
        </QueryToolbar>
      </div>

      <DataTable
        tableId="lead-source-customers"
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
