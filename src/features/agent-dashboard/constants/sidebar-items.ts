import type { DashboardStep } from '@/features/agent-dashboard/types'

import { CalendarIcon, FileTextIcon, GitBranchIcon, ImageIcon, ZapIcon } from 'lucide-react'

interface SidebarItem {
  step: DashboardStep
  icon: typeof ZapIcon
  label: string
  enabled: boolean
}

export const dashboardSidebarItems: readonly SidebarItem[] = [
  { step: 'action-center', icon: ZapIcon, label: 'Actions', enabled: true },
  { step: 'pipeline', icon: GitBranchIcon, label: 'Pipeline', enabled: true },
  { step: 'meetings', icon: CalendarIcon, label: 'Meetings', enabled: true },
  { step: 'proposals', icon: FileTextIcon, label: 'Proposals', enabled: true },
  { step: 'showroom', icon: ImageIcon, label: 'Showroom', enabled: true },
]
