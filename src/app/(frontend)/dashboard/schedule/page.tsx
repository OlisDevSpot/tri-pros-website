import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  await protectDashboardPage()
  return <ScheduleView />
}
