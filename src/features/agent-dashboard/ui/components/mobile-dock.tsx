'use client'

import { useMemo } from 'react'

import { MOBILE_DOCK_BOTTOM_CLASS } from '@/features/agent-dashboard/constants/mobile-dock'
import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { useIsTyping } from '@/features/agent-dashboard/hooks/use-is-typing'
import { getMobileDockTabs } from '@/features/agent-dashboard/lib/get-mobile-dock-tabs'
import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { MobileDockCapsule } from '@/features/agent-dashboard/ui/components/mobile-dock-capsule'
import { MobileDockMenuButton } from '@/features/agent-dashboard/ui/components/mobile-dock-menu-button'
import { useSidebar, useSidebarOpenMobile } from '@/shared/components/ui/sidebar'
import { useAbility } from '@/shared/domains/permissions/client'
import { cn } from '@/shared/lib/utils'

export function MobileDock() {
  const ability = useAbility()
  const tabs = useMemo(() => getMobileDockTabs(getSidebarNav(ability)), [ability])
  const isTyping = useIsTyping()
  const { setOpenMobile } = useSidebar()
  const setSearchOpen = useDashboardOverlays(state => state.setSearchOpen)
  const isMenuOpen = useSidebarOpenMobile()

  return (
    // z-40: over page content (a data table's sticky columns reach z-30) and over the menu sheet
    // (z-35), which rises from behind it; under dialogs (z-50). The box is the dock's whole clearance
    // zone, so the fade ends exactly where a contained page's content does.
    <div
      data-slot="dashboard-mobile-nav"
      data-hidden={isTyping || undefined}
      inert={isTyping}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 h-(--dock-clear) md:hidden',
        'transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none',
        'data-hidden:translate-y-[calc(100%+2rem)] data-hidden:opacity-0',
      )}
    >
      {/* Content scrolling behind the dock dissolves into the canvas instead of cutting against the capsule.
          Off while the menu sheet is up: canvas over the sheet's scrim would read as a light band. */}
      <div
        aria-hidden
        data-slot="dashboard-dock-fade"
        data-menu-open={isMenuOpen || undefined}
        className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_var(--dock-baseline),transparent)] transition-opacity duration-200 ease-out data-menu-open:opacity-0 motion-reduce:transition-none"
      />
      <div className={cn('pointer-events-auto absolute inset-x-3 flex items-center gap-2', MOBILE_DOCK_BOTTOM_CLASS)}>
        <MobileDockMenuButton />
        <MobileDockCapsule
          tabs={tabs}
          onSearchClick={() => {
            setOpenMobile(false)
            setSearchOpen(true)
          }}
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  )
}
