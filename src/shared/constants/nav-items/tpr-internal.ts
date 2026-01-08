import type { NavItem } from '@/shared/types/nav'

export const tprInternalNavItems = [
  {
    name: 'Flows',
    href: '/proposal-flow',
    action: 'readonly',
    subItems: [
      {
        name: 'Proposals',
        href: '/proposal-flow',
      },
    ],
  },
] as const satisfies NavItem[]
