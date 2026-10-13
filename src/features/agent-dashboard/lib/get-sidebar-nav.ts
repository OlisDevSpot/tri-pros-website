import type { LucideIcon } from 'lucide-react'

import type { AppAbility } from '@/shared/domains/permissions/types'

import {
  BarChart3Icon,
  CalculatorIcon,
  CalendarIcon,
  FileTextIcon,
  GitBranchIcon,
  HandshakeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
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
  aliases?: readonly string[]
  children?: readonly SidebarNavSubItem[]
}

export interface SidebarNavConfig {
  dashboardItem: SidebarNavItem
  mainItems: readonly SidebarNavItem[]
  recordsItems: readonly SidebarNavItem[]
  adminItems: readonly SidebarNavItem[]
  settingsItem: SidebarNavItem
}

export function getSidebarNav(ability: AppAbility): SidebarNavConfig {
  const dashboardItem: SidebarNavItem = {
    href: ROOTS.dashboard.root,
    icon: LayoutDashboardIcon,
    label: 'Dashboard',
    enabled: true,
    aliases: ['home', 'today'],
  }

  const mainItems: SidebarNavItem[] = [
    {
      href: ROOTS.dashboard.pipeline(),
      icon: GitBranchIcon,
      label: 'Pipeline',
      enabled: ability.can('read', 'Customer'),
      aliases: ['board', 'kanban', 'leads', 'deals'],
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
      aliases: ['calendar', 'appointments', 'agenda'],
    },
    {
      href: ROOTS.dashboard.calculators(),
      icon: CalculatorIcon,
      label: 'Calculators',
      enabled: ability.can('access', 'Dashboard'),
      aliases: ['calc', 'calculator'],
    },
  ]

  const recordsItems: SidebarNavItem[] = [
    {
      href: ROOTS.dashboard.customers.root(),
      icon: UsersRoundIcon,
      label: 'Customers',
      enabled: ability.can('read', 'Customer'),
      aliases: ['clients', 'homeowners', 'contacts'],
    },
    {
      href: ROOTS.dashboard.meetings.root(),
      icon: HandshakeIcon,
      label: 'Meetings',
      enabled: ability.can('read', 'Meeting'),
      aliases: ['visits', 'appointments'],
    },
    {
      href: ROOTS.dashboard.proposals.root(),
      icon: FileTextIcon,
      label: 'Proposals',
      enabled: ability.can('read', 'Proposal'),
      aliases: ['quotes', 'estimates', 'bids'],
    },
    {
      href: ROOTS.dashboard.projects.root(),
      icon: ImageIcon,
      label: 'Projects',
      enabled: ability.can('read', 'Project'),
      aliases: ['jobs', 'portfolio'],
    },
  ]

  const adminItems: SidebarNavItem[] = ability.can('manage', 'all')
    ? [
        { href: ROOTS.dashboard.leadSources(), icon: RadioTowerIcon, label: 'Lead Sources', enabled: true, aliases: ['sources', 'marketing'] },
        { href: ROOTS.dashboard.campaigns(), icon: MegaphoneIcon, label: 'Campaigns', enabled: true, aliases: ['dialer', 'voip', 'calls'] },
        { href: ROOTS.dashboard.team(), icon: UsersIcon, label: 'Team', enabled: false },
        { href: ROOTS.dashboard.analytics(), icon: BarChart3Icon, label: 'Analytics', enabled: true, aliases: ['reports', 'stats', 'metrics'] },
      ]
    : []

  const settingsItem: SidebarNavItem = { href: ROOTS.dashboard.settings(), icon: SettingsIcon, label: 'Settings', enabled: true, aliases: ['preferences', 'account', 'profile'] }

  return { dashboardItem, mainItems, recordsItems, adminItems, settingsItem }
}
