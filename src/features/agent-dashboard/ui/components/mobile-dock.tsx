'use client'

import type { UserRole } from '@/shared/constants/enums'

import { useMemo } from 'react'

import { MOBILE_DOCK_BOTTOM_CLASS } from '@/features/agent-dashboard/constants/mobile-dock'
import { useIsTyping } from '@/features/agent-dashboard/hooks/use-is-typing'
import { getMobileDockTabs } from '@/features/agent-dashboard/lib/get-mobile-dock-tabs'
import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { MobileDockCapsule } from '@/features/agent-dashboard/ui/components/mobile-dock-capsule'
import { MobileDockMenuButton } from '@/features/agent-dashboard/ui/components/mobile-dock-menu-button'
import { useSidebar } from '@/shared/components/ui/sidebar'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { cn } from '@/shared/lib/utils'

interface MobileDockProps {
  /** The session user the server already read, so the tabs are right in the first paint. */
  user: { id: string, role: UserRole }
  onActionCenterClick: () => void
}

export function MobileDock({ user, onActionCenterClick }: MobileDockProps) {
  const tabs = useMemo(
    () => getMobileDockTabs(getSidebarNav(defineAbilitiesFor({ id: user.id, role: user.role }))),
    [user.id, user.role],
  )
  const isTyping = useIsTyping()
  const { setOpenMobile } = useSidebar()

  return (
    // z-40: over page content (a data table's sticky columns reach z-30) and over the menu sheet
    // (z-35), which rises from behind it; under dialogs (z-50).
    <div
      data-slot="dashboard-mobile-nav"
      data-hidden={isTyping || undefined}
      inert={isTyping}
      className={cn(
        'fixed inset-x-3 z-40 flex items-center gap-2 md:hidden',
        MOBILE_DOCK_BOTTOM_CLASS,
        'transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none',
        'data-hidden:pointer-events-none data-hidden:translate-y-[calc(100%+2rem)] data-hidden:opacity-0',
      )}
    >
      <MobileDockMenuButton />
      <MobileDockCapsule
        tabs={tabs}
        onActionCenterClick={() => {
          setOpenMobile(false)
          onActionCenterClick()
        }}
        className="min-w-0 flex-1"
      />
    </div>
  )
}
