import type { SidebarNavConfig, SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'

import { ROOTS } from '@/shared/config/roots'

export interface MobileDockTab {
  item: SidebarNavItem
  /** Shorter than the sidebar label where the dock is tight. */
  label: string
}

// The four places an agent in the field opens most; everything else is one tap away in the menu.
// A tab the user may not open is left out rather than greyed, so a dispatcher gets a shorter dock.
export function getMobileDockTabs(nav: SidebarNavConfig): MobileDockTab[] {
  const byHref = new Map<string, SidebarNavItem>(
    [nav.dashboardItem, ...nav.mainItems, ...nav.recordsItems].map(item => [item.href, item]),
  )
  const picks: [href: string, label?: string][] = [
    [ROOTS.dashboard.root, 'Home'],
    [ROOTS.dashboard.pipeline()],
    [ROOTS.dashboard.schedule()],
    [ROOTS.dashboard.meetings.root()],
  ]
  return picks.flatMap(([href, label]) => {
    const item = byHref.get(href)
    return item?.enabled ? [{ item, label: label ?? item.label }] : []
  })
}
