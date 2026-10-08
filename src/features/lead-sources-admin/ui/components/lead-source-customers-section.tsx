'use client'

import type { CustomerTableMeta, CustomerTableRow } from '@/shared/entities/customers/lib/columns-registry'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { toast } from 'sonner'
import { LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG } from '@/features/lead-sources-admin/constants/lead-sources-table-query-configs'
import { toDataTablePagination } from '@/shared/components/data-table/lib/to-data-table-pagination'
import { toDataTableSorting } from '@/shared/components/data-table/lib/to-data-table-sorting'
import { useColumnVisibility } from '@/shared/components/data-table/lib/use-column-visibility'
import { useEntityColumns } from '@/shared/components/data-table/lib/use-entity-columns'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'

import { CUSTOMER_COLUMNS } from '@/shared/entities/customers/lib/columns-registry'
import { openModal } from '@/shared/lib/open-modal'
import { useTRPC } from '@/trpc/helpers'

const SHOW_COLUMNS = ['name', 'leadSourceName', 'pipeline', 'createdAt'] as const

interface LeadSourceCustomersSectionProps {
  leadSourceId: string
}

export function LeadSourceCustomersSection({ leadSourceId }: LeadSourceCustomersSectionProps) {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()

  const query = useDataViewQuery(trpc.leadSourcesRouter.getCustomers, { id: leadSourceId }, LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG)

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
    openModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId },
    })
  }, [])

  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({
    onView: entity => handleViewProfile(entity.id),
  })

  const columns = useEntityColumns(CUSTOMER_COLUMNS, { show: SHOW_COLUMNS })
  const visibility = useColumnVisibility('lead-source-customers', columns)

  // Lead-source edit is wired by the cell itself (CASL-gated, default
  // mutation + invalidation). Reassigning a row here removes it from the
  // list — getCustomers pins the source through CUSTOMER_FIELDS' `sourceId`
  // fixed filter, so a reassigned row no longer matches it — and that drop
  // is covered by the default invalidation hitting both customer + lead-source
  // query trees, so no override is needed.
  const meta = useMemo<CustomerTableMeta>(
    () => ({
      rowActions: actions,
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Customers from this source
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {query.isPending ? 'Loading…' : `${query.total.toLocaleString()} total`}
          </span>
        </div>

        <QueryToolbar query={query} entityName="customers">
          <QueryToolbar.Bar>
            <QueryToolbar.Search placeholder="Filter by name, email or phone…" />
            <QueryToolbar.FilterTrigger />
            <QueryToolbar.ColumnsTrigger visibility={visibility} />
            <QueryToolbar.RefreshButton />
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
          data={query.rows}
          meta={meta}
          entityName="customer"
          onRowClick={row => handleViewProfile(row.id)}
          serverPagination={toDataTablePagination(query)}
          serverSorting={toDataTableSorting(query)}
          columnVisibility={visibility.columnVisibility}
        />
      </div>
    </section>
  )
}
