import type { UserRole } from '@/shared/types/enums'
import type { DynamicNavSections, NavItemsGroup } from '@/shared/types/nav'
import { marketingNavItems } from './marketing'
import { tprInternalNavItems } from './tpr-internal'

export {
  marketingNavItems,
  tprInternalNavItems,
}

export const baseNavItems: Partial<Record<DynamicNavSections, NavItemsGroup>> = {
  'marketing-links': {
    sectionName: 'Marketing Links',
    items: marketingNavItems,
  },
  'action-buttons': {
    sectionName: 'Action Buttons',
    items: [],
  },
}

interface Options {
  userRole?: UserRole
}

export function generateNavItemsGroups({ userRole }: Options): Partial<Record<DynamicNavSections, NavItemsGroup>> {
  if (userRole === 'agent') {
    return {
      ...baseNavItems,
      'tpr-internal': {
        sectionName: 'TPR Internal',
        items: tprInternalNavItems,
      },
    }
  }

  return {
    ...baseNavItems,
  }
}
