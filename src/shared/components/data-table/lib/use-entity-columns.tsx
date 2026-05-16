'use client'

import type { CellContext, Column, ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import type { AppAction, AppSubject } from '@/shared/domains/permissions/types'

import { useMemo } from 'react'

import { DateCell } from '@/shared/components/data-table/ui/date-cell'
import { SortableHeader } from '@/shared/components/data-table/ui/sortable-header'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { formatAsDollars } from '@/shared/lib/formatters'

export type ColumnFormat = 'date' | 'currency' | 'number' | 'text'

export interface ColumnSpec<TData> {
  /** Header label and column-toggle display name. */
  label: string
  /** Default column width. */
  size?: number
  /** Show sortable affordance in header. */
  sortable?: boolean
  /** Optional icon shown next to the label in a sortable header. */
  headerIcon?: LucideIcon
  /**
   * Built-in formatter applied when `cell` is not provided. Currency/number
   * expect `value: number`; date expects `value: string` (ISO).
   */
  format?: ColumnFormat
  /**
   * Custom cell renderer. Overrides `format`. The value passed in
   * `getValue()` matches `accessorFn` if set, otherwise the field at the
   * registry key.
   */
  cell?: (ctx: CellContext<TData, unknown>) => ReactNode
  /**
   * Custom value extractor. Required for computed columns (e.g. `price`
   * derived from a JSON blob) and useful for sorting on values that
   * differ from the displayed text.
   */
  accessorFn?: (row: TData) => unknown
  /**
   * CASL gate. Column is omitted entirely (header + cells) when the
   * current user lacks this permission. Excluded columns also disappear
   * from the column-toggle UI.
   */
  permission?: [AppAction, AppSubject]
}

export type ColumnRegistry<TData> = Record<string, ColumnSpec<TData>>

type RegistryRow<R> = R extends ColumnRegistry<infer T> ? T : never

interface UseEntityColumnsOptions<R extends ColumnRegistry<any>> {
  /** Ordered subset of registry keys to display. */
  show: readonly (keyof R & string)[]
  /** Per-field overrides applied on top of the registry entry. */
  overrides?: Partial<{ [K in keyof R]: Partial<ColumnSpec<RegistryRow<R>>> }>
}

/**
 * Build TanStack column definitions from an entity's column registry.
 *
 * The registry defines every displayable field for the entity once
 * (label, default size, sortable, formatter, permission). Each table
 * picks an ordered subset via `show` and customises individual columns
 * via `overrides`. CASL permission gates filter unauthorised columns
 * entirely — they don't render and are excluded from the toggle UI.
 *
 * Pair with `useColumnVisibility(tableId, columns)` for user-toggle
 * persistence. The hook depends on `useAbility()` so it must be called
 * inside a client component.
 */
export function useEntityColumns<R extends ColumnRegistry<any>>(
  registry: R,
  options: UseEntityColumnsOptions<R>,
): ColumnDef<RegistryRow<R>>[] {
  const ability = useAbility()
  const { show, overrides } = options

  return useMemo(() => {
    const columns: ColumnDef<RegistryRow<R>>[] = []

    for (const key of show) {
      const base = registry[key]
      if (!base) {
        continue
      }

      const config: ColumnSpec<RegistryRow<R>> = { ...base, ...(overrides?.[key] ?? {}) }

      if (config.permission && !ability.can(config.permission[0], config.permission[1])) {
        continue
      }

      // Build the ColumnDef as a plain object — TanStack's ColumnDef union
      // narrows on `id` and forbids `accessorKey`/`accessorFn`, which makes
      // incremental property-assignment unergonomic. The shape is sound; the
      // cast at push is the simpler path.
      const col: Record<string, unknown> = {
        id: key,
        meta: { displayName: config.label },
        header: config.sortable
          ? ({ column }: { column: Column<RegistryRow<R>, unknown> }) => <SortableHeader column={column} label={config.label} icon={config.headerIcon} />
          : config.label,
      }

      if (config.accessorFn) {
        col.accessorFn = config.accessorFn
      }
      else {
        col.accessorKey = key
      }

      if (config.size != null) {
        col.size = config.size
      }

      if (config.cell) {
        col.cell = config.cell
      }
      else if (config.format === 'date') {
        col.cell = ({ getValue }: CellContext<RegistryRow<R>, unknown>) => {
          const v = getValue()
          return <DateCell dateString={typeof v === 'string' ? v : null} />
        }
        col.sortingFn = 'datetime'
      }
      else if (config.format === 'currency') {
        col.cell = ({ getValue }: CellContext<RegistryRow<R>, unknown>) => {
          const v = getValue()
          if (typeof v !== 'number' || v <= 0) {
            return <span className="text-muted-foreground">—</span>
          }
          return <span className="block text-right font-medium tabular-nums pr-3">{formatAsDollars(v)}</span>
        }
      }
      else if (config.format === 'number') {
        col.cell = ({ getValue }: CellContext<RegistryRow<R>, unknown>) => {
          const v = getValue()
          return typeof v === 'number'
            ? <span className="tabular-nums">{v.toLocaleString()}</span>
            : <span className="text-muted-foreground">—</span>
        }
      }

      columns.push(col as unknown as ColumnDef<RegistryRow<R>>)
    }

    return columns
  }, [ability, show, overrides, registry])
}
