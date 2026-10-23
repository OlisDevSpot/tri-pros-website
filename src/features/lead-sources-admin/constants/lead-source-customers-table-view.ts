import type { EntityTableView } from '@/shared/components/data-view/table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** The "Customers from this source" pane. The pane pins its source when it calls the hook, so there is no Source column: it would repeat one value. */
export const LEAD_SOURCE_CUSTOMERS_TABLE_VIEW = {
  tableId: 'lead-source-customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'src',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
