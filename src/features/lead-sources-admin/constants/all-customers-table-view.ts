import type { EntityTableView } from '@/shared/components/data-view/table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

export const ALL_CUSTOMERS_TABLE_VIEW = {
  tableId: 'all-customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'all',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'leadSourceName', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
