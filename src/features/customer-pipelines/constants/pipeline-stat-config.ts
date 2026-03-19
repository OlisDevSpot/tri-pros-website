import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { CalendarIcon, DollarSignIcon, PercentIcon, UsersIcon } from 'lucide-react'

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
  {
    key: 'conversion',
    label: 'Conversion Rate',
    icon: PercentIcon,
    getValue: (data) => {
      const eligible = data.filter(item =>
        ['proposal_sent', 'contract_sent', 'approved'].includes(item.stage),
      )
      if (eligible.length === 0) {
        return 0
      }
      const approved = eligible.filter(item => item.stage === 'approved').length
      return Math.round((approved / eligible.length) * 100)
    },
    renderValue: v => `${v}%`,
  },
  {
    key: 'meetings',
    label: 'Meetings This Week',
    icon: CalendarIcon,
    getValue: (data) => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return data.filter(
        item =>
          (item.stage === 'meeting_scheduled' || item.stage === 'meeting_in_progress')
          && new Date(item.latestActivityAt) >= weekAgo,
      ).length
    },
  },
]
