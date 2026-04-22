'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { CustomerPipelineBadge } from '@/shared/entities/customers/components/customer-pipeline-badge'
import { formatDateCell } from '@/shared/lib/formatters'
import { useTRPC } from '@/trpc/helpers'

type CustomerRow = AppRouterOutputs['leadSourcesRouter']['getCustomers'][number]

interface LeadSourceCustomersSectionProps {
  leadSourceId: string
}

/**
 * Customers from a lead source. Intentionally a thin, local table (not the
 * heavyweight customers-pipelines DataTable) — we want this section to feel
 * lightweight and scan-readable inside the detail pane. When the Records
 * migration (#110) lands, the shared CustomersTable primitive will replace
 * this inline renderer.
 */
export function LeadSourceCustomersSection({ leadSourceId }: LeadSourceCustomersSectionProps) {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery(
    trpc.leadSourcesRouter.getCustomers.queryOptions({
      id: leadSourceId,
      search: search.trim() || undefined,
      limit: 100,
    }),
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

  const total = data?.length ?? 0

  const header = useMemo(() => (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Customers from this source
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {isLoading ? 'Loading…' : `${total} shown`}
        </span>
      </div>
      <Input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter by name or email…"
        autoComplete="off"
        spellCheck={false}
        className="max-w-xs"
      />
    </div>
  ), [isLoading, total, search])

  return (
    <section aria-label="Customers from this lead source" className="flex flex-col gap-3">
      {header}
      {isLoading
        ? <Skeleton className="h-56 w-full" />
        : total === 0
          ? (
              <EmptyState search={search} />
            )
          : (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Pipeline</th>
                      <th className="px-3 py-2 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data?.map(c => (
                      <CustomerTableRow
                        key={c.id}
                        customer={c}
                        onUpdateCreatedAt={(date) => {
                          updateCreatedAt.mutate({ customerId: c.id, createdAt: date.toISOString() })
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </section>
  )
}

interface CustomerTableRowProps {
  customer: CustomerRow
  onUpdateCreatedAt: (date: Date) => void
}

function CustomerTableRow({ customer, onUpdateCreatedAt }: CustomerTableRowProps) {
  const { relative, dayAtTime } = formatDateCell(customer.createdAt)
  return (
    <tr className="hover:bg-muted/40 motion-safe:transition-colors">
      <td className="px-3 py-2.5 font-medium text-foreground">{customer.name}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{customer.email ?? '—'}</td>
      <td className="px-3 py-2.5">
        <CustomerPipelineBadge pipeline={customer.pipeline} />
      </td>
      <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
        <DateTimePicker
          value={new Date(customer.createdAt)}
          onChange={(date) => {
            if (date) {
              onUpdateCreatedAt(date)
            }
          }}
          className="ml-auto"
        >
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium leading-tight">{relative}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{dayAtTime}</span>
          </div>
        </DateTimePicker>
      </td>
    </tr>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
      {search
        ? (
            <>
              No customers match
              {' '}
              <span className="font-medium text-foreground">{`“${search}”`}</span>
              .
            </>
          )
        : 'No customers from this lead source yet. New leads will appear here once they come in through the intake URL above.'}
    </div>
  )
}
