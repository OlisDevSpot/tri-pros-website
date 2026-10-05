'use client'

import { RecordsPageFrame } from '@/shared/components/records-page-frame'
import { CustomersTable } from '@/shared/entities/customers/components/customers-table'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function CustomersRoutePendingView() {
  return (
    <RecordsPageFrame>
      <CustomersTable />
    </RecordsPageFrame>
  )
}
