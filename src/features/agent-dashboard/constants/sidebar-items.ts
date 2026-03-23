import type { DashboardStep } from '@/features/agent-dashboard/types'

import { CalendarIcon, FileTextIcon, GitBranchIcon, ImageIcon } from 'lucide-react'

interface SidebarItem {
  step: DashboardStep
  icon: typeof GitBranchIcon
  label: string
  enabled: boolean
}

export const dashboardSidebarItems: readonly SidebarItem[] = [
  { step: 'customer-pipelines', icon: GitBranchIcon, label: 'Pipeline', enabled: true },
  { step: 'meetings', icon: CalendarIcon, label: 'Meetings', enabled: true },
  { step: 'proposals', icon: FileTextIcon, label: 'Proposals', enabled: true },
  { step: 'showroom', icon: ImageIcon, label: 'Showroom', enabled: true },
]
