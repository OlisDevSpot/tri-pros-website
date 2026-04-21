import type { LucideIcon } from 'lucide-react'

import type { AppAbility } from '@/shared/domains/permissions/types'

import {
  BarChart3Icon,
  CalendarIcon,
  FileTextIcon,
  GitBranchIcon,
  HandshakeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  RadioTowerIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react'

import { ROOTS } from '@/shared/config/roots'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'
import { getAccessiblePipelines } from '@/shared/domains/pipelines/lib/get-accessible-pipelines'

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
  dashboardItem: SidebarNavItem
  mainItems: readonly SidebarNavItem[]
  recordsItems: readonly SidebarNavItem[]
  adminItems: readonly SidebarNavItem[]
  footerItems: readonly SidebarNavItem[]
}

export function getSidebarNav(ability: AppAbility): SidebarNavConfig {
  const dashboardItem: SidebarNavItem = {
    href: ROOTS.dashboard.root,
    icon: LayoutDashboardIcon,
    label: 'Dashboard',
    enabled: true,
  }

  const mainItems: SidebarNavItem[] = [
    {
      href: ROOTS.dashboard.pipeline(),
      icon: GitBranchIcon,
      label: 'Pipeline',
      enabled: ability.can('read', 'Customer'),
      children: getAccessiblePipelines(ability).map(key => ({
        key,
        label: PIPELINE_LABELS[key],
        href: ROOTS.dashboard.pipeline(key),
      })),
    },
    {
      href: ROOTS.dashboard.schedule(),
      icon: CalendarIcon,
      label: 'Schedule',
      enabled: ability.can('read', 'Meeting'),
    },
  ]

  const recordsItems: SidebarNavItem[] = [
    {
      href: ROOTS.dashboard.customers.root(),
      icon: UsersRoundIcon,
      label: 'Customers',
      enabled: false,
    },
    {
      href: ROOTS.dashboard.meetings.root(),
      icon: HandshakeIcon,
      label: 'Meetings',
      enabled: ability.can('read', 'Meeting'),
    },
    {
      href: ROOTS.dashboard.proposals.root(),
      icon: FileTextIcon,
      label: 'Proposals',
      enabled: ability.can('read', 'Proposal'),
    },
    {
      href: ROOTS.dashboard.projects.root(),
      icon: ImageIcon,
      label: 'Projects',
      enabled: ability.can('read', 'Project'),
    },
  ]

  const adminItems: SidebarNavItem[] = ability.can('manage', 'all')
    ? [
        { href: ROOTS.dashboard.leadSources(), icon: RadioTowerIcon, label: 'Lead Sources', enabled: true },
        { href: ROOTS.dashboard.team(), icon: UsersIcon, label: 'Team', enabled: false },
        { href: ROOTS.dashboard.analytics(), icon: BarChart3Icon, label: 'Analytics', enabled: false },
      ]
    : []

  const footerItems: SidebarNavItem[] = [
    { href: ROOTS.dashboard.settings(), icon: SettingsIcon, label: 'Settings', enabled: true },
  ]

  return { dashboardItem, mainItems, recordsItems, adminItems, footerItems }
}
