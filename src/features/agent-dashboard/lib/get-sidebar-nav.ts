import type { LucideIcon } from 'lucide-react'

import type { AppAbility } from '@/shared/permissions/types'

import {
  BarChart3Icon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
  GitBranchIcon,
  ImageIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

import { ROOTS } from '@/shared/config/roots'

export interface SidebarNavSubItem {
  key: string
  label: string
  href: string
}

export interface SidebarNavItem {
  href: string
  icon: LucideIcon
  label: string
  enabled: boolean
  children?: readonly SidebarNavSubItem[]
}

export interface SidebarNavConfig {
  baseItems: readonly SidebarNavItem[]
  adminItems: readonly SidebarNavItem[]
  footerItems: readonly SidebarNavItem[]
}

export function getSidebarNav(ability: AppAbility): SidebarNavConfig {
  const baseItems: SidebarNavItem[] = [
    {
      href: ROOTS.dashboard.pipeline(),
      icon: GitBranchIcon,
      label: 'Pipeline',
      enabled: ability.can('read', 'Customer'),
      children: [
        { key: 'fresh', label: 'Fresh', href: ROOTS.dashboard.pipeline('fresh') },
        { key: 'projects', label: 'Projects', href: ROOTS.dashboard.pipeline('projects') },
        { key: 'rehash', label: 'Rehash', href: ROOTS.dashboard.pipeline('rehash') },
        { key: 'dead', label: 'Dead', href: ROOTS.dashboard.pipeline('dead') },
      ],
    },
    { href: ROOTS.dashboard.meetings.root(), icon: CalendarIcon, label: 'Meetings', enabled: ability.can('read', 'Meeting') },
    { href: ROOTS.dashboard.proposals.root(), icon: FileTextIcon, label: 'Proposals', enabled: ability.can('read', 'Proposal') },
    { href: ROOTS.dashboard.showroom.root(), icon: ImageIcon, label: 'Projects', enabled: ability.can('read', 'Project') },
  ]

  const adminItems: SidebarNavItem[] = ability.can('manage', 'all')
    ? [
        { href: ROOTS.dashboard.intake(), icon: ClipboardListIcon, label: 'Intake Form', enabled: true },
        { href: ROOTS.dashboard.team(), icon: UsersIcon, label: 'Team', enabled: false },
        { href: ROOTS.dashboard.analytics(), icon: BarChart3Icon, label: 'Analytics', enabled: false },
      ]
    : []

  const footerItems: SidebarNavItem[] = [
    { href: ROOTS.dashboard.settings(), icon: SettingsIcon, label: 'Settings', enabled: true },
  ]

  return { baseItems, adminItems, footerItems }
}
