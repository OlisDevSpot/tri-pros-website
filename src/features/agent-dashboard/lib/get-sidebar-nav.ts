import type { LucideIcon } from 'lucide-react'

import type { DashboardStep } from '@/features/agent-dashboard/types'
import type { UserRole } from '@/shared/types/enums'

import {
  BarChart3Icon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
  GitBranchIcon,
  ImageIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

export interface SidebarNavItem {
  step: DashboardStep
  icon: LucideIcon
  label: string
  enabled: boolean
}

export interface SidebarNavConfig {
  baseItems: readonly SidebarNavItem[]
  adminItems: readonly SidebarNavItem[]
  footerItems: readonly SidebarNavItem[]
}

export function getSidebarNav(userRole: UserRole): SidebarNavConfig {
  const baseItems: SidebarNavItem[] = [
    { step: 'dashboard', icon: LayoutDashboardIcon, label: 'Dashboard', enabled: false },
    { step: 'customer-pipelines', icon: GitBranchIcon, label: 'Pipelines', enabled: true },
    { step: 'meetings', icon: CalendarIcon, label: 'Meetings', enabled: true },
    { step: 'proposals', icon: FileTextIcon, label: 'Proposals', enabled: true },
    { step: 'showroom', icon: ImageIcon, label: 'Showroom', enabled: true },
  ]

  const adminItems: SidebarNavItem[] = userRole === 'super-admin'
    ? [
        { step: 'intake', icon: ClipboardListIcon, label: 'Intake Form', enabled: false },
        { step: 'team', icon: UsersIcon, label: 'Team', enabled: false },
        { step: 'analytics', icon: BarChart3Icon, label: 'Analytics', enabled: false },
      ]
    : []

  const footerItems: SidebarNavItem[] = [
    { step: 'settings', icon: SettingsIcon, label: 'Settings', enabled: true },
  ]

  return { baseItems, adminItems, footerItems }
}
