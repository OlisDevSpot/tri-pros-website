import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { CustomersTable } from '@/shared/entities/customers/components/customers-table'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  await protectDashboardPage()
  return (
    <RecordsPageMotionShell>
      <CustomersTable />
    </RecordsPageMotionShell>
  )
}
