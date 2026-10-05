'use client'

import type { UserRole } from '@/shared/constants/enums'

import { useState } from 'react'

import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { MobileDock } from '@/features/agent-dashboard/ui/components/mobile-dock'

export function DashboardMobileNav({ user }: { user: { id: string, role: UserRole } }) {
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)

  return (
    <>
      <MobileDock user={user} onActionCenterClick={() => setIsActionCenterOpen(true)} />
      <ActionCenterSheet isOpen={isActionCenterOpen} onClose={() => setIsActionCenterOpen(false)} />
    </>
  )
}
