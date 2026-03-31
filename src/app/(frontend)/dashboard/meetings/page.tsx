import { MeetingsView } from '@/features/meetings/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function MeetingsPage() {
  await protectDashboardPage()
  return <MeetingsView />
}
