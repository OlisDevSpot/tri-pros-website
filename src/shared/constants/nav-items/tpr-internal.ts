import type { NavItem } from '@/shared/types/nav'

import { ROOTS } from '@/shared/config/roots'

export const tprInternalNavItems = [
  {
    name: 'Flows',
    action: 'readonly',
    subItems: [
      {
        name: 'Dashboard',
        href: ROOTS.dashboard(),
        action: 'navigate',
      },
      {
        name: 'Showroom',
        href: '/showroom',
        action: 'navigate',
      },
    ],
  },
] as const satisfies NavItem[]
