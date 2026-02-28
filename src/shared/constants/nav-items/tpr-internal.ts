import type { NavItem } from '@/shared/types/nav'

export const tprInternalNavItems = [
  {
    name: 'Flows',
    href: '/proposal-flow',
    action: 'readonly',
    subItems: [
      {
        name: 'Showroom',
        href: '/showroom',
      },
      {
        name: 'Proposals',
        href: '/proposal-flow',
      },
    ],
  },
] as const satisfies NavItem[]
