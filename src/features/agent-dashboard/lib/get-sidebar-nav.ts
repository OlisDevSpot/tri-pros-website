import type { LucideIcon } from 'lucide-react'

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

import { ROOTS } from '@/shared/config/roots'

export interface SidebarNavItem {
  href: string
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
    { href: ROOTS.dashboard.root, icon: LayoutDashboardIcon, label: 'Dashboard', enabled: false },
    { href: ROOTS.dashboard.pipelines(), icon: GitBranchIcon, label: 'Pipelines', enabled: ability.can('read', 'Customer') },
    { href: ROOTS.dashboard.meetings.root(), icon: CalendarIcon, label: 'Meetings', enabled: ability.can('read', 'Meeting') },
    { href: ROOTS.dashboard.proposals.root(), icon: FileTextIcon, label: 'Proposals', enabled: ability.can('read', 'Proposal') },
    { href: ROOTS.dashboard.showroom.root(), icon: ImageIcon, label: 'Showroom', enabled: ability.can('read', 'Project') },
  ]

  const adminItems: SidebarNavItem[] = ability.can('manage', 'all')
    ? [
        { href: ROOTS.dashboard.intake(), icon: ClipboardListIcon, label: 'Intake Form', enabled: false },
        { href: ROOTS.dashboard.team(), icon: UsersIcon, label: 'Team', enabled: false },
        { href: ROOTS.dashboard.analytics(), icon: BarChart3Icon, label: 'Analytics', enabled: false },
      ]
    : []

  const footerItems: SidebarNavItem[] = [
    { href: ROOTS.dashboard.settings(), icon: SettingsIcon, label: 'Settings', enabled: true },
  ]

  return { baseItems, adminItems, footerItems }
}
