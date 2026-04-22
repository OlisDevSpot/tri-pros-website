'use client'

import type { ColumnDef } from '@tanstack/react-table'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { DateTimePicker } from '@/shared/components/date-time-picker'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { CustomerPipelineBadge } from '@/shared/entities/customers/components/customer-pipeline-badge'
import { formatDateCell } from '@/shared/lib/formatters'

// ── Row shapes ──────────────────────────────────────────────────────────────

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

// ── Meta ────────────────────────────────────────────────────────────────────

export interface CustomerTableMeta<T extends CustomerTableRowBase> {
  customerActions: (row: T) => EntityActionConfig<T>[]
  onUpdateCreatedAt: (customerId: string, date: Date) => void
  /** When true, the createdAt cell's DateTimePicker is read-only. */
  readOnlyCreatedAt?: boolean
}

// ── Columns ─────────────────────────────────────────────────────────────────

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
      header: 'Customer',
      size: 260,
      cell: ({ row }) => (
        <div className="min-w-0 space-y-0.5 p-2">
          <p className="truncate text-sm font-medium leading-tight text-foreground">
            {row.original.name}
          </p>
          {row.original.email && (
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          )}
        </div>
      ),
    },
  ]

  if (options.includeSource) {
    columns.push({
      id: 'source',
      header: 'Source',
      size: 160,
      accessorFn: (row) => {
        const r = row as unknown as CustomerTableRowWithSource
        return r.leadSourceName ?? 'Unknown'
      },
      cell: ({ row }) => {
        const r = row.original as unknown as CustomerTableRowWithSource
        return (
          <div className="flex min-w-0 flex-col p-2 leading-tight">
            <span className="truncate text-sm text-foreground">
              {r.leadSourceName ?? 'Unknown'}
            </span>
            {r.leadSourceSlug && (
              <span className="truncate text-xs text-muted-foreground tabular-nums" translate="no">
                /
                {r.leadSourceSlug}
              </span>
            )}
          </div>
        )
      },
    })
  }

  columns.push({
    accessorKey: 'pipeline',
    header: 'Pipeline',
    size: 120,
    cell: ({ row }) => (
      <div className="p-2">
        <CustomerPipelineBadge pipeline={row.original.pipeline} />
      </div>
    ),
  })

  columns.push({
    accessorKey: 'createdAt',
    header: 'Created',
    size: 180,
    cell: ({ row, table }) => {
      const { relative, dayAtTime } = formatDateCell(row.original.createdAt)
      const meta = table.options.meta as CustomerTableMeta<T> | undefined

      // Stop propagation so the DateTimePicker popover doesn't trigger
      // the row-click modal.
      return (
        <div
          className="p-2"
          onClick={e => e.stopPropagation()}
        >
          {meta?.readOnlyCreatedAt || !meta?.onUpdateCreatedAt
            ? (
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium text-foreground">{relative}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{dayAtTime}</span>
                </div>
              )
            : (
                <DateTimePicker
                  value={new Date(row.original.createdAt)}
                  onChange={(date) => {
                    if (date) {
                      meta.onUpdateCreatedAt(row.original.id, date)
                    }
                  }}
                >
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium text-foreground">{relative}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{dayAtTime}</span>
                  </div>
                </DateTimePicker>
              )}
        </div>
      )
    },
  })

  columns.push({
    id: 'actions',
    header: '',
    size: 56,
    enableResizing: false,
    cell: ({ row, table }) => {
      const meta = table.options.meta as CustomerTableMeta<T> | undefined
      if (!meta) {
        return null
      }
      return (
        <div
          className="flex items-center justify-end p-2"
          onClick={e => e.stopPropagation()}
        >
          <EntityActionMenu
            entity={row.original}
            actions={meta.customerActions(row.original)}
            mode="compact"
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          />
        </div>
      )
    },
  })

  return columns
}
