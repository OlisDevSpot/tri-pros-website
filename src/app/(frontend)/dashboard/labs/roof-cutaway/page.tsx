import { RoofCutawayView } from '@/features/meeting-visualizations/ui/views/roof-cutaway-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function RoofCutawayLabPage() {
  await protectDashboardPage()
  return <RoofCutawayView />
}
