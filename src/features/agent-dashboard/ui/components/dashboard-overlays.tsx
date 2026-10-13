'use client'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { OmniSearchDialog } from '@/features/omni-search/ui/components/omni-search-dialog'

export function DashboardOverlays() {
  const actionCenterOpen = useDashboardOverlays(state => state.actionCenterOpen)
  const setActionCenterOpen = useDashboardOverlays(state => state.setActionCenterOpen)

  return (
    <>
      <ActionCenterSheet isOpen={actionCenterOpen} onClose={() => setActionCenterOpen(false)} />
      <OmniSearchDialog />
    </>
  )
}
