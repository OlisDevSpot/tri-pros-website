import { TradeSceneView } from '@/features/trade-scenes/ui/views/trade-scene-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function TradeScenePage() {
  await protectDashboardPage()
  return <TradeSceneView />
}
