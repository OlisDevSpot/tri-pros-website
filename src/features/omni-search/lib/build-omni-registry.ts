import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { OmniEntry } from '@/features/omni-search/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { CalendarPlusIcon, FilePlusIcon, FolderPlusIcon, LogOutIcon, MoonIcon, ZapIcon } from 'lucide-react'
import { createSerializer } from 'nuqs'

import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { analyticsSearchParams } from '@/features/analytics/constants/query-parsers'
import { ANALYTICS_TABS, TAB_LABELS } from '@/features/analytics/constants/tabs'
import { CALCULATOR_TAB_META, calculatorTabHref } from '@/features/calculators/constants/calculator-tab-meta'
import { CALCULATOR_TABS } from '@/features/calculators/constants/query-parsers'
import { scheduleShowParser } from '@/features/schedule-management/constants/query-parsers'
import { SCHEDULE_SHOW_LABELS, SCHEDULE_SHOW_VALUES } from '@/features/schedule-management/constants/schedule-queries'
import { ROOTS } from '@/shared/config/roots'

const serializeAnalyticsUrl = createSerializer({ tab: analyticsSearchParams.tab })
const serializeScheduleUrl = createSerializer({ show: scheduleShowParser })

const FEATURED_PAGES = new Set<string>([
  ROOTS.dashboard.root,
  ROOTS.dashboard.pipeline(),
  ROOTS.dashboard.schedule(),
  ROOTS.dashboard.customers.root(),
  ROOTS.dashboard.calculators(),
])

function pageEntry(item: SidebarNavItem): OmniEntry {
  return {
    id: `page:${item.href}`,
    label: item.label,
    aliases: item.aliases ?? [],
    icon: item.icon,
    group: 'go-to',
    href: item.href,
    featured: FEATURED_PAGES.has(item.href),
  }
}

/** Every destination and action this user may reach, from the same nav config and URL parsers the pages use. */
export function buildOmniRegistry(ability: AppAbility): OmniEntry[] {
  const nav = getSidebarNav(ability)
  const pages = [nav.dashboardItem, ...nav.mainItems, ...nav.recordsItems, ...nav.adminItems, nav.settingsItem].filter(item => item.enabled)
  const entries: OmniEntry[] = pages.map(pageEntry)

  const pipeline = pages.find(item => item.href === ROOTS.dashboard.pipeline())
  if (pipeline) {
    for (const child of pipeline.children ?? []) {
      entries.push({ id: `pipeline:${child.key}`, label: `${child.label} pipeline`, parent: pipeline.label, aliases: ['board'], icon: pipeline.icon, group: 'go-to', href: child.href })
    }
  }

  const calculators = pages.find(item => item.href === ROOTS.dashboard.calculators())
  if (calculators) {
    for (const tab of CALCULATOR_TABS) {
      const meta = CALCULATOR_TAB_META[tab]
      entries.push({ id: `calculator:${tab}`, label: `${meta.label} calculator`, parent: calculators.label, aliases: meta.aliases, icon: calculators.icon, group: 'go-to', href: calculatorTabHref(tab) })
    }
  }

  const analytics = pages.find(item => item.href === ROOTS.dashboard.analytics())
  if (analytics) {
    for (const tab of ANALYTICS_TABS) {
      entries.push({ id: `analytics:${tab}`, label: `${TAB_LABELS[tab]} analytics`, parent: analytics.label, aliases: [], icon: analytics.icon, group: 'go-to', href: serializeAnalyticsUrl(ROOTS.dashboard.analytics(), { tab }) })
    }
  }

  const schedule = pages.find(item => item.href === ROOTS.dashboard.schedule())
  if (schedule) {
    for (const show of SCHEDULE_SHOW_VALUES) {
      entries.push({ id: `schedule:${show}`, label: `Schedule · ${SCHEDULE_SHOW_LABELS[show]}`, parent: schedule.label, aliases: [], icon: schedule.icon, group: 'go-to', href: serializeScheduleUrl(ROOTS.dashboard.schedule(), { show }) })
    }
  }

  if (ability.can('create', 'Meeting')) {
    entries.push({ id: 'action:schedule-meeting', label: 'Schedule meeting…', aliases: ['book', 'appointment', 'new meeting'], icon: CalendarPlusIcon, group: 'actions', action: 'schedule-meeting', featured: true })
  }
  if (ability.can('create', 'Proposal')) {
    entries.push({ id: 'action:new-proposal', label: 'New proposal', aliases: ['create proposal', 'quote', 'estimate'], icon: FilePlusIcon, group: 'actions', href: ROOTS.dashboard.proposals.new() })
  }
  if (ability.can('create', 'Project')) {
    entries.push({ id: 'action:new-project', label: 'New project', aliases: ['create project', 'job'], icon: FolderPlusIcon, group: 'actions', href: ROOTS.dashboard.projects.new() })
  }
  entries.push(
    { id: 'action:toggle-theme', label: 'Toggle dark mode', aliases: ['theme', 'dark', 'light', 'night'], icon: MoonIcon, group: 'actions', action: 'toggle-theme' },
    { id: 'action:action-center', label: 'Open Action Center', aliases: ['tasks', 'follow ups', 'queue'], icon: ZapIcon, group: 'actions', action: 'action-center' },
    { id: 'action:sign-out', label: 'Sign out', aliases: ['log out', 'logout'], icon: LogOutIcon, group: 'actions', action: 'sign-out' },
  )
  return entries
}
