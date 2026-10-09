'use client'

import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'
import { useAbility } from '@/shared/domains/permissions/client'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function DashboardHomePendingView() {
  const ability = useAbility()
  return <DashboardView name={null} showsProjects={ability.can('read', 'Project')} showsProposals={ability.can('read', 'Proposal')} />
}
