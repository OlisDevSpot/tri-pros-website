'use client'

import type { ColumnDef } from '@tanstack/react-table'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { CustomerPipelineBadge } from '@/shared/entities/customers/components/customer-pipeline-badge'
import { formatDateCell } from '@/shared/lib/formatters'

export interface CustomerTableRowBase {
  id: string
  name: string
  email: string | null
  createdAt: string
  pipeline: 'active' | 'rehash' | 'dead' | null
}

export interface CustomerTableRowWithSource extends CustomerTableRowBase {
  leadSourceName: string | null
  leadSourceSlug: string | null
}

export interface CustomerTableMeta<T extends CustomerTableRowBase> {
  customerActions: (row: T) => EntityActionConfig<T>[]
  onUpdateCreatedAt: (customerId: string, date: Date) => void
  /** When true, the createdAt cell's DateTimePicker is read-only. */
  readOnlyCreatedAt?: boolean
}

interface BuildColumnsOptions {
  includeSource?: boolean
}

export function buildCustomerColumns<T extends CustomerTableRowWithSource>(
  options: BuildColumnsOptions & { includeSource: true },
): ColumnDef<T>[]
export function buildCustomerColumns<T extends CustomerTableRowBase>(
  options?: BuildColumnsOptions & { includeSource?: false },
): ColumnDef<T>[]
export function buildCustomerColumns<T extends CustomerTableRowBase>(
  options: BuildColumnsOptions = {},
): ColumnDef<T>[] {
  const columns: ColumnDef<T>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column} label="Customer" />,
      size: 260,
      cell: ({ row, table }) => {
        const meta = table.options.meta as CustomerTableMeta<T> | undefined
        return (
          <PrimaryCell
            entity={row.original}
            actions={meta?.customerActions(row.original)}
            title={row.original.name}
            subtitle={row.original.email ?? undefined}
          />
        )
      },
    },
  ]

  if (options.includeSource) {
    columns.push({
      id: 'leadSourceName',
      header: ({ column }) => <SortableHeader column={column} label="Source" />,
      meta: { displayName: 'Source' },
      size: 160,
      accessorFn: (row) => {
        const r = row as unknown as CustomerTableRowWithSource
        return r.leadSourceName ?? 'Unknown'
      },
      cell: ({ row }) => {
        const r = row.original as unknown as CustomerTableRowWithSource
        return (
          <PrimaryCell
            title={r.leadSourceName ?? 'Unknown'}
            subtitle={r.leadSourceSlug
              ? (
                  <p className="truncate text-xs text-muted-foreground tabular-nums" translate="no">
                    /
                    {r.leadSourceSlug}
                  </p>
                )
              : undefined}
          />
        )
      },
    })
  }

  columns.push({
    accessorKey: 'pipeline',
    header: ({ column }) => <SortableHeader column={column} label="Pipeline" />,
    meta: { displayName: 'Pipeline' },
    size: 120,
    cell: ({ row }) => <CustomerPipelineBadge pipeline={row.original.pipeline} />,
  })

  columns.push({
    accessorKey: 'createdAt',
    header: ({ column }) => <SortableHeader column={column} label="Created" />,
    meta: { displayName: 'Created' },
    size: 180,
    cell: ({ row, table }) => {
      const { relative, dayAtTime } = formatDateCell(row.original.createdAt)
      const meta = table.options.meta as CustomerTableMeta<T> | undefined
      const stack = (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground">{relative}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{dayAtTime}</span>
        </div>
      )

      if (meta?.readOnlyCreatedAt || !meta?.onUpdateCreatedAt) {
        return stack
      }

      return (
        <div onClick={e => e.stopPropagation()}>
          <DateTimePicker
            value={new Date(row.original.createdAt)}
            onChange={(date) => {
              if (date) {
                meta.onUpdateCreatedAt(row.original.id, date)
              }
            }}
          >
            {stack}
          </DateTimePicker>
        </div>
      )
    },
  })

  return columns
}
