'use client'

import { CustomersRecordsTable } from '@/features/records-management/ui/components/customers-records-table'
import { DataViewBoundary } from '@/shared/components/data-view/core/ui/boundary'
import { RecordsPageFrame } from '@/shared/components/data-view/core/ui/records-page-frame'

export function CustomersRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <CustomersRecordsTable />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
