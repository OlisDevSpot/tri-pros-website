'use client'

import { useState } from 'react'

import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { MobileDock } from '@/features/agent-dashboard/ui/components/mobile-dock'

export function DashboardMobileNav() {
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)

  return (
    <>
      <MobileDock onActionCenterClick={() => setIsActionCenterOpen(true)} />
      <ActionCenterSheet isOpen={isActionCenterOpen} onClose={() => setIsActionCenterOpen(false)} />
    </>
  )
}
