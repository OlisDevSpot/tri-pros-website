import { redirect } from 'next/navigation'

import { CreateProjectView } from '@/features/project-management/ui/views'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { PROJECT_ACTIONS } from '@/shared/modules/projects/core/constants/actions'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  const authState = await protectDashboardPage()
  // A project made here has no meeting, so only whoever publishes can reach it afterwards.
  if (authState.status === 'authenticated' && authState.actor.ability.cannot(...PROJECT_ACTIONS.showOnPortfolio.permission)) {
    redirect(ROOTS.dashboard.projects.root())
  }
  return <CreateProjectView />
}
