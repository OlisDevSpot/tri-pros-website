'use client'

import { useState } from 'react'

import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { MobileBottomNav } from '@/features/agent-dashboard/ui/components/mobile-bottom-nav'

export function DashboardMobileNav() {
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)

  return (
    <>
      <MobileBottomNav onActionCenterClick={() => setIsActionCenterOpen(true)} />
      <ActionCenterSheet isOpen={isActionCenterOpen} onClose={() => setIsActionCenterOpen(false)} />
    </>
  )
}
