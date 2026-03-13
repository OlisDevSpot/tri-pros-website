import type { useTRPC } from '@/trpc/helpers'

export type NavItem = {
  name: string
  icon?: any
  badge?: string
  enablePrefetch?: boolean
  prefetchFn?: (trpc: ReturnType<typeof useTRPC>) => void
} & ({
  href: string
  action: 'navigate'
} | {
  action: 'readonly'
  subItems: NavItem[]
})

export interface NavItemsGroup {
  sectionName: 'Marketing Links' | 'TPR Internal' | 'Action Buttons'
  items: NavItem[]
}

export type DynamicNavSections = 'marketing-links' | 'action-buttons' | 'tpr-internal'
