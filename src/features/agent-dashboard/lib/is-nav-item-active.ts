import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'

import { ROOTS } from '@/shared/config/roots'

// The dashboard root is a prefix of every route, so it only matches itself; the pipeline item
// owns every `/dashboard/pipeline/*` board, whichever pipeline is open.
export function isNavItemActive(item: Pick<SidebarNavItem, 'href' | 'children'>, pathname: string): boolean {
  if (item.href === ROOTS.dashboard.root) {
    return pathname === item.href
  }
  if (item.children) {
    return pathname.startsWith('/dashboard/pipeline')
  }
  return pathname.startsWith(item.href)
}
