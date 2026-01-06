import type { useTRPC } from '@/trpc/helpers'

export type NavType = 'public' | 'user' | 'admin'

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
  sectionName: string
  items: NavItem[]
}
