import { redirect } from 'next/navigation'

import { LeadSourcesView } from '@/features/lead-sources-admin/ui/views/lead-sources-view'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function LeadSourcesPage() {
  const authState = await protectDashboardPage()

  // Super-admin only. Agents cannot see this page.
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }

  return <LeadSourcesView />
}
