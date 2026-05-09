'use client'

import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { PrimaryCell } from '@/shared/components/data-table/ui/primary-cell'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { CustomerPipelineBadge } from '@/shared/entities/customers/components/customer-pipeline-badge'
import { LeadSourcePicker } from '@/shared/entities/customers/components/lead-source-picker'
import { useUpdateLeadSourceMutation } from '@/shared/entities/customers/hooks/use-update-lead-source-mutation'
import { formatDateCell } from '@/shared/lib/formatters'

/**
 * Shape every customer row passed to a customers table must satisfy. This
 * is the union of fields any customer-list procedure returns — the joined
 * source fields are optional because not all consumers join them, but
 * `pipeline` is always the derived 5-bucket classification (the underlying
 * 3-bucket DB column is exploded server-side via `derivedPipelineSql`).
 */
export interface CustomerTableRow {
  id: string
  name: string
  email: string | null
  createdAt: string
  pipeline: Pipeline | null
  leadSourceId?: string | null
  leadSourceName?: string | null
  leadSourceSlug?: string | null
}

export interface CustomerTableMeta {
  customerActions?: (row: CustomerTableRow) => EntityActionConfig<CustomerTableRow>[]
  onUpdateCreatedAt?: (customerId: string, date: Date) => void
  /**
   * Optional override for lead-source reassignment. The cell defaults to
   * the shared mutation (toast + customer/lead-source invalidation) when
   * absent, so every consumer gets edit-for-permitted-users automatically;
   * pass this only to customize behavior (e.g. optimistic updates, custom
   * invalidation, or to no-op).
   *
   * Visibility is gated solely by CASL `update Customer.leadSourceId` —
   * super-admins (`manage all`) pass, agents (field-restricted to JSONB
   * profile blobs) get the read-only label.
   */
  onUpdateLeadSource?: (customerId: string, leadSourceId: string) => void
}

interface LeadSourceCellProps {
  row: CustomerTableRow
  override?: (customerId: string, leadSourceId: string) => void
}

/**
 * Render the source label as a static cell for read-only viewers and a
 * glassy picker popover for anyone permitted to update
 * `customers.leadSourceId`. The cell owns its own mutation by default —
 * consumers do not need to wire one up unless they want to override.
 */
function LeadSourceCell({ row, override }: LeadSourceCellProps) {
  const ability = useAbility()
  const canEdit = ability.can('update', 'Customer', 'leadSourceId')
  const defaultMutation = useUpdateLeadSourceMutation()

  const label = (
    <PrimaryCell
      title={row.leadSourceName ?? 'Unknown'}
      subtitle={row.leadSourceSlug
        ? (
            <p className="truncate text-xs text-muted-foreground tabular-nums" translate="no">
              /
              {row.leadSourceSlug}
            </p>
          )
        : undefined}
    />
  )

  if (!canEdit) {
    return label
  }

  const handlePick = override
    ?? ((customerId: string, leadSourceId: string) =>
      defaultMutation.mutate({ customerId, leadSourceId }))

  return (
    <LeadSourcePicker
      currentLeadSourceId={row.leadSourceId ?? null}
      onPick={leadSourceId => handlePick(row.id, leadSourceId)}
    >
      {label}
    </LeadSourcePicker>
  )
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
    // Not sortable: the DB column stores the coarse 3-bucket value, but
    // the row receives the derived 5-bucket classification — sorting on
    // the underlying column would order rows by a value the user can't
    // see. Filter chip is the right affordance for slicing by pipeline.
    cell: ({ row }) => <CustomerPipelineBadge pipeline={row.original.pipeline} />,
  },
  leadSourceName: {
    label: 'Source',
    size: 160,
    sortable: true,
    cell: ({ row, table }) => {
      const meta = table.options.meta as CustomerTableMeta | undefined
      return (
        <LeadSourceCell row={row.original} override={meta?.onUpdateLeadSource} />
      )
    },
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
