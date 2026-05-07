import { PastMeetingsTable } from '@/features/meeting-flow/ui/components/table'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function MeetingsPage() {
  await protectDashboardPage()
  return (
    <RecordsPageMotionShell>
      <PastMeetingsTable />
    </RecordsPageMotionShell>
  )
}
