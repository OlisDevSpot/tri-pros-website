'use client'

import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

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

  const metrics = [
    { label: 'Total Customers', value: String(totalCustomers) },
    { label: 'Active Pipeline', value: `$${activePipelineValue.toLocaleString()}` },
    { label: 'Conversion Rate', value: `${(conversionRate * 100).toFixed(1)}%` },
    { label: 'Meetings This Week', value: String(meetingsThisWeek) },
  ]

  return (
    <>
      {/* Mobile: compact vertical list */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        {metrics.map(m => (
          <div
            key={m.label}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-card"
          >
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <span className="text-sm font-bold tabular-nums">{m.value}</span>
          </div>
        ))}
      </div>

      {/* Desktop: card grid */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-3">
        {metrics.map(m => (
          <Card key={m.label}>
            <CardContent className="py-3 text-center">
              <span className="text-2xl font-bold">{m.value}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
