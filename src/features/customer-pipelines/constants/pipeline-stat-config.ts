import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { CalendarIcon, DollarSignIcon, UsersIcon } from 'lucide-react'

export const pipelineStatConfig: StatBarItemConfig<CustomerPipelineItem>[] = [
  {
    key: 'total',
    label: 'Total Customers',
    icon: UsersIcon,
    getValue: data => data.length,
  },
  {
    key: 'value',
    label: 'Active Pipeline Value',
    icon: DollarSignIcon,
    getValue: data =>
      data
        .filter(item => item.stage !== 'declined' && item.stage !== 'approved')
        .reduce((sum, item) => sum + item.totalPipelineValue, 0),
    renderValue: v => `$${v.toLocaleString()}`,
  },
]

/**
 * Meetings booked in the last 7 days. Only meaningful for the fresh pipeline
 * (the board whose stages include meeting_scheduled / meeting_in_progress), so
 * it's composed into `freshStatConfig` rather than the shared base.
 */
export const meetingsThisWeekStat: StatBarItemConfig<CustomerPipelineItem> = {
  key: 'meetings',
  label: 'Meetings This Week',
  icon: CalendarIcon,
  getValue: (data) => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return data.filter(
      item =>
        (item.stage === 'meeting_scheduled' || item.stage === 'meeting_in_progress')
        && item.latestActivityAt !== null
        && new Date(item.latestActivityAt) >= weekAgo,
    ).length
  },
}
