import { CalculatorsView } from '@/features/calculators/ui/views/calculators-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function CalculatorsPage() {
  await protectDashboardPage()
  return <CalculatorsView />
}
