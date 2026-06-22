import { redirect } from 'next/navigation'

import { CampaignsView } from '@/features/campaigns-admin/ui/views/campaigns-view'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const authState = await protectDashboardPage()

  // Super-admin only. Agents cannot see this page.
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  return <CampaignsView />
}
