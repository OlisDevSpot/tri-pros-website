import type { NavItem } from '@/shared/types/nav'

import { ROOTS } from '@/shared/config/roots'

export const tprInternalNavItems = [
  {
    name: 'Dashboard',
    href: ROOTS.dashboard.root,
    action: 'navigate',
  },
] as const satisfies NavItem[]
