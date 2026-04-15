import type { AppAbility } from '@/shared/domains/permissions/types'
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
  ability: AppAbility
}

export function generateNavItemsGroups({ ability }: Options): Partial<Record<DynamicNavSections, NavItemsGroup>> {
  if (ability.can('access', 'Dashboard')) {
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
