'use client'

import { ALL_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/all-customers-table-view'
import { DataView } from '@/shared/components/data-view/core/data-view'
import { QueryToolbar } from '@/shared/components/data-view/query-toolbar/ui/query-toolbar'
import { DataTable } from '@/shared/components/data-view/table/ui/data-table'
import { useCustomersTable } from '@/shared/modules/customers/core/components/customers-table/use-customers-table'

export function AllCustomersSection() {
  const { query, visibility, dataTableProps, dialogs } = useCustomersTable(ALL_CUSTOMERS_TABLE_VIEW)

  return (
    <DataView query={query} entityName="customers">
      {dialogs}
      <section aria-label="All customers" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <DataView.Title as="h3" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              All customers
            </DataView.Title>
            <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
          </div>
          <DataView.Toolbar>
            <QueryToolbar.Standard searchPlaceholder="Filter by name, email or phone…" visibility={visibility} />
          </DataView.Toolbar>
        </div>
        <DataView.Body empty>
          <DataTable {...dataTableProps} />
        </DataView.Body>
      </section>
    </DataView>
  )
}
