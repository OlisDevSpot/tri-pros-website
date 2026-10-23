'use client'

import { EntityRecordsTable } from '@/shared/components/data-view/table/ui/entity-records-table'
import { useCustomersTable } from '@/shared/modules/customers/core/components/customers-table/use-customers-table'
import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/shared/modules/customers/core/constants/customers-records-table-view'

export function CustomersRecordsTable() {
  const table = useCustomersTable(CUSTOMERS_RECORDS_TABLE_VIEW)
  return <EntityRecordsTable title="Customers" entityName="customers" searchPlaceholder="Search by name, email or phone…" table={table} />
}
