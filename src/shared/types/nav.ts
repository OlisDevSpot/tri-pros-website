import type { useTRPC } from '@/trpc/helpers'

export interface NavItem {
  name: string
  href: string
  icon?: any
  badge?: string
  action?: 'readonly' | 'navigate'
  subItems?: NavItem[]
  enablePrefetch?: boolean
  prefetchFn?: (trpc: ReturnType<typeof useTRPC>) => void
}

export interface NavItemsGroup {
  sectionName: 'Marketing Links' | 'TPR Internal' | 'Action Buttons'
  items: NavItem[]
}

export type DynamicNavSections = 'marketing-links' | 'action-buttons' | 'tpr-internal'
