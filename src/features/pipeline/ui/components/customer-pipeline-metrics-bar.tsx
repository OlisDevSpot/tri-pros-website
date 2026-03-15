'use client'

import type { CustomerPipelineItem } from '@/features/pipeline/types'

import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  items: CustomerPipelineItem[]
}

export function CustomerPipelineMetricsBar({ items }: Props) {
  const totalCustomers = items.length
  const activePipelineValue = items
    .filter(i => i.stage !== 'declined' && i.stage !== 'approved')
    .reduce((sum, i) => sum + i.totalPipelineValue, 0)
  const approvedCount = items.filter(i => i.stage === 'approved').length
  const sentOrHigher = items.filter(i =>
    i.stage === 'proposal_sent'
    || i.stage === 'contract_sent'
    || i.stage === 'approved',
  ).length
  const conversionRate = sentOrHigher > 0 ? approvedCount / sentOrHigher : 0
  const meetingsThisWeek = items.filter((i) => {
    const d = new Date(i.latestActivityAt)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return d >= weekAgo && (i.stage === 'meeting_scheduled' || i.stage === 'meeting_in_progress')
  }).length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">{totalCustomers}</span>
          <p className="text-xs text-muted-foreground mt-0.5">Total Customers</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">
            $
            {activePipelineValue.toLocaleString()}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">Active Pipeline</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">
            {(conversionRate * 100).toFixed(1)}
            %
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">Conversion Rate</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">{meetingsThisWeek}</span>
          <p className="text-xs text-muted-foreground mt-0.5">Meetings This Week</p>
        </CardContent>
      </Card>
    </div>
  )
}
