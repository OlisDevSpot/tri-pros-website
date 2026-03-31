import type { LucideIcon } from 'lucide-react'

import type { DashboardStep } from '@/features/agent-dashboard/types'
import type { AppAbility } from '@/shared/permissions/types'

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

export function getSidebarNav(ability: AppAbility): SidebarNavConfig {
  const baseItems: SidebarNavItem[] = [
    { step: 'dashboard', icon: LayoutDashboardIcon, label: 'Dashboard', enabled: false },
    { step: 'customer-pipelines', icon: GitBranchIcon, label: 'Pipelines', enabled: ability.can('read', 'Customer') },
    { step: 'meetings', icon: CalendarIcon, label: 'Meetings', enabled: ability.can('read', 'Meeting') },
    { step: 'proposals', icon: FileTextIcon, label: 'Proposals', enabled: ability.can('read', 'Proposal') },
    { step: 'showroom', icon: ImageIcon, label: 'Showroom', enabled: ability.can('read', 'Project') },
  ]

  const adminItems: SidebarNavItem[] = ability.can('manage', 'all')
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
