import { ProposalsRecordsView } from '@/features/records-management/ui/views/proposals-records-view'
import { DataViewPending } from '@/shared/components/data-view/ui/pending'

export default function ProposalsLoading() {
  return (
    <DataViewPending>
      <ProposalsRecordsView />
    </DataViewPending>
  )
}
