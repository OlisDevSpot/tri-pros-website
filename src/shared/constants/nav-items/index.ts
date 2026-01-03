import type { NavItemsGroup, NavType } from '@/shared/types/nav'
import { publicNavItems } from './public-items'
import { userNavItems } from './user-items'

export {
  publicNavItems,
  userNavItems,
}

export function generateNavItemsGroups({ navType }: { navType: NavType }): Partial<Record<NavType, NavItemsGroup>> {
  switch (navType) {
    case 'public':
      return {
        public: {
          sectionName: 'Public',
          items: publicNavItems,
        },
      }
    case 'user':
      return {
        public: {
          sectionName: 'Public',
          items: publicNavItems,
        },
        user: {
          sectionName: 'User',
          items: userNavItems,
        },
      }
    case 'admin':
      return {
        public: {
          sectionName: 'Public',
          items: publicNavItems,
        },
        user: {
          sectionName: 'User',
          items: userNavItems,
        },
      }
    default:
      return {
        public: {
          sectionName: 'Public',
          items: publicNavItems,
        },
      }
  }
}
