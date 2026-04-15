import { MeetingsView } from '@/features/meeting-flow/ui/views'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function MeetingsPage() {
  await protectDashboardPage()
  return <MeetingsView />
}
