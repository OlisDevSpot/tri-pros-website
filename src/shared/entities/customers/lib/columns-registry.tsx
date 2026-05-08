'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { CustomerPipelineBadge } from '@/shared/entities/customers/components/customer-pipeline-badge'
import { formatDateCell } from '@/shared/lib/formatters'

/**
 * Shape every customer row passed to a customers table must satisfy. This
 * is the union of fields any customer-list procedure returns — the joined
 * source fields are optional because not all consumers join them
 * (`customersRouter.list` does, `leadSourcesRouter.getCustomers` doesn't).
 */
export interface CustomerTableRow {
  id: string
  name: string
  email: string | null
  createdAt: string
  pipeline: 'active' | 'rehash' | 'dead' | null
  leadSourceId?: string | null
  leadSourceName?: string | null
  leadSourceSlug?: string | null
}

export interface CustomerTableMeta {
  customerActions?: (row: CustomerTableRow) => EntityActionConfig<CustomerTableRow>[]
  onUpdateCreatedAt?: (customerId: string, date: Date) => void
}

export const CUSTOMER_COLUMNS = {
  name: {
    label: 'Customer',
    size: 260,
    sortable: true,
    cell: ({ row, table }) => {
      const meta = table.options.meta as CustomerTableMeta | undefined
      return (
        <PrimaryCell
          entity={row.original}
          actions={meta?.customerActions?.(row.original)}
          title={row.original.name}
          subtitle={row.original.email ?? undefined}
        />
      )
    },
  },
  email: {
    label: 'Email',
    size: 220,
    sortable: true,
  },
  pipeline: {
    label: 'Pipeline',
    size: 120,
    sortable: true,
    cell: ({ row }) => <CustomerPipelineBadge pipeline={row.original.pipeline} />,
  },
  leadSourceName: {
    label: 'Source',
    size: 160,
    sortable: true,
    cell: ({ row }) => (
      <PrimaryCell
        title={row.original.leadSourceName ?? 'Unknown'}
        subtitle={row.original.leadSourceSlug
          ? (
              <p className="truncate text-xs text-muted-foreground tabular-nums" translate="no">
                /
                {row.original.leadSourceSlug}
              </p>
            )
          : undefined}
      />
    ),
  },
  leadSourceSlug: {
    label: 'Source slug',
    size: 140,
  },
  createdAt: {
    label: 'Created',
    size: 180,
    sortable: true,
    cell: ({ row, table }) => {
      const { relative, dayAtTime } = formatDateCell(row.original.createdAt)
      const meta = table.options.meta as CustomerTableMeta | undefined
      const stack = (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground">{relative}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{dayAtTime}</span>
        </div>
      )
      if (!meta?.onUpdateCreatedAt) {
        return stack
      }
      const onUpdate = meta.onUpdateCreatedAt
      return (
        <div onClick={e => e.stopPropagation()}>
          <DateTimePicker
            value={new Date(row.original.createdAt)}
            onChange={(date) => {
              if (date) {
                onUpdate(row.original.id, date)
              }
            }}
          >
            {stack}
          </DateTimePicker>
        </div>
      )
    },
  },
} as const satisfies ColumnRegistry<CustomerTableRow>
