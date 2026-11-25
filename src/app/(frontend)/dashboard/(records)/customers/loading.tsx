import { CustomersRecordsView } from '@/features/records-management/ui/views/customers-records-view'
import { DataViewPending } from '@/shared/components/data-view/core/ui/pending'

export default function CustomersLoading() {
  return (
    <DataViewPending>
      <CustomersRecordsView />
    </DataViewPending>
  )
}
