'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { buildCustomerColumns } from '@/features/lead-sources-admin/ui/components/customer-table-columns'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { Input } from '@/shared/components/ui/input'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

type AllCustomerRow = AppRouterOutputs['leadSourcesRouter']['getAllCustomers']['rows'][number]

const PAGE_SIZE = 15

export function AllCustomersSection() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const { setModal, open: openModal } = useModalStore()

  const [page, setPage] = useQueryState('ap', parseAsInteger.withDefault(1))
  const [rawSearch, setRawSearch] = useQueryState('aq', parseAsString.withDefault(''))
  const search = useDebounce(rawSearch.trim(), 250)

  const offset = (Math.max(page, 1) - 1) * PAGE_SIZE
  const queryInput = useMemo(
    () => ({
      search: search || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [search, offset],
  )

  const { data, isLoading, isFetching } = useQuery(
    trpc.leadSourcesRouter.getAllCustomers.queryOptions(queryInput),
  )

  // Prefetch the next page so Next-click is instant.
  useEffect(() => {
    if (!data) {
      return
    }
    const hasNext = offset + PAGE_SIZE < data.total
    if (!hasNext) {
      return
    }
    void qc.prefetchQuery(
      trpc.leadSourcesRouter.getAllCustomers.queryOptions({
        ...queryInput,
        offset: offset + PAGE_SIZE,
      }),
    )
  }, [data, offset, queryInput, qc, trpc.leadSourcesRouter.getAllCustomers])

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

  const total = data?.total ?? 0
  const rows = data?.rows ?? []

  return (
    <section aria-label="All customers" className="flex min-h-0 flex-1 flex-col gap-3">
      <DeleteConfirmDialog />

      <div className="flex shrink-0 items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            All customers
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {isLoading ? 'Loading…' : `${total.toLocaleString()} total`}
          </span>
        </div>
        <Input
          type="search"
          value={rawSearch}
          onChange={(e) => {
            void setRawSearch(e.target.value || null, { history: 'replace' })
            if (page !== 1) {
              void setPage(1, { history: 'replace' })
            }
          }}
          placeholder="Filter by name or email…"
          autoComplete="off"
          spellCheck={false}
          className="max-w-xs"
        />
      </div>

      <DataTable
        tableId="all-customers"
        columns={columns}
        data={rows}
        meta={meta}
        entityName="customer"
        onRowClick={row => handleViewProfile(row.id)}
        serverPagination={{
          pageIndex: Math.max(page, 1) - 1,
          pageSize: PAGE_SIZE,
          rowCount: total,
          onPageChange: nextIndex => setPage(nextIndex + 1, { history: 'push' }),
          isFetching,
        }}
      />
    </section>
  )
}
