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

interface LeadSourceCustomersSectionProps {
  leadSourceId: string
}

export function LeadSourceCustomersSection({ leadSourceId }: LeadSourceCustomersSectionProps) {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const pagination = usePaginatedQuery<{ id: string }, CustomerTableRow>(
    trpc.leadSourcesRouter.getCustomers.queryOptions,
    { id: leadSourceId },
    {
      paramPrefix: 'src',
      pageSize: 20,
      pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
      filters: CUSTOMER_FILTER_CONFIG,
    },
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

  const columns = useEntityColumns(CUSTOMER_COLUMNS, { show: SHOW_COLUMNS })
  const visibility = useColumnVisibility('lead-source-customers', columns)

  // Lead-source edit is wired by the cell itself (CASL-gated, default
  // mutation + invalidation). Reassigning a row here removes it from the
  // list (no longer matches `customersMatchingSource`) — that drop is
  // covered by the default invalidation hitting both customer + lead-source
  // query trees, so no override is needed.
  const meta = useMemo<CustomerTableMeta>(
    () => ({
      customerActions: () => actions,
      onUpdateCreatedAt: (customerId, date) =>
        updateCreatedAt.mutate({ id: customerId, data: { createdAt: date.toISOString() } }),
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
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Customers from this source
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {pagination.isLoading ? 'Loading…' : `${pagination.total.toLocaleString()} total`}
          </span>
        </div>

        <QueryToolbar pagination={pagination} entityName="customers">
          <QueryToolbar.Bar>
            <QueryToolbar.Search placeholder="Filter by name or email…" />
            <QueryToolbar.FilterTrigger />
            <QueryToolbar.ColumnsTrigger visibility={visibility} />
            <QueryToolbar.PageSize />
          </QueryToolbar.Bar>
          <QueryToolbar.ChipRail />
          <QueryToolbar.LiveStatus />
        </QueryToolbar>
      </div>

      {/*
        The wrapping `min-h-0 flex-1` cell is what lets the DataTable's
        internal `h-full` resolve and pin its pagination bar at the bottom
        while the row body scrolls — same pattern as `RecordsPageShell`
        on the customers page.
      */}
      <div className="min-h-0 flex-1">
        <DataTable
          tableId="lead-source-customers"
          columns={columns}
          data={pagination.rows}
          meta={meta}
          entityName="customer"
          onRowClick={row => handleViewProfile(row.id)}
          serverPagination={toDataTablePagination(pagination)}
          serverSorting={toDataTableSorting(pagination, { fallbackVisual: { id: 'createdAt', desc: true } })}
          columnVisibility={visibility.columnVisibility}
        />
      </div>
    </section>
  )
}
