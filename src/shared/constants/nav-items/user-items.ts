import type { NavItem } from '@/shared/types/nav'

export const userNavItems: NavItem[] = [
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
]
