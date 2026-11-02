import type { ReactNode } from 'react'

import { redirect } from 'next/navigation'

import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

// Labs are the owner's test ground, so only super-admins reach them, as with lead sources.
export default async function LabsLayout({ children }: { children: ReactNode }) {
  const authState = await protectDashboardPage()
  if (authState.status === 'authenticated' && authState.actor.ability.cannot('manage', 'all')) {
    redirect(ROOTS.dashboard.root)
  }
  return children
}
