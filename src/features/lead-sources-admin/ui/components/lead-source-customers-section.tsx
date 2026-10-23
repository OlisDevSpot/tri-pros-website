'use client'

import { LEAD_SOURCE_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/lead-source-customers-table-view'
import { DataView } from '@/shared/components/data-view/core/data-view'
import { QueryToolbar } from '@/shared/components/data-view/query-toolbar/ui/query-toolbar'
import { DataTable } from '@/shared/components/data-view/table/ui/data-table'
import { useCustomersTable } from '@/shared/modules/customers/core/components/customers-table/use-customers-table'

interface LeadSourceCustomersSectionProps {
  leadSourceId: string
}

export function LeadSourceCustomersSection({ leadSourceId }: LeadSourceCustomersSectionProps) {
  const { query, visibility, dataTableProps, dialogs } = useCustomersTable(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW, {
    fixed: { leadSource: [leadSourceId] },
  })

  return (
    <DataView query={query} entityName="customers">
      {dialogs}
      <section aria-label="Customers from this lead source" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <DataView.Title as="h3" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customers from this source
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
